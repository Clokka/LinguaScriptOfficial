// LinguaScript popup: log in, or show today's goal and streak.

const $ = (id) => document.getElementById(id);

const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian', ar: 'Arabic', nl: 'Dutch',
  pl: 'Polish', sv: 'Swedish', tr: 'Turkish', hi: 'Hindi', th: 'Thai',
};

const send = (msg) => new Promise((resolve) => {
  chrome.runtime.sendMessage(msg, (res) => resolve(chrome.runtime.lastError ? null : res));
});

function show(panel) {
  $('auth-panel').classList.toggle('hidden', panel !== 'auth');
  $('main-panel').classList.toggle('hidden', panel !== 'main');
  $('logout-btn').classList.toggle('hidden', panel !== 'main');
}

async function loadToday() {
  const today = await send({ type: 'GET_TODAY' });
  if (!today?.ok) return;
  $('goal-saved').textContent = today.saved;
  $('goal-target').textContent = today.goal;
  $('goal-bar').style.width = `${Math.min(100, Math.round((today.saved / Math.max(1, today.goal)) * 100))}%`;
  $('streak').textContent = today.streak;
  $('lang-label').textContent = today.language ? `Learning ${LANGUAGE_NAMES[today.language] || today.language.toUpperCase()}` : '';
}

async function init() {
  const auth = await send({ type: 'GET_AUTH' });
  if (!auth?.session) { show('auth'); $('email').focus(); return; }
  show('main');
  $('user-email').textContent = auth.session.user?.email || '';
  loadToday();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || !password) { $('auth-error').textContent = 'Enter your email and password.'; return; }
  $('login-btn').disabled = true;
  $('login-btn').textContent = 'Logging in…';
  $('auth-error').textContent = '';
  const res = await send({ type: 'SIGN_IN', email, password });
  $('login-btn').disabled = false;
  $('login-btn').textContent = 'Log in';
  if (!res?.ok) { $('auth-error').textContent = res?.error || 'Login failed. Check your email and password.'; return; }
  $('password').value = '';
  init();
});

$('logout-btn').addEventListener('click', async () => {
  await send({ type: 'SIGN_OUT' });
  show('auth');
});

init();
