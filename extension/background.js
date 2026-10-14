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
  const lang = profile.learningLanguage;
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

// ─── Save one word ────────────────────────────────────────────────────────────

async function saveWord(msg) {
  const session = await getValidSession();
  const userId = session.user.id;
  const token = session.access_token;
  const word = normalizeToken(msg.word);
  if (!word) return { ok: false, error: 'Empty word' };

  const profile = await getProfile(userId, token);
  const lang = profile.learningLanguage || msg.language || 'fr';
  if (!textMatchesLanguageScript(word, lang)) {
    return { ok: false, error: 'wrong_language', message: 'That word isn’t in the language you’re learning.' };
  }
  const now = new Date().toISOString();

  // Already in this language's deck? Mark it as met in a video today so it
  // still counts toward the daily goal (same as the app), then stop.
  const checkRes = await rest(
    `saved_words?user_id=eq.${userId}&language=eq.${encodeURIComponent(lang)}&word=eq.${encodeURIComponent(word)}&select=id,video_saved_at`,
    token
  );
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
    return { ok: true, already: true, counted: !countedToday };
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
  return { ok: true };
}

// ─── Message router ───────────────────────────────────────────────────────────

function reply(promise, sendResponse) {
  promise.then(sendResponse).catch(e => sendResponse({ ok: false, error: e?.message || String(e) }));
  return true;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'SIGN_IN':
      return reply((async () => {
        const data = await signIn(msg.email, msg.password);
        const session = { ...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
        await chrome.storage.local.set({ ls_session: session });
        _profileCache = { userId: null, profile: null, ts: 0 };
        invalidateDeckCache();
        return { ok: true, email: data.user?.email };
      })(), sendResponse);

    case 'SIGN_OUT':
      return reply((async () => {
        await chrome.storage.local.remove('ls_session');
        _profileCache = { userId: null, profile: null, ts: 0 };
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
        const profile = await getProfile(session.user.id, session.access_token);
        const lang = profile.learningLanguage || msg.language || 'fr';
        const index = await getDeckIndexCached(session.user.id, lang, session.access_token, { force: !!msg.force });
        return { ok: true, deck: Object.fromEntries(index), language: lang };
      })(), sendResponse);

    case 'SAVE_WORD':
      return reply(saveWord(msg), sendResponse);

    default:
      return false;
  }
});
