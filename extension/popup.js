// LinguaScript Popup Script

const $ = id => document.getElementById(id);

let isOnNetflix = false;
let statsInterval = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const session = await getAuth();

  if (!session) {
    showPanel('auth');
    return;
  }

  showPanel('main');
  $('user-email').textContent = session.user?.email || '';

  // Fetch live word count + user ID straight from Supabase to confirm DB alignment
  chrome.runtime.sendMessage({ type: 'GET_SAVED_COUNT' }, (res) => {
    if (res?.ok) {
      $('db-word-count').textContent = res.count;
      $('db-user-id').textContent = res.userId || '—';
    } else {
      $('db-word-count').textContent = 'err';
      $('db-user-id').textContent = res?.error || 'failed';
    }
  });

  // Restore saved language preferences
  chrome.storage.local.get({ ls_language: 'es', ls_native_language: 'en' }, ({ ls_language, ls_native_language }) => {
    $('language').value = ls_language;
    $('native-language').value = ls_native_language;
  });

  await checkNetflixTab();
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getAuth() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, ({ session }) => resolve(session));
  });
}

function showPanel(name) {
  $('auth-panel').style.display = name === 'auth' ? 'block' : 'none';
  $('main-panel').style.display = name === 'main' ? 'block' : 'none';
}

// ─── Netflix tab detection ────────────────────────────────────────────────────

async function checkNetflixTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  isOnNetflix = url.includes('netflix.com/watch') || url.includes('youtube.com/watch');

  $('not-netflix').style.display = isOnNetflix ? 'none' : 'block';
  $('netflix-panel').style.display = isOnNetflix ? 'block' : 'none';

  if (isOnNetflix) {
    await refreshStats();
    statsInterval = setInterval(refreshStats, 3000);
  }
}

async function refreshStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, ({ lines, words }) => {
    $('line-count').textContent = lines;
    $('word-count').textContent = words;
  });
}

// ─── Event listeners ─────────────────────────────────────────────────────────

$('login-btn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('password').value;
  const errBox = $('auth-error');

  errBox.style.display = 'none';

  if (!email || !password) {
    errBox.textContent = 'Please enter your email and password.';
    errBox.style.display = 'block';
    return;
  }

  $('login-btn').disabled = true;
  $('login-btn').textContent = 'Logging in…';

  chrome.runtime.sendMessage({ type: 'SIGN_IN', email, password }, async (res) => {
    $('login-btn').disabled = false;
    $('login-btn').textContent = 'Log in to LinguaScript';

    if (!res.ok) {
      errBox.textContent = res.error || 'Login failed. Check your credentials.';
      errBox.style.display = 'block';
      return;
    }

    await init();
  });
});

$('logout-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, () => {
    clearInterval(statsInterval);
    showPanel('auth');
    $('email').value = '';
    $('password').value = '';
  });
});

$('sync-btn').addEventListener('click', () => {
  const language = $('language').value;
  const nativeLanguage = $('native-language').value;

  // Save language preferences
  chrome.storage.local.set({ ls_language: language, ls_native_language: nativeLanguage });

  $('sync-btn').disabled = true;
  $('sync-btn').textContent = 'Syncing…';
  setStatus('Syncing vocabulary…', 'info');

  chrome.runtime.sendMessage({ type: 'SYNC', language }, (res) => {
    $('sync-btn').disabled = false;
    $('sync-btn').textContent = 'Sync to LinguaScript';

    if (!res.ok) {
      setStatus(res.error || 'Sync failed', 'error');
      return;
    }

    setStatus(res.message, res.synced > 0 ? 'success' : 'info');
    refreshStats();
  });
});

$('clear-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR' }, () => {
    refreshStats();
    setStatus('Cleared.', 'info');
  });
});

// Test translation button — works from any page, diagnoses SW + API
document.addEventListener('click', e => {
  if (e.target.id !== 'test-tr-btn') return;
  const btn = e.target;
  btn.textContent = 'Testing…'; btn.disabled = true;
  chrome.runtime.sendMessage({ type: 'TRANSLATE', text: 'bonjour', targetLang: 'en', sourceLang: 'fr' }, res => {
    btn.disabled = false; btn.textContent = '🧪 Test translation';
    if (chrome.runtime.lastError) { setStatus('SW error: ' + chrome.runtime.lastError.message, 'error'); return; }
    if (res?.ok) setStatus('✓ Translation works: "' + res.translation + '"', 'success');
    else setStatus('✗ All translation APIs failed', 'error');
  });
});

// Allow Enter key in login form
$('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('login-btn').click();
});

// ─── Utilities ────────────────────────────────────────────────────────────────

function setStatus(msg, type = 'info') {
  const el = $('status');
  el.textContent = msg;
  el.className = `status-${type}`;
}

// ─── Start ────────────────────────────────────────────────────────────────────

init();
