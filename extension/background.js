// LinguaScript Background Service Worker
//
// Signs the learner in, reads their profile (learning language, goal, streak),
// colours subtitle words from their flashcard decks and saves clicked words.
// The same Supabase project as linguascript.co.uk, so everything lines up
// with the app.

const SUPABASE_URL = 'https://wxlvxkeqhdlknthmliql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bHZ4a2VxaGRsa250aG1saXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MjAwODEsImV4cCI6MjA3ODI5NjA4MX0.PJUPL6IUAAH6MRtb07m_BtyF1NG39-kI9f2Kwp0h3g8';
const SITE_URL = 'https://linguascript.co.uk';

// The list of video sites (shared with the pop-up and the universal adapter).
importScripts('sites.js');

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

// The login server sometimes answers with a web page (an error or block page)
// instead of data; JSON.parse then said "Unexpected token '<'". Say what happened.
async function readAuthJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch {
    const blocked = /<!doctype|<html/i.test(text);
    throw new Error(blocked
      ? `LinguaScript's login server sent a web page instead of an answer (code ${res.status}). Try again in a minute, or use Continue with Google. If it keeps happening, an ad blocker or network filter may be blocking supabase.co.`
      : `Unexpected reply from the login server (code ${res.status}). Try again in a minute.`);
  }
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await readAuthJson(res);
  if (!res.ok) throw new Error(data.error_description || data.message || 'Sign-in failed');
  return data; // { access_token, refresh_token, user }
}

// Google sign-in happens ON linguascript.co.uk: the pop-up opens /auth?ext=1,
// the learner uses the website's own Google button (Google shows our domain),
// and the site hands the extension a one-time sign-in token (SITE_SESSION
// below, via site-bridge.js). No chrome.identity redirect, so it works for the
// store build and any unpacked copy alike (their extension IDs differ, which
// broke Google's redirect check with "redirect_uri_mismatch").
const SIGN_IN_PAGE = `${SITE_URL}/auth?ext=1`;
// Remember the tab the learner came from (their Netflix video), so once the
// site has signed the extension in we close the sign-in tab and go back there.
async function openSiteSignIn() {
  const [from] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  const tab = await chrome.tabs.create({ url: SIGN_IN_PAGE });
  await chrome.storage.session.set({ ls_sign_in: { tabId: tab.id, returnTabId: from?.id ?? null } }).catch(() => {});
  return { ok: true, opened: true };
}

async function backToVideo(signInTabId) {
  const { ls_sign_in: s } = await chrome.storage.session.get('ls_sign_in').catch(() => ({}));
  await chrome.storage.session.remove('ls_sign_in').catch(() => {});
  const back = s?.returnTabId != null ? await chrome.tabs.get(s.returnTabId).catch(() => null) : null;
  if (back) {
    await chrome.tabs.update(back.id, { active: true }).catch(() => {});
    await chrome.windows.update(back.windowId, { focused: true }).catch(() => {});
    // Every frame of the video tab reloads the account (colours, goal, language).
    chrome.tabs.sendMessage(back.id, { type: 'LS_SIGNED_IN' }).catch(() => {});
  }
  // Leave the site's "signed in" message up for a moment, then close the tab
  // we opened (never a tab the learner opened themselves).
  if (signInTabId != null && (s?.tabId === signInTabId || !s)) setTimeout(() => chrome.tabs.remove(signInTabId).catch(() => {}), back ? 1200 : 4000);
}

/** One-time magic-link token from the website → the extension's own session. */
async function sessionFromTokenHash(tokenHash) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  });
  const data = await readAuthJson(res);
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.msg || 'Sign-in from linguascript.co.uk failed');
  return data;
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
    .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’¿¡]/g, '')
    .trim()
    // ANY punctuation or symbol at the edges ("¿Sabes", "-Impecable", "hola!!", "«oui»"),
    // never inside: "peut-être" keeps its hyphen.
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
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

// Gold = a green word whose review is due — same rule as isDueGold() in
// packages/core/src/review.ts (npm run test:review checks they match):
//   • just turned green (interval_days 0): due 5 minutes after state_changed_at
//   • otherwise: due on next_review (a YYYY-MM-DD date, local midnight)
//   • tapped in a video since it fell due (green_revealed_at) → shows green,
//     but it still needs a flashcard review.
const FIRST_REVIEW_MS = 5 * 60 * 1000;
function reviewDueAt(row) {
  if (coerceState(row.state) !== 'green') return null;
  if ((row.interval_days ?? 1) === 0 && row.state_changed_at) return Date.parse(row.state_changed_at) + FIRST_REVIEW_MS;
  if (!row.next_review) return null;
  const [y, m, d] = String(row.next_review).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}
function deckState(row, now = Date.now()) {
  const state = coerceState(row.state);
  const at = reviewDueAt(row);
  if (at === null || at > now) return state;
  const tapped = row.green_revealed_at ? Date.parse(row.green_revealed_at) : 0;
  return tapped >= at ? state : 'gold';
}

// If a word has more than one row, the more advanced deck wins so a green
// word is never shown red because of a stray duplicate.
const STATE_RANK = { red: 0, orange: 1, green: 2, gold: 2 };
function higherState(current, next) {
  if (!current) return next;
  return STATE_RANK[next] > STATE_RANK[current] ? next : current;
}

// PostgREST returns at most 1000 rows per request; page through the rest.
async function fetchAllSavedWords(query, accessToken) {
  const PAGE = 1000;
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    // Ordered, so a word can't fall between two pages while the table is read.
    const res = await rest(`${query}&order=id.asc&limit=${PAGE}&offset=${offset}`, accessToken);
    if (!res.ok) throw new Error(`Failed to load saved_words (${res.status})`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

// The learner's deck for one language: normalizeToken(word) → state.
// green_revealed_at comes from a migration; if a database doesn't have it the
// whole query would fail and every word would lose its colour, so fall back.
let _hasRevealedCol = true;
async function loadDeckIndex(userId, language, accessToken) {
  const base = `saved_words?user_id=eq.${userId}&language=eq.${encodeURIComponent(language)}&select=word,state,next_review,interval_days,state_changed_at`;
  let rows;
  try {
    rows = await fetchAllSavedWords(_hasRevealedCol ? `${base},green_revealed_at` : base, accessToken);
  } catch (e) {
    if (!_hasRevealedCol || !/\(400\)/.test(e?.message || '')) throw e;
    _hasRevealedCol = false;
    rows = await fetchAllSavedWords(base, accessToken);
  }
  const now = Date.now();
  const m = new Map();
  for (const row of rows) {
    const key = normalizeToken(row.word);
    m.set(key, higherState(m.get(key), deckState(row, now)));
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

// The video turned out to be in another language (Spanish subtitles while the
// account was on French). Switch to that deck if the learner has it; else say
// it's missing so the page can offer to add it. Never the learner's own language.
const MAX_LANGUAGES = 5; // same as src/lib/languageProfiles.ts
async function videoLanguage(session, language) {
  const lang = String(language || '').toLowerCase();
  const { languages, nativeLanguage } = await getLanguages(session);
  if (!lang || lang === nativeLanguage) return { ok: false, error: 'native' };
  if (languages.includes(lang)) return { ...(await setLanguage(session, lang)), switched: true };
  return { ok: false, error: 'missing', language: lang, languages, canAdd: languages.length < MAX_LANGUAGES };
}

// A new deck for a language (a language_profiles row, like "Add a language" on
// the website), then watch in it.
async function addLanguage(session, language) {
  const lang = String(language || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(lang)) return { ok: false, error: 'bad_language' };
  const { languages, nativeLanguage } = await getLanguages(session);
  if (lang === nativeLanguage) return { ok: false, error: 'native' };
  if (!languages.includes(lang)) {
    if (languages.length >= MAX_LANGUAGES) return { ok: false, error: 'language_limit_reached' };
    const res = await rest('language_profiles', session.access_token, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: session.user.id, language: lang }),
    });
    if (!res.ok && res.status !== 409) return { ok: false, error: `Couldn’t add the language (${res.status})` };
    invalidateLanguages();
  }
  return setLanguage(session, lang);
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

// ─── Instant meanings: the built-in French→English word pack (no network) ─────
// extension/dict/fr-en.v1.json is the same 11,000+ word pack the website player
// and the Android bubble use (scripts/sync-instant-dict.mjs). A tapped French word
// is answered from memory in a couple of milliseconds; anything else goes to Google.
let _pack = null;
function loadPack() {
  if (!_pack) {
    _pack = fetch(chrome.runtime.getURL('dict/fr-en.v1.json'))
      .then((r) => r.json())
      .then((j) => new Map(Object.entries(j.words || {})))
      .catch(() => { _pack = null; return null; });
  }
  return _pack;
}
const packKey = (w) => String(w || '').toLowerCase()
  .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, '').trim();
async function instantMeaning(text, sl, tl) {
  if (sl !== 'fr' || tl !== 'en' || /\s/.test(String(text || '').trim())) return null;
  const key = packKey(text);
  // Numbers aren't translated, just written the same way — instant, no pack or network needed.
  if (/^\d+%?$/.test(key)) return String(text).trim();
  const pack = await loadPack();
  if (!pack) return null;
  const hit = pack.get(key);
  if (hit) return hit;
  const raw = String(text).toLowerCase().replace(/’/g, "'").replace(/[.,!?;:"`«»()\[\]…]/g, '').trim();
  const m = raw.match(/^(c|j|l|d|n|s|m|t|qu|jusqu|lorsqu|puisqu)'(.+)$/);
  return m ? (pack.get(packKey(m[2])) || null) : null;
}
loadPack(); // warm it when the service worker starts

// ─── Ringed words: the app's common-words decks, 50 at a time ────────────────
// core_vocabulary ranked by frequency is what the app's Common Words decks
// (Top 50, 100, 150…) are built from. The extension circles the words of the
// learner's CURRENT deck only: the first block of 50 that still has a word not
// in their decks. Once every Top 50 word is saved it moves on to Top 100, and
// so on, like the decks on /common-words. Readable without logging in (then
// it's always Top 50). The pop-up switch "Circle common words" (ls_rings)
// turns it off.
const RING_STEP = 50;
// Rings are only for languages that are written with spaces between words, in
// the Latin alphabet, where the frequency list's words match what the subtitles
// are split into. Japanese, Chinese and Thai are split by Intl.Segmenter into
// pieces that don't line up with the list yet, so they get no rings for now.
const RING_LANGS = new Set(['fr', 'es', 'de', 'it', 'pt', 'en', 'nl', 'pl', 'sv']);
const COMMON_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const _commonCache = new Map(); // language → { ts, words: [{ word, rank }] }
const SEGMENTED = new Set(['zh', 'ja', 'th']);

async function getCommonWords(lang) {
  const hit = _commonCache.get(lang);
  if (hit && Date.now() - hit.ts < COMMON_CACHE_TTL_MS) return hit.words;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/core_vocabulary?language=eq.${encodeURIComponent(lang)}&select=word,rank&order=rank.asc&limit=3000`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
  ).catch(() => null);
  if (!res?.ok) return hit?.words || [];
  const seen = new Set();
  const words = [];
  for (const row of await res.json()) {
    const w = normalizeToken(row.word);
    // Phrases can't match a single subtitle word; single letters are mostly noise.
    if (!w || seen.has(w) || /\s/.test(w) || (!SEGMENTED.has(lang) && w.length < 2)) continue;
    seen.add(w);
    words.push({ word: w, rank: Number(row.rank) || words.length + 1 });
  }
  if (words.length) _commonCache.set(lang, { ts: Date.now(), words });
  return words;
}

async function getRingPool(language) {
  const session = await getValidSession().catch(() => null);
  let lang = String(language || '').toLowerCase();
  let deck = new Map();
  if (session) {
    const langs = await getLanguages(session);
    if (!langs.languages.includes(lang)) lang = langs.language || lang;
    if (lang) deck = await getDeckIndexCached(session.user.id, lang, session.access_token);
  }
  if (!lang || !RING_LANGS.has(lang)) return { ok: true, words: [], language: lang, band: 0, left: 0 };
  const common = await getCommonWords(lang);
  // The current deck: the block of 50 holding the most frequent unsaved word.
  const first = common.find((c) => !deck.has(c.word));
  if (!first) return { ok: true, words: [], language: lang, band: 0, left: 0, done: common.length > 0 };
  const band = Math.ceil(first.rank / RING_STEP) * RING_STEP;
  const words = common.filter((c) => c.rank <= band && !deck.has(c.word)).map((c) => c.word);
  return { ok: true, words, language: lang, band, left: words.length };
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

// A hiccup (network, server error, rate limit) is worth one quiet retry; a
// real rejection (logged out, wrong language) is not. Saving is safe to repeat:
// a word that already exists is only touched, never duplicated.
async function saveWord(msg) {
  try {
    return await saveWordOnce(msg);
  } catch (e) {
    const message = e?.message || 'Network error';
    return { ok: false, error: message, transient: !/log(ged)? ?in|expired/i.test(message) };
  }
}

async function saveWordOnce(msg) {
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
    translation = (await instantMeaning(word, lang, profile.nativeLanguage || 'en'))
      || (await gtxTranslate(word, lang, profile.nativeLanguage || 'en').catch(() => null)) || '';
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
    is_phrase: /\s/.test(word),
  };
  const insertRes = await rest('saved_words', token, {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('[LinguaScript] save failed:', insertRes.status, err);
    return { ok: false, error: `Couldn’t save (${insertRes.status})`, transient: insertRes.status >= 500 || insertRes.status === 429 };
  }
  invalidateDeckCache();
  // Matches XP_SAVE in ls-core.js; add_word is 20 in the app too.
  const xp = 20;
  const xpTotal = await awardXp(session, xp, { source: 'extension' }).catch(() => null);
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
      return reply(openSiteSignIn(), sendResponse);

    // linguascript.co.uk (signed in, opened with ?ext=1) signs the extension in.
    case 'SITE_SESSION':
      if (!/^https:\/\/(www\.)?linguascript\.co\.uk$/.test(sender.origin || '') || !msg.tokenHash) return false;
      return reply((async () => {
        const res = await storeSession(await sessionFromTokenHash(String(msg.tokenHash)));
        const { ls_sign_in: pending } = await chrome.storage.session.get('ls_sign_in').catch(() => ({}));
        // Only the tab the pop-up opened goes away; a learner signing in on the site normally keeps theirs.
        if (pending && pending.tabId === sender.tab?.id) backToVideo(sender.tab.id);
        return res;
      })(), sendResponse);

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

    case 'VIDEO_LANGUAGE':
      return reply((async () => videoLanguage(await getValidSession(), msg.language))(), sendResponse);

    case 'ADD_LANGUAGE':
      return reply((async () => addLanguage(await getValidSession(), msg.language))(), sendResponse);

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
        const translation = (await instantMeaning(msg.text, sl, msg.targetLang))
          || (await gtxTranslate(msg.text, sl, msg.targetLang).catch(() => null));
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

    // The next common words to ring for this language.
    case 'GET_RING_POOL':
      return reply(getRingPool(msg.language), sendResponse);

    case 'SYNC_VIDEO_SITES':
      return reply(syncVideoSites().then(() => ({ ok: true })), sendResponse);

    case 'ENABLE_VIDEO_TAB':
      return reply(enableVideoTab(msg.tabId), sendResponse);

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

// ─── Reader: pillar 1 on ANY website ────────────────────────────────────────────
// Injected only when the learner presses Alt+L, using
// activeTab — no "read all your data on all websites" permission.
const READER_FILES = ['ls-core.js', 'adapters/reader.js'];
const CAN_INJECT = (url) => /^https?:/.test(url || '') && !/^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)/.test(url || '');

async function toggleReader(tabId) {
  if (!tabId) return { ok: false, error: 'No tab' };
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !CAN_INJECT(tab.url)) return { ok: false, error: 'LinguaScript can’t read this page' };
  await chrome.scripting.executeScript({ target: { tabId }, files: READER_FILES });
  return { ok: true };
}

// Reading on any site is switched on with Alt+L only for now (no menus, no pop-up button).
chrome.commands?.onCommand.addListener((command, tab) => {
  if (command === 'toggle-reader' && tab?.id) toggleReader(tab.id).catch(() => {});
});

// ─── Right-click "Add to LinguaScript" on any site ──────────────────────────────
// Highlighting shows a button on supported sites; everywhere else the learner
// right-clicks the highlighted word. Uses activeTab, so no extra site access.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({ id: 'ls-add-selection', title: 'Add "%s" to LinguaScript flashcards', contexts: ['selection'] }, () => void chrome.runtime.lastError);
});
chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'ls-add-selection' || !tab?.id || !CAN_INJECT(tab.url)) return;
  const target = { tabId: tab.id, frameIds: [info.frameId || 0] };
  await chrome.scripting.executeScript({ target, files: ['ls-core.js'] }).catch(() => {});
  await chrome.scripting.executeScript({ target, func: (text) => window.LSCore?.saveSelectionNow(text), args: [info.selectionText || ''] }).catch(() => {});
});

// ─── Any video site: Stremio Web, TikTok, Dailymotion, … ───────────────────────
// YouTube, Netflix, Crunchyroll and TV5MONDE are in manifest.json. Every other
// site is switched on by the learner in the pop-up (an optional permission for
// just that site, asked at their click — no "all websites" warning at install).
// We then register the same caption catcher + universal adapter there, so it
// keeps working after a restart.
const BUILT_IN_ORIGINS = new Set([
  ...(chrome.runtime.getManifest().host_permissions || []),
  ...(chrome.runtime.getManifest().content_scripts || []).flatMap((c) => c.matches || []),
]);
const VIDEO_FILES = ['ls-core.js', 'sites.js', 'subtitles.js', 'adapters/universal.js'];
const VIDEO_SCRIPT_IDS = ['ls-video-hook', 'ls-video'];

async function videoOrigins() {
  const { origins = [] } = await chrome.permissions.getAll();
  // Only single sites the learner chose — never a blanket "all sites" grant.
  return origins.filter((o) => /^https?:\/\/[^*/]/.test(o) || /^https?:\/\/\*\.[^/]+\//.test(o))
    .filter((o) => !BUILT_IN_ORIGINS.has(o));
}

// Install, startup and permission events can fire together: run one at a time.
let syncChain = Promise.resolve();
function syncVideoSites() {
  syncChain = syncChain.catch(() => {}).then(doSyncVideoSites);
  return syncChain;
}

async function doSyncVideoSites() {
  const wanted = await videoOrigins();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: VIDEO_SCRIPT_IDS }).catch(() => []);
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) }).catch(() => {});
  if (!wanted.length) return;
  await chrome.scripting.registerContentScripts([
    { id: 'ls-video-hook', matches: wanted, js: ['caption-hook.js'], world: 'MAIN', runAt: 'document_start', allFrames: true },
    { id: 'ls-video', matches: wanted, js: VIDEO_FILES, runAt: 'document_idle', allFrames: true },
  ]);
}

// Right after the learner switches a site on: start in the open tab too, no
// reload needed. (The catcher only sees subtitle files fetched from now on, so
// re-picking subtitles in the player, or a reload, fills in canvas subtitles.)
async function enableVideoTab(tabId) {
  await syncVideoSites();
  if (!tabId) return { ok: true };
  const target = { tabId, allFrames: true };
  await chrome.scripting.executeScript({ target, files: ['caption-hook.js'], world: 'MAIN' }).catch(() => {});
  await chrome.scripting.executeScript({ target, files: VIDEO_FILES }).catch(() => {});
  return { ok: true };
}

chrome.runtime.onInstalled.addListener(() => { syncVideoSites().catch(() => {}); });
chrome.runtime.onStartup?.addListener(() => { syncVideoSites().catch(() => {}); });
chrome.permissions.onAdded.addListener(() => { syncVideoSites().catch(() => {}); });
chrome.permissions.onRemoved.addListener(() => { syncVideoSites().catch(() => {}); });
