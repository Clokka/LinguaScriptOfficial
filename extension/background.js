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

async function fetchExistingWords(userId, accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/saved_words?user_id=eq.${userId}&select=word`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to fetch existing words');
  return new Set(data.map(r => r.word));
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

  const existing = await fetchExistingWords(userId, accessToken);

  const now = new Date().toISOString();
  const rows = [];
  for (const [word, context] of wordMap.entries()) {
    if (existing.has(word)) continue;
    rows.push({
      user_id: userId,
      word,
      language: language || 'es',
      context,
      translation: '',
      ipa: '',
      pronunciation: '',
      next_review: now,
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

  if (msg.type === 'TRANSLATE') {
    const { text, targetLang, sourceLang = 'auto' } = msg;
    (async () => {
      const sl = (sourceLang && sourceLang !== 'auto') ? sourceLang : 'fr';

      // 1. MyMemory — most reliable from service workers
      try {
        const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${targetLang}`;
        console.log('[LS translate] MyMemory:', mmUrl);
        const mmRes = await fetch(mmUrl);
        const mmData = await mmRes.json();
        console.log('[LS translate] MyMemory response:', JSON.stringify(mmData).slice(0, 200));
        const tr = mmData?.responseData?.translatedText;
        if (tr && !tr.startsWith('MYMEMORY WARNING') && tr.toLowerCase() !== text.toLowerCase()) {
          sendResponse({ ok: true, translation: tr });
          return;
        }
      } catch(e) { console.error('[LS translate] MyMemory error:', e.message); }

      // 2. Google Translate gtx
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
        console.log('[LS translate] Google:', gUrl);
        const gRes = await fetch(gUrl);
        console.log('[LS translate] Google status:', gRes.status);
        if (gRes.ok) {
          const data = await gRes.json();
          const tr = (data[0] || []).map(c => c?.[0] || '').join('').trim();
          console.log('[LS translate] Google result:', tr);
          if (tr && tr.toLowerCase() !== text.toLowerCase()) {
            sendResponse({ ok: true, translation: tr });
            return;
          }
        }
      } catch(e) { console.error('[LS translate] Google error:', e.message); }

      // 3. Lingva (alternative Google Translate frontend)
      try {
        const lgUrl = `https://lingva.ml/api/v1/${sl}/${targetLang}/${encodeURIComponent(text)}`;
        console.log('[LS translate] Lingva:', lgUrl);
        const lgRes = await fetch(lgUrl);
        if (lgRes.ok) {
          const data = await lgRes.json();
          const tr = data?.translation;
          console.log('[LS translate] Lingva result:', tr);
          if (tr && tr.toLowerCase() !== text.toLowerCase()) {
            sendResponse({ ok: true, translation: tr });
            return;
          }
        }
      } catch(e) { console.error('[LS translate] Lingva error:', e.message); }

      console.error('[LS translate] All endpoints failed for:', text, sl, '->', targetLang);
      sendResponse({ ok: false, translation: null });
    })();
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

        const now = new Date().toISOString();
        const row = {
          user_id: userId,
          word,
          language: msg.language || 'fr',
          context: msg.context || '',
          translation: msg.translation || '',
          ipa: '',
          pronunciation: '',
          next_review: now,
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
          return sendResponse({ ok: false, error: err });
        }
        sendResponse({ ok: true });
      })
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
