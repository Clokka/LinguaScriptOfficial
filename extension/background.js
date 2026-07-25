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

// Load the user's saved words for one language as a Map keyed by
// normalizeToken(word) → state ('red' | 'orange' | 'green'). Scoped by
// language to mirror the app's loadDeckIndex and the DB unique index
// (user_id, word, language): the same word can legitimately live in two
// languages, so dedup and colouring are per-language.
async function loadDeckIndex(userId, language, accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/saved_words?user_id=eq.${userId}&language=eq.${encodeURIComponent(language)}&select=word,state`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to load deck index');
  const m = new Map();
  for (const row of data) {
    // Coerce to a valid state, defaulting to red (matches coerceDeckState).
    const state = row.state === 'green' ? 'green' : row.state === 'orange' ? 'orange' : 'red';
    m.set(normalizeToken(row.word), state);
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

  // Bulk deck lookup for content scripts: returns the whole word→state map for
  // one language as a plain object. Content scripts call this once per subtitle
  // batch and look words up locally (see Section 3). Served from the cache.
  if (msg.type === 'GET_DECK_INDEX') {
    (async () => {
      const session = await getValidSession().catch(() => null);
      if (!session) return sendResponse({ ok: false, index: {} });
      try {
        const lang = msg.language || 'fr';
        const index = await getDeckIndexCached(session.user.id, lang, session.access_token, { force: !!msg.force });
        sendResponse({ ok: true, index: Object.fromEntries(index) });
      } catch (e) {
        sendResponse({ ok: false, index: {}, error: e.message });
      }
    })();
    return true;
  }

  // Single-word convenience lookup, also served from the cached index so it
  // never triggers a per-word network request.
  if (msg.type === 'GET_DECK_STATE') {
    (async () => {
      const session = await getValidSession().catch(() => null);
      if (!session) return sendResponse({ state: null });
      try {
        const lang = msg.language || 'fr';
        const index = await getDeckIndexCached(session.user.id, lang, session.access_token);
        sendResponse({ state: index.get(normalizeToken(msg.word || '')) || null });
      } catch {
        sendResponse({ state: null });
      }
    })();
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

  if (msg.type === 'GET_WORDS') {
    getValidSession()
      .then(async (session) => {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/saved_words?user_id=eq.${session.user.id}&select=word,review_count,interval_days,ease_factor`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` } }
        );
        if (!res.ok) return sendResponse({ ok: false, words: {} });
        const rows = await res.json();
        const words = {};
        for (const r of rows) {
          const count = r.review_count || 0, interval = r.interval_days || 0, ease = r.ease_factor || 2.5;
          words[r.word.toLowerCase()] = (interval >= 21 || (count >= 5 && ease >= 2.5)) ? 'green'
            : (count >= 2 || interval >= 3) ? 'orange' : 'red';
        }
        sendResponse({ ok: true, words });
      })
      .catch(() => sendResponse({ ok: false, words: {} }));
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
        const row = {
          user_id: userId,
          word,
          language: msg.language || 'fr',
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
        console.log('[LS] SAVE_WORD verify:', landed ? 'confirmed in DB' : 'NOT FOUND after insert', verified);
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
