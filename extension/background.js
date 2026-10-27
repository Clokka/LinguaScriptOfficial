// LinguaScript Background Service Worker
//
// Signs the learner in, reads their profile (learning language, goal, streak),
// colours subtitle words from their flashcard decks and saves clicked words.
// The same Supabase project as linguascript.co.uk, so everything lines up
// with the app.

const SUPABASE_URL = 'https://ffephracinqeylfhqkiz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA';
const SITE_URL = 'https://linguascript.co.uk';

// ─── Install: show the welcome page ──────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
});

// Content scripts hold a port open while a video is playing so the worker
// isn't put to sleep between subtitle lines.
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'ls-keepalive') port.onDisconnect.addListener(() => {});
});

// ─── Auth ────────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || 'Sign-in failed');
  return data; // { access_token, refresh_token, user }
}

// Google sign-in: Supabase's own Google provider (the same one the website
// uses) in a Chrome sign-in window. Supabase sends the tokens back to the
// extension's redirect URL, which must be listed under Auth → URL Configuration
// → Redirect URLs as https://<extension-id>.chromiumapp.org/**.
async function signInWithGoogle() {
  const redirectTo = chrome.identity.getRedirectURL();
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  let finalUrl;
  try {
    finalUrl = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  } catch {
    throw new Error('Google sign-in didn’t finish. Try again or use email.');
  }
  const params = new URLSearchParams(new URL(finalUrl).hash.slice(1));
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error(params.get('error_description') || 'Google sign-in failed');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${accessToken}` },
  });
  if (!userRes.ok) throw new Error('Google sign-in failed');
  return {
    access_token: accessToken,
    refresh_token: params.get('refresh_token'),
    expires_in: Number(params.get('expires_in')) || 3600,
    user: await userRes.json(),
  };
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Session refresh failed');
  return data;
}

async function getValidSession() {
  const { ls_session } = await chrome.storage.local.get(['ls_session']);
  if (!ls_session) throw new Error('Not logged in');
  if (Date.now() < ls_session.expires_at * 1000 - 60000) return ls_session;
  try {
    const refreshed = await refreshSession(ls_session.refresh_token);
    const session = { ...refreshed, expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in };
    await chrome.storage.local.set({ ls_session: session });
    return session;
  } catch {
    await chrome.storage.local.remove('ls_session');
    throw new Error('Session expired — please log in again');
  }
}

function rest(path, accessToken, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
}

// ─── Words ────────────────────────────────────────────────────────────────────

// Normalise a token to its match key. MUST stay identical to normalizeToken()
// in src/lib/vocab.ts and ls-core.js — the app and the extension share one
// keyspace (Chinese/Japanese punctuation included).
function normalizeToken(raw) {
  return (raw || '')
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, '')
    .trim();
}

// Same rule as textMatchesLanguageScript() in src/lib/languages.ts: a Chinese
// word must contain Chinese characters, a Russian one Cyrillic, and so on, so
// an English word in a mixed subtitle can't be saved as "Chinese".
const SCRIPT_BY_LANG = {
  ru: /[Ѐ-ӿ]/, zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/,
  ko: /[가-힯]/, ar: /[؀-ۿ]/, hi: /[ऀ-ॿ]/, th: /[฀-๿]/,
};
function textMatchesLanguageScript(text, lang) {
  const re = SCRIPT_BY_LANG[(lang || '').toLowerCase().split('-')[0]];
  return !re || re.test(text);
}

function coerceState(raw) {
  return raw === 'green' ? 'green' : raw === 'orange' ? 'orange' : 'red';
}

// If a word has more than one row, the more advanced deck wins so a green
// word is never shown red because of a stray duplicate.
const STATE_RANK = { red: 0, orange: 1, green: 2 };
function higherState(current, next) {
  if (!current) return next;
  return STATE_RANK[next] > STATE_RANK[current] ? next : current;
}

// PostgREST returns at most 1000 rows per request; page through the rest.
async function fetchAllSavedWords(query, accessToken) {
  const PAGE = 1000;
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await rest(`${query}&limit=${PAGE}&offset=${offset}`, accessToken);
    if (!res.ok) throw new Error(`Failed to load saved_words (${res.status})`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

// The learner's deck for one language: normalizeToken(word) → state.
async function loadDeckIndex(userId, language, accessToken) {
  const rows = await fetchAllSavedWords(
    `saved_words?user_id=eq.${userId}&language=eq.${encodeURIComponent(language)}&select=word,state`,
    accessToken
  );
  const m = new Map();
  for (const row of rows) {
    const key = normalizeToken(row.word);
    m.set(key, higherState(m.get(key), coerceState(row.state)));
  }
  return m;
}

// Content scripts ask for the deck on every subtitle change; cache it per
// (user, language) for a few seconds. Saving a word drops the cache.
const DECK_CACHE_TTL_MS = 10000;
let _deckCache = { key: null, index: null, ts: 0 };

async function getDeckIndexCached(userId, language, accessToken, { force = false } = {}) {
  const key = `${userId}:${language}`;
  const fresh = _deckCache.key === key && Date.now() - _deckCache.ts < DECK_CACHE_TTL_MS;
  if (!force && fresh && _deckCache.index) return _deckCache.index;
  const index = await loadDeckIndex(userId, language, accessToken);
  _deckCache = { key, index, ts: Date.now() };
  return index;
}

function invalidateDeckCache() {
  _deckCache = { key: null, index: null, ts: 0 };
}

// ─── Profile ──────────────────────────────────────────────────────────────────
// The learning language, native language, goals and streak come from the same
// profiles row the app reads, so the extension always matches the website.
const PROFILE_CACHE_TTL_MS = 60000;
let _profileCache = { userId: null, profile: null, ts: 0 };

async function getProfile(userId, accessToken, { force = false } = {}) {
  if (!force && _profileCache.userId === userId && _profileCache.profile && Date.now() - _profileCache.ts < PROFILE_CACHE_TTL_MS) {
    return _profileCache.profile;
  }
  try {
    const res = await rest(
      `profiles?user_id=eq.${userId}&select=learning_language,native_language,streak_count,daily_word_goal,daily_video_goal`,
      accessToken
    );
    const rows = await res.json();
    const p = (Array.isArray(rows) && rows[0]) || {};
    const profile = {
      learningLanguage: p.learning_language ? String(p.learning_language).toLowerCase() : null,
      nativeLanguage: p.native_language ? String(p.native_language).toLowerCase() : 'en',
      streak: p.streak_count || 0,
      dailyWordGoal: p.daily_word_goal ?? null,
      dailyVideoGoal: p.daily_video_goal ?? null,
    };
    _profileCache = { userId, profile, ts: Date.now() };
    return profile;
  } catch {
    return { learningLanguage: null, nativeLanguage: 'en', streak: 0, dailyWordGoal: null, dailyVideoGoal: null };
  }
}

// ─── Which language is this session in? ─────────────────────────────────────
// Words may only be saved to the account's own languages: the "My languages"
// list on the site (language_profiles). profiles.learning_language alone is not
// trusted, because new accounts get 'es' there by default; that is how a French
// word once ended up in a hidden Spanish deck.
const LANGS_CACHE_TTL_MS = 60 * 1000;
let _langsCache = { userId: null, ts: 0, value: null };
function invalidateLanguages() { _langsCache = { userId: null, ts: 0, value: null }; }

async function getLanguages(session) {
  const userId = session.user.id;
  const token = session.access_token;
  let base = _langsCache.userId === userId && Date.now() - _langsCache.ts < LANGS_CACHE_TTL_MS ? _langsCache.value : null;
  if (!base) {
    const [lpRes, profile] = await Promise.all([
      rest(`language_profiles?user_id=eq.${userId}&select=language&order=created_at.asc`, token),
      getProfile(userId, token),
    ]);
    const rows = lpRes.ok ? await lpRes.json() : [];
    let languages = [...new Set(rows.map(r => String(r.language || '').toLowerCase()).filter(Boolean))];
    // Older accounts made before the language list existed.
    if (!languages.length && profile.learningLanguage) languages = [profile.learningLanguage];
    base = { languages, profileLanguage: profile.learningLanguage, nativeLanguage: profile.nativeLanguage };
    _langsCache = { userId, ts: Date.now(), value: base };
  }
  const { languages, profileLanguage, nativeLanguage } = base;
  const { ls_chosen_language: chosen } = await chrome.storage.local.get('ls_chosen_language');
  const picked = chosen && languages.includes(chosen);
  const language = picked ? chosen
    : languages.length === 1 ? languages[0]
    : languages.includes(profileLanguage) ? profileLanguage
    : languages[0] || null;
  return { language, languages, needsChoice: languages.length > 1 && !picked, nativeLanguage };
}

async function setLanguage(session, language) {
  const lang = String(language || '').toLowerCase();
  const { languages } = await getLanguages(session);
  if (!languages.includes(lang)) return { ok: false, error: 'not_your_language', languages };
  await chrome.storage.local.set({ ls_chosen_language: lang, ls_language: lang });
  invalidateDeckCache();
  return { ok: true, language: lang };
}

async function storeSession(data) {
  const session = { ...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
  await chrome.storage.local.set({ ls_session: session });
  await chrome.storage.local.remove('ls_chosen_language');
  _profileCache = { userId: null, profile: null, ts: 0 };
  invalidateLanguages();
  invalidateDeckCache();
  return { ok: true, email: data.user?.email };
}

// Mirrors wordGoalForVideos() in src/lib/progressStats.ts.
function wordGoalForVideos(videoGoal) {
  if (videoGoal <= 1) return 10;
  if (videoGoal === 2) return 20;
  return 40;
}

// Today's goal, counted exactly like useDailyWordGoal in the app: words saved
// from a video since local midnight in the learning language, against that
// language's own goal (falling back to the account goal).
async function getToday(session) {
  const userId = session.user.id;
  const token = session.access_token;
  const profile = await getProfile(userId, token, { force: true });
  const { language: lang } = await getLanguages(session);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  let langProfile = null;
  let saved = 0;
  if (lang) {
    const [lpRes, countRes] = await Promise.all([
      rest(`language_profiles?user_id=eq.${userId}&language=eq.${encodeURIComponent(lang)}&select=daily_word_goal,daily_video_goal`, token),
      rest(
        `saved_words?user_id=eq.${userId}&language=eq.${encodeURIComponent(lang)}&video_saved_at=gte.${encodeURIComponent(midnight.toISOString())}&select=id`,
        token,
        { headers: { 'Prefer': 'count=exact', 'Range': '0-0' } }
      ),
    ]);
    if (lpRes.ok) langProfile = (await lpRes.json())[0] || null;
    const range = countRes.headers.get('Content-Range');
    saved = range ? parseInt(range.split('/')[1], 10) || 0 : 0;
  }
  const goal =
    langProfile?.daily_word_goal ??
    profile.dailyWordGoal ??
    wordGoalForVideos(langProfile?.daily_video_goal ?? profile.dailyVideoGoal ?? 1);
  return { language: lang, saved, goal, streak: profile.streak };
}

// ─── Translation (Google gtx, the same free endpoint the app falls back to) ────

const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));

async function gtxTranslate(text, sl, tl, ms = 4000) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await Promise.race([fetch(url), timeout(ms)]);
  if (!res.ok) return null;
  const data = await res.json();
  const tr = (data[0] || []).map(c => c?.[0] || '').join('').trim();
  return tr && tr.toLowerCase() !== text.toLowerCase() ? tr : null;
}

// ─── Golden words: the app's common-words list ───────────────────────────────
// core_vocabulary ranked by frequency is what the app's Common Words decks
// (Top 50, 100, 150…) are built from. The extension rings this list's words
// gold, so learners get the next most useful words from it, minus anything
// already in their decks. Readable without logging in.
const GOLD_POOL_SIZE = 300;
const COMMON_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const _commonCache = new Map(); // language → { ts, words }
const SEGMENTED = new Set(['zh', 'ja', 'th']);

async function getCommonWords(lang) {
  const hit = _commonCache.get(lang);
  if (hit && Date.now() - hit.ts < COMMON_CACHE_TTL_MS) return hit.words;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/core_vocabulary?language=eq.${encodeURIComponent(lang)}&select=word&order=rank.asc&limit=2000`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  if (!res.ok) return hit?.words || [];
  const seen = new Set();
  const words = [];
  for (const row of await res.json()) {
    const w = normalizeToken(row.word);
    // Phrases can't match a single subtitle word; single letters are mostly noise.
    if (!w || seen.has(w) || /\s/.test(w) || (!SEGMENTED.has(lang) && w.length < 2)) continue;
    seen.add(w);
    words.push(w);
  }
  _commonCache.set(lang, { ts: Date.now(), words });
  return words;
}

async function getGoldPool(language) {
  const session = await getValidSession().catch(() => null);
  let lang = String(language || '').toLowerCase();
  let deck = new Map();
  if (session) {
    const langs = await getLanguages(session);
    if (!langs.languages.includes(lang)) lang = langs.language || lang;
    if (lang) deck = await getDeckIndexCached(session.user.id, lang, session.access_token);
  }
  if (!lang) return { ok: true, words: [] };
  const common = await getCommonWords(lang);
  const words = [];
  for (const w of common) {
    if (deck.has(w)) continue;
    words.push(w);
    if (words.length >= GOLD_POOL_SIZE) break;
  }
  return { ok: true, words, language: lang };
}

// ─── XP ───────────────────────────────────────────────────────────────────────
// Same ledger as the app (src/lib/xp.ts persistXP): an xp_events row plus the
// atomic increment_xp RPC, so extension XP shows up on the website too.
async function awardXp(session, amount, meta) {
  const token = session.access_token;
  rest('xp_events', token, {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ user_id: session.user.id, action: 'add_word', amount, meta }),
  }).catch(() => {});
  const res = await rest('rpc/increment_xp', token, { method: 'POST', body: JSON.stringify({ p_amount: amount }) });
  if (!res.ok) return null;
  const total = await res.json();
  return typeof total === 'number' ? total : null;
}

async function getXp(session) {
  const res = await rest(`profiles?user_id=eq.${session.user.id}&select=xp_total`, session.access_token);
  const rows = res.ok ? await res.json() : [];
  return rows[0]?.xp_total ?? 0;
}

// ─── Save one word ────────────────────────────────────────────────────────────

async function saveWord(msg) {
  const session = await getValidSession();
  const userId = session.user.id;
  const token = session.access_token;
  const word = normalizeToken(msg.word);
  if (!word) return { ok: false, error: 'Empty word' };

  // Save into the language the learner is watching in, and only if it's one of
  // their LinguaScript languages; never into a guessed deck. The lookups run
  // side by side so a save is one round trip slower than a click, not four.
  const lang = String(msg.language || '').toLowerCase();
  const [profile, { languages }, checkRes] = await Promise.all([
    getProfile(userId, token),
    getLanguages(session),
    rest(
      `saved_words?user_id=eq.${userId}&language=eq.${encodeURIComponent(lang)}&word=eq.${encodeURIComponent(word)}&select=id,video_saved_at`,
      token
    ),
  ]);
  if (!languages.includes(lang)) {
    return { ok: false, error: 'not_your_language', language: lang, languages };
  }
  if (!textMatchesLanguageScript(word, lang)) {
    return { ok: false, error: 'wrong_language', message: 'That word isn’t in the language you’re learning.' };
  }
  const now = new Date().toISOString();

  // Already in this language's deck? Mark it as met in a video today so it
  // still counts toward the daily goal (same as the app), then stop.
  const existing = checkRes.ok ? await checkRes.json() : [];
  if (existing.length > 0) {
    const row = existing[0];
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const countedToday = row.video_saved_at && new Date(row.video_saved_at) >= midnight;
    if (!countedToday) {
      await rest(`saved_words?id=eq.${row.id}`, token, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ video_saved_at: now }),
      });
    }
    return { ok: true, already: true, counted: !countedToday, language: lang };
  }

  let translation = (msg.translation || '').trim();
  if (!translation) {
    translation = (await gtxTranslate(word, lang, profile.nativeLanguage || 'en').catch(() => null)) || '';
  }

  const row = {
    user_id: userId,
    word,
    language: lang,
    context: (msg.context || '').slice(0, 500),
    translation,
    ipa: '',
    pronunciation: '',
    next_review: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    interval_days: 0,
    review_count: 0,
    ease_factor: 2.5,
    state: 'red',
    video_saved_at: now,
  };
  const insertRes = await rest('saved_words', token, {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('[LinguaScript] save failed:', insertRes.status, err);
    return { ok: false, error: `Couldn’t save (${insertRes.status})` };
  }
  invalidateDeckCache();
  // Matches XP_SAVE / XP_GOLDEN in ls-core.js; add_word is 20 in the app too.
  const xp = msg.golden ? 50 : 20;
  const xpTotal = await awardXp(session, xp, { source: 'extension', golden: !!msg.golden }).catch(() => null);
  return { ok: true, language: lang, xp, xpTotal };
}

// ─── Message router ───────────────────────────────────────────────────────────

function reply(promise, sendResponse) {
  promise.then(sendResponse).catch(e => sendResponse({ ok: false, error: e?.message || String(e) }));
  return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'SIGN_IN':
      return reply((async () => {
        return storeSession(await signIn(msg.email, msg.password));
      })(), sendResponse);

    case 'GOOGLE_SIGN_IN':
      return reply((async () => storeSession(await signInWithGoogle()))(), sendResponse);

    case 'SIGN_OUT':
      return reply((async () => {
        await chrome.storage.local.remove(['ls_session', 'ls_chosen_language']);
        _profileCache = { userId: null, profile: null, ts: 0 };
        invalidateLanguages();
        invalidateDeckCache();
        return { ok: true };
      })(), sendResponse);

    case 'GET_AUTH':
      return reply((async () => {
        const session = await getValidSession().catch(() => null);
        return { session: session ? { user: { id: session.user?.id, email: session.user?.email } } : null };
      })(), sendResponse);

    case 'GET_PROFILE':
      return reply((async () => {
        const session = await getValidSession();
        return { ok: true, ...(await getProfile(session.user.id, session.access_token)) };
      })(), sendResponse);

    // The account's languages and the one this session uses.
    case 'GET_LANGUAGES':
      return reply((async () => {
        const session = await getValidSession().catch(() => null);
        if (!session) return { ok: false };
        return { ok: true, ...(await getLanguages(session)) };
      })(), sendResponse);

    case 'SET_LANGUAGE':
      return reply((async () => setLanguage(await getValidSession(), msg.language))(), sendResponse);

    case 'GET_TODAY':
      return reply((async () => ({ ok: true, ...(await getToday(await getValidSession())) }))(), sendResponse);

    case 'WORD_DETAIL':
      return reply((async () => {
        const { word, sourceLang = 'fr', targetLang = 'en' } = msg;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&dt=ss&dt=ex&q=${encodeURIComponent(word)}`;
        const data = await (await Promise.race([fetch(url), timeout(5000)])).json();
        const translation = (data[0] || []).map(c => c?.[0] || '').join('').trim();
        // data[1]: [pos, null, [[word,...], score, gender], ...]
        const synonymGroups = [];
        if (Array.isArray(data[1])) {
          for (const group of data[1]) {
            const words = [];
            for (const entry of group[2] || []) {
              const list = Array.isArray(entry[0]) ? entry[0] : [];
              words.push(...list.filter(w => typeof w === 'string'));
            }
            if (words.length) synonymGroups.push({ pos: group[0] || '', words: words.slice(0, 8) });
          }
        }
        // data[11]: [example_html, source_html]
        const examples = [];
        if (Array.isArray(data[11])) {
          for (const ex of data[11].slice(0, 3)) {
            const raw = (ex[0] || '').replace(/<[^>]+>/g, '').trim();
            if (raw) examples.push(raw);
          }
        }
        return { ok: true, translation, synonymGroups, examples };
      })(), sendResponse);

    case 'TRANSLATE':
      return reply((async () => {
        const sl = msg.sourceLang && msg.sourceLang !== 'auto' ? msg.sourceLang : 'auto';
        const translation = await gtxTranslate(msg.text, sl, msg.targetLang).catch(() => null);
        return { ok: !!translation, translation };
      })(), sendResponse);

    // The deck colours for the learner's current language: { word: state }.
    case 'GET_DECK':
      return reply((async () => {
        const session = await getValidSession().catch(() => null);
        if (!session) return { ok: false, deck: {} };
        const { language, languages } = await getLanguages(session);
        const lang = languages.includes(msg.language) ? msg.language : language;
        if (!lang) return { ok: true, deck: {}, language: null };
        const index = await getDeckIndexCached(session.user.id, lang, session.access_token, { force: !!msg.force });
        return { ok: true, deck: Object.fromEntries(index), language: lang };
      })(), sendResponse);

    case 'SAVE_WORD':
      return reply(saveWord(msg), sendResponse);

    // linguascript.co.uk asks to sign in as the extension's account. Only the
    // site's own bridge may ask, never a script on YouTube or Netflix.
    case 'SITE_HANDOFF':
      if (!/^https:\/\/(www\.)?linguascript\.co\.uk$/.test(sender.origin || '')) return false;
      return reply((async () => {
        const session = await getValidSession();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/extension-handoff`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token_hash) return { ok: false, error: data.error || `Sign-in failed (${res.status})` };
        return { ok: true, tokenHash: data.token_hash };
      })(), sendResponse);

    // The next common words to ring gold for this language.
    case 'GET_GOLD_POOL':
      return reply(getGoldPool(msg.language), sendResponse);

    case 'GET_XP':
      return reply((async () => {
        const session = await getValidSession().catch(() => null);
        if (!session) return { ok: false };
        return { ok: true, xpTotal: await getXp(session) };
      })(), sendResponse);

    default:
      return false;
  }
});
