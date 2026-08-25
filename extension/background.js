// LinguaScript Background Service Worker

// ── Keep service worker alive (MV3 SWs sleep after 30s) ──────────────────
// Method 1: Alarms (most reliable — fires every 20s to keep SW warm)
chrome.alarms.create('ls-keepalive', { periodInMinutes: 1 / 3 }); // every 20s
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'ls-keepalive') {
    // Just being here keeps the SW alive
    console.debug('[LS] SW keepalive ping');
  }
});

// Method 2: Port connections from content scripts
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'ls-keepalive') {
    port.onDisconnect.addListener(() => {});
  }
});

const SUPABASE_URL = 'https://ffephracinqeylfhqkiz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA';
const STORAGE_KEY = 'ls_subtitle_lines';

// ─── Auth ────────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || 'Sign-in failed');
  return data; // { access_token, refresh_token, user }
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Session refresh failed');
  return data;
}

async function getValidSession() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['ls_session'], async ({ ls_session }) => {
      if (!ls_session) return reject(new Error('Not logged in'));

      const expiresAt = ls_session.expires_at * 1000;
      if (Date.now() < expiresAt - 60000) {
        return resolve(ls_session);
      }

      try {
        const refreshed = await refreshSession(ls_session.refresh_token);
        const newSession = {
          ...refreshed,
          expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
        };
        chrome.storage.local.set({ ls_session: newSession });
        resolve(newSession);
      } catch (e) {
        chrome.storage.local.remove('ls_session');
        reject(new Error('Session expired — please log in again'));
      }
    });
  });
}

// ─── Word extraction ──────────────────────────────────────────────────────────

function extractWords(lines) {
  const stopWords = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'is','it','he','she','we','they','you','i','me','him','her','us','them',
    'my','your','his','its','our','their','this','that','these','those',
    'be','do','have','will','would','could','should','may','might','can',
    'was','were','are','am','been','being','had','has','did','does',
    'not','no','so','as','up','out','if','then','than','when','where',
    'how','what','who','which','there','here','just','been','very',
  ]);

  const wordMap = new Map(); // word → context (first subtitle line it appeared in)

  for (const line of lines) {
    const tokens = line
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ÿÀ-ɏ一-鿿぀-ヿ가-힯\s'-]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(/^['-]+|['-]+$/g, '').trim())
      .filter(w => w.length >= 3 && !stopWords.has(w));

    for (const word of tokens) {
      if (!wordMap.has(word)) {
        wordMap.set(word, line); // store original line as context
      }
    }
  }

  return wordMap;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

// Normalise a token to its match key. MUST stay byte-for-byte identical to
// normalizeToken() in src/lib/vocab.ts — the app and the extension share one
// keyspace, so any divergence here silently breaks cross-context matching
// (dedup on sync, and colour lookups for GET_DECK_STATE).
function normalizeToken(raw) {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…]/g, '')
    .trim();
}

// Coerce any stored value into a valid deck state (matches coerceDeckState).
function coerceState(raw) {
  return raw === 'green' ? 'green' : raw === 'orange' ? 'orange' : 'red';
}

// Deck order: green (known) > orange (learning) > red (new). When the same
// token maps to more than one row — e.g. the word exists in more than one
// language deck, or a stray duplicate — the MORE-ADVANCED state must win so a
// word the user has mastered (green) is never dragged back to red by a lower
// entry. Without this, unordered rows let whichever row lands last decide the
// colour, which is exactly how green words like "le"/"la"/"des" showed red.
const STATE_RANK = { red: 0, orange: 1, green: 2 };

// Fetch every row of a saved_words query, paging past PostgREST's default
// 1000-row cap. A heavy learner can have thousands of saved words (this user
// has ~3.5k); a single un-paged request silently returns only the first 1000,
// so the rest of the deck never gets coloured (they render as unseen) and sync
// re-inserts already-saved words. Loop with limit/offset until a short page.
async function fetchAllSavedWords(query, accessToken) {
  const PAGE = 1000;
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const sep = query.includes('?') ? '&' : '?';
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${query}${sep}limit=${PAGE}&offset=${offset}`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Failed to load saved_words (${res.status})`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

// True when a word is green in the deck but the learner hasn't seen it turn.
// Byte-for-byte the same rule as isPendingGreen() in src/lib/goldenReveal.ts —
// compares green_revealed_at against state_changed_at (falling back to
// created_at) rather than a boolean, so a word that slips back to orange and
// is re-promoted re-arms the gold automatically. `undefined` (column not
// selected / migration not applied) means "no gold", never "gold" — the same
// safety catch the website relies on.
function isPendingGreen(row) {
  if (!row || row.state !== 'green') return false;
  if (row.green_revealed_at === undefined) return false;
  if (row.green_revealed_at === null) return true;
  const promoted = row.state_changed_at || row.created_at;
  if (!promoted) return false;
  return new Date(row.green_revealed_at).getTime() < new Date(promoted).getTime();
}

// Load the user's saved words for one language as a Map keyed by
// normalizeToken(word) → { state, id, gold }. Scoped by language to mirror
// the app's loadDeckIndex and the DB unique index (user_id, word, language):
// the same word can legitimately live in two languages, so dedup and
// colouring are per-language.
async function loadDeckIndex(userId, language, accessToken) {
  const rows = await fetchAllSavedWords(
    `saved_words?user_id=eq.${userId}&language=eq.${encodeURIComponent(language)}&select=id,word,state,state_changed_at,created_at,green_revealed_at`,
    accessToken
  );
  const m = new Map();
  for (const row of rows) {
    const key = normalizeToken(row.word);
    const state = coerceState(row.state);
    const existing = m.get(key);
    // Same higher-state-wins rule as before, now carried alongside id/gold so
    // a duplicate token can't leave a stale id pointing at the wrong row.
    if (!existing || STATE_RANK[state] > STATE_RANK[existing.state]) {
      m.set(key, { state, id: row.id, gold: isPendingGreen(row) });
    }
  }
  return m;
}

// ─── Deck index cache ─────────────────────────────────────────────────────────
// Content scripts ask for the deck index on every subtitle change; refetching
// from Supabase each time would be dozens of requests per line. Cache the map
// per (user, language) for a short TTL. Because the MV3 service worker can't
// hold a Supabase realtime subscription, this TTL is also how quickly colours
// refresh in the player after a review in the app — 10s keeps it feeling live
// without hammering the API. syncWords() invalidates the cache immediately so
// freshly-saved words show as red without waiting for the TTL.
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

// ─── Authoritative learning language ────────────────────────────────────────
// THE fix that made the website work: colour the deck for the language the user
// is actually learning — the same language their words are saved under — read
// from profiles.learning_language (exactly what the web app's LanguageContext
// reads). The extension popup's ls_language picker is unreliable (its default
// disagreed with the content scripts, and users rarely set it), so trusting it
// scoped the deck to the wrong language and returned an empty deck — no orange
// or green. We resolve the real learning language here and only fall back to
// the popup value if the profile has none.
const LANG_CACHE_TTL_MS = 60000;
let _langCache = { userId: null, lang: null, ts: 0 };

async function getLearningLanguage(userId, accessToken) {
  if (_langCache.userId === userId && _langCache.lang && Date.now() - _langCache.ts < LANG_CACHE_TTL_MS) {
    return _langCache.lang;
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=learning_language`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } }
    );
    const rows = await res.json();
    const raw = Array.isArray(rows) && rows[0]?.learning_language;
    const lang = raw ? String(raw).toLowerCase() : null;
    _langCache = { userId, lang, ts: Date.now() };
    return lang;
  } catch {
    return null;
  }
}

async function insertWords(rows, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/saved_words`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Insert failed: ${err}`);
  }
  return rows.length;
}

// ─── Sync logic ───────────────────────────────────────────────────────────────

async function syncWords(language) {
  const session = await getValidSession();
  const userId = session.user.id;
  const accessToken = session.access_token;

  const { [STORAGE_KEY]: lines } = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  if (lines.length === 0) return { synced: 0, message: 'No subtitles captured yet' };

  const wordMap = extractWords(lines);
  if (wordMap.size === 0) return { synced: 0, message: 'No words extracted' };

  const lang = language || 'es';
  // Load the full deck index (word → state) so we skip anything the user has
  // already saved in ANY state — red, orange, or green — not just words that
  // happen to still be red. Prevents duplicates when a reviewed word (now
  // orange/green) reappears in later subtitles.
  const deckIndex = await loadDeckIndex(userId, lang, accessToken);

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const rows = [];
  for (const [word, context] of wordMap.entries()) {
    if (deckIndex.has(normalizeToken(word))) continue;
    rows.push({
      user_id: userId,
      word,
      language: lang,
      context,
      translation: '',
      ipa: '',
      pronunciation: '',
      next_review: yesterday,
      interval_days: 0,
      review_count: 0,
      ease_factor: 2.5,
      state: 'red', // explicit: newly saved words start in the red deck
    });
  }

  if (rows.length === 0) return { synced: 0, message: 'All words already saved' };

  // Insert in batches of 100 to stay within request limits
  const BATCH = 100;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    total += await insertWords(rows.slice(i, i + BATCH), accessToken);
  }

  // Clear captured lines after successful sync
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });

  // Freshly-saved words are now in the deck as red — drop the cache so the
  // player recolours them on the next subtitle without waiting for the TTL.
  invalidateDeckCache();

  return { synced: total, message: `Synced ${total} new words to LinguaScript` };
}

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SIGN_IN') {
    signIn(msg.email, msg.password)
      .then(data => {
        const session = {
          ...data,
          expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        };
        chrome.storage.local.set({ ls_session: session });
        sendResponse({ ok: true, displayName: data.user?.email });
      })
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'SIGN_OUT') {
    chrome.storage.local.remove('ls_session');
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GET_AUTH') {
    chrome.storage.local.get(['ls_session'], ({ ls_session }) => {
      sendResponse({ session: ls_session || null });
    });
    return true;
  }

  if (msg.type === 'SYNC') {
    syncWords(msg.language)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'GET_STATS') {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, ({ [STORAGE_KEY]: lines }) => {
      const wordMap = extractWords(lines);
      sendResponse({ lines: lines.length, words: wordMap.size });
    });
    return true;
  }

  if (msg.type === 'CLEAR') {
    chrome.storage.local.set({ [STORAGE_KEY]: [] });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'WORD_DETAIL') {
    const { word, sourceLang = 'fr', targetLang = 'en' } = msg;
    (async () => {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=ss&dt=ex&q=${encodeURIComponent(word)}`;
        const res = await fetch(url);
        const data = await res.json();

        // Translation
        const translation = (data[0] || []).map(c => c?.[0] || '').join('').trim();

        // Synonyms — data[1]: array of [pos, null, [[word,...], score, gender], ...]
        const synonymGroups = [];
        if (Array.isArray(data[1])) {
          for (const group of data[1]) {
            const pos = group[0] || '';
            const words = [];
            const entries = group[2] || [];
            for (const entry of entries) {
              const list = Array.isArray(entry[0]) ? entry[0] : [];
              words.push(...list.filter(w => typeof w === 'string'));
            }
            if (words.length) synonymGroups.push({ pos, words: words.slice(0, 8) });
          }
        }

        // Examples — data[11]: array of [example_html, source_html]
        const examples = [];
        if (Array.isArray(data[11])) {
          for (const ex of data[11].slice(0, 3)) {
            const raw = (ex[0] || '').replace(/<b>/g, '').replace(/<\/b>/g, '').replace(/<[^>]+>/g, '').trim();
            if (raw) examples.push(raw);
          }
        }

        sendResponse({ ok: true, translation, synonymGroups, examples });
      } catch(e) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (msg.type === 'TRANSLATE') {
    const { text, targetLang, sourceLang = 'auto' } = msg;
    (async () => {
      const sl = (sourceLang && sourceLang !== 'auto') ? sourceLang : 'fr';

      // ── Slot for DeepL (fastest, ~150ms) — add key when available ───────────
      // const DEEPL_KEY = 'your-deepl-free-key-here';
      // try {
      //   const res = await fetch('https://api-free.deepl.com/v2/translate', {
      //     method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}` },
      //     body: JSON.stringify({ text: [text], source_lang: sl.toUpperCase(), target_lang: targetLang.toUpperCase() }),
      //   });
      //   const data = await res.json();
      //   const tr = data?.translations?.[0]?.text;
      //   if (tr) { sendResponse({ ok: true, translation: tr }); return; }
      // } catch(e) {}

      const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));

      // 1. Google GTX — fast (~200ms), hard 2s timeout
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
        const gRes = await Promise.race([fetch(gUrl), timeout(2000)]);
        if (gRes.ok) {
          const data = await gRes.json();
          const tr = (data[0] || []).map(c => c?.[0] || '').join('').trim();
          if (tr && tr.toLowerCase() !== text.toLowerCase()) {
            sendResponse({ ok: true, translation: tr }); return;
          }
        }
      } catch(e) {}

      // 2. MyMemory — fallback, 4s timeout
      try {
        const mmRes = await Promise.race([
          fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${targetLang}`),
          timeout(4000)
        ]);
        const mmData = await mmRes.json();
        const tr = mmData?.responseData?.translatedText;
        if (tr && !tr.startsWith('MYMEMORY WARNING') && tr.toLowerCase() !== text.toLowerCase()) {
          sendResponse({ ok: true, translation: tr }); return;
        }
      } catch(e) {}

      sendResponse({ ok: false, translation: null });
    })();
    return true;
  }

  // ── THE deck colour source ─────────────────────────────────────────────────
  // Returns the user's flashcard deck for ONE language as { normalizedWord:
  // state }, exactly mirroring what the app's Flashcards page shows: that page
  // scopes saved_words by learningLanguage (Flashcards.tsx), so we scope here by
  // the same language — this is what guarantees a word wears the SAME colour in
  // the overlay as on its flashcard. loadDeckIndex() does the paginated,
  // normalized, highest-state-wins build; getDeckIndexCached() serves it from a
  // short-TTL cache and is force-refreshed by the content script on demand.
  if (msg.type === 'GET_DECK') {
    (async () => {
      const session = await getValidSession().catch(() => null);
      if (!session) {
        console.warn('[LinguaScript] GET_DECK: not logged in — open the extension popup and sign in.');
        return sendResponse({ ok: false, deck: {} });
      }
      try {
        // Authoritative language from profiles.learning_language (like the web
        // app); the popup's ls_language is only a fallback.
        const profileLang = await getLearningLanguage(session.user.id, session.access_token);
        const lang = profileLang || msg.language || 'fr';
        const index = await getDeckIndexCached(session.user.id, lang, session.access_token, { force: !!msg.force });
        // Temporary diagnostic — read in the service-worker console.
        let r = 0, o = 0, g = 0, gold = 0;
        index.forEach((v) => { v.state === 'green' ? g++ : v.state === 'orange' ? o++ : r++; if (v.gold) gold++; });
        console.log(`[LinguaScript] GET_DECK: profileLang=${profileLang || '(none)'} → using '${lang}', ${index.size} words {red:${r}, orange:${o}, green:${g}, gold:${gold}}`);
        const deck = {};
        index.forEach((v, word) => { deck[word] = { state: v.state, id: v.id, gold: v.gold }; });
        sendResponse({ ok: true, deck, language: lang });
      } catch (e) {
        console.warn('[LinguaScript] GET_DECK error:', e?.message || e);
        sendResponse({ ok: false, deck: {} });
      }
    })();
    return true;
  }

  // ── Gold word claim / decay — mirrors reveal_green_word() / touch_gold_word()
  // via the exact same RPCs the website's src/lib/goldenReveal.ts calls. ──────
  async function callRpc(fnName, args, accessToken) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`RPC ${fnName} failed (${res.status})`);
    return res.json();
  }

  if (msg.type === 'CLAIM_GOLD') {
    getValidSession()
      .then(async (session) => {
        const data = await callRpc('reveal_green_word', { p_word_id: msg.wordId }, session.access_token);
        sendResponse({ ok: true, revealed: !!data?.revealed, awardedXp: data?.awarded_xp || 0 });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'TOUCH_GOLD') {
    getValidSession()
      .then(async (session) => {
        const data = await callRpc('touch_gold_word', { p_word_id: msg.wordId, p_decay_at: msg.decayAt || 3 }, session.access_token);
        sendResponse({ ok: true, seen: data?.seen ?? 0, claimed: !!data?.auto_revealed });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  // ── Mark known — mirrors markWordKnown() in src/pages/Watch.tsx: an upsert
  // straight into the green deck, keyed the same way (user_id, word, language)
  // so it lands on the exact row the website's own "mark known" would touch. ──
  if (msg.type === 'MARK_KNOWN') {
    getValidSession()
      .then(async (session) => {
        const word = (msg.word || '').trim().toLowerCase();
        if (!word) return sendResponse({ ok: false, error: 'Empty word' });
        const lang = (await getLearningLanguage(session.user.id, session.access_token)) || msg.language || 'fr';
        const res = await fetch(`${SUPABASE_URL}/rest/v1/saved_words?on_conflict=user_id,word,language`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            user_id: session.user.id,
            word,
            translation: msg.translation || '',
            context: msg.context || '',
            language: lang,
            state: 'green',
            state_changed_at: new Date().toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          return sendResponse({ ok: false, error: `DB error ${res.status}: ${err}` });
        }
        invalidateDeckCache();
        sendResponse({ ok: true });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  // ── XP + levelling — mirrors src/lib/xp.ts / XpContext.tsx's award(). ──────
  // The front-loaded onboarding ramp and endless progression past it are
  // ported verbatim from xp.ts; drift here would mean an extension learner
  // levels up on a different total than the website would show for the same
  // XP, which is exactly the kind of cross-surface inconsistency this whole
  // pass exists to close.
  const XP_LEVEL_THRESHOLDS = [0, 20, 50, 95, 160, 250, 380, 560, 820, 1200];
  const XP_ENDLESS_BASE_GAP = 600;
  const XP_ENDLESS_GROWTH = 1.08;
  const XP_ENDLESS_MAX_GAP = 25000;
  function levelFromXP(xp) {
    const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
    const thresholds = [...XP_LEVEL_THRESHOLDS];
    let gap = XP_ENDLESS_BASE_GAP;
    while (thresholds[thresholds.length - 1] <= total) {
      thresholds.push(thresholds[thresholds.length - 1] + Math.round(gap));
      gap = Math.min(gap * XP_ENDLESS_GROWTH, XP_ENDLESS_MAX_GAP);
    }
    let lo = 0, hi = thresholds.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (thresholds[mid] <= total) lo = mid; else hi = mid - 1;
    }
    return { level: lo + 1, current: total - thresholds[lo], nextLevelXP: (thresholds[lo + 1] ?? thresholds[lo]) - thresholds[lo] };
  }
  function xpForAction(action) {
    switch (action) {
      case 'add_word': return 20;
      case 'video_watch': return 10;
      case 'reinforcement': return 5;
      case 'line_blast': return 15;
      default: return 0;
    }
  }
  // In-memory per-user XP cache so repeated awards in one session (e.g. every
  // combo step of a Line Blast) don't each re-fetch the profile — mirrors
  // XpContext's xpRef. Cold on service-worker restart, which just means the
  // next award re-syncs from the DB first (harmless: it can only under- not
  // over-count a level-up).
  let _xpCache = { userId: null, total: null, level: 1 };
  async function currentXp(userId, accessToken) {
    if (_xpCache.userId === userId && _xpCache.total != null) return _xpCache;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=xp_total`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    const rows = await res.json();
    const total = Array.isArray(rows) && rows[0]?.xp_total != null ? rows[0].xp_total : 0;
    _xpCache = { userId, total, level: levelFromXP(total).level };
    return _xpCache;
  }

  if (msg.type === 'AWARD_XP') {
    getValidSession()
      .then(async (session) => {
        const amount = xpForAction(msg.action);
        if (amount <= 0) return sendResponse({ ok: true, amount: 0, leveledUp: false });
        const userId = session.user.id;
        const before = await currentXp(userId, session.access_token);
        const newTotal = before.total + amount;
        const { level: newLevel } = levelFromXP(newTotal);
        const leveledUp = newLevel > before.level;
        _xpCache = { userId, total: newTotal, level: newLevel };

        // Persist — same two writes as persistXP() in xp.ts (profile total +
        // an xp_events row), fired without blocking the response.
        fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ xp_total: newTotal, xp_level: newLevel }),
        }).catch((e) => console.warn('[LinguaScript] xp_total update failed', e));
        fetch(`${SUPABASE_URL}/rest/v1/xp_events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ user_id: userId, action: msg.action, amount }),
        }).catch((e) => console.warn('[LinguaScript] xp_events insert failed', e));

        sendResponse({ ok: true, amount, newTotal, newLevel, leveledUp, from: before.level });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'SAVE_WORD') {
    getValidSession()
      .then(async (session) => {
        const userId = session.user.id;
        const accessToken = session.access_token;
        const word = (msg.word || '').trim().toLowerCase();
        if (!word) return sendResponse({ ok: false, error: 'Empty word' });

        // Check not already saved
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/saved_words?user_id=eq.${userId}&word=eq.${encodeURIComponent(word)}&select=id`,
          { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${accessToken}` } }
        );
        const existing = await checkRes.json();
        if (existing?.length > 0) return sendResponse({ ok: true, already: true });

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        // Save into the SAME deck the app uses (profiles.learning_language) so a
        // word saved from the overlay lands in the language it will be coloured
        // and reviewed under; fall back to the content script's hint.
        const saveLang = (await getLearningLanguage(userId, accessToken)) || msg.language || 'fr';
        const row = {
          user_id: userId,
          word,
          language: saveLang,
          context: msg.context || '',
          translation: msg.translation || '',
          ipa: '',
          pronunciation: '',
          next_review: yesterday,
          interval_days: 0,
          review_count: 0,
          ease_factor: 2.5,
        };

        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/saved_words`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(row),
        });

        if (!insertRes.ok) {
          const err = await insertRes.text();
          console.error('[LS] SAVE_WORD insert failed:', insertRes.status, err);
          return sendResponse({ ok: false, error: `DB error ${insertRes.status}: ${err}` });
        }

        // Verify the row landed by immediately re-fetching it
        const verifyRes = await fetch(
          `${SUPABASE_URL}/rest/v1/saved_words?user_id=eq.${userId}&word=eq.${encodeURIComponent(word)}&select=id,word,user_id`,
          { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${accessToken}` } }
        );
        const verified = await verifyRes.json();
        const landed = Array.isArray(verified) && verified.length > 0;
        // Drop the cached deck so the newly-saved (red) word colours on the very
        // next GET_DECK instead of waiting out the TTL.
        invalidateDeckCache();
        sendResponse({ ok: true, landed, userId });
      })
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'GET_SAVED_COUNT') {
    getValidSession()
      .then(async (session) => {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/saved_words?user_id=eq.${session.user.id}&select=id`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${session.access_token}`,
              'Prefer': 'count=exact',
              'Range': '0-0',
            },
          }
        );
        const countHeader = res.headers.get('Content-Range');
        const total = countHeader ? parseInt(countHeader.split('/')[1], 10) : 0;
        sendResponse({ ok: true, count: total, userId: session.user.id, email: session.user.email });
      })
      .catch(e => sendResponse({ ok: false, count: 0, error: e.message }));
    return true;
  }
});
