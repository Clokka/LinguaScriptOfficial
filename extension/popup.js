// LinguaScript popup: log in, or show today's goal and streak.

const $ = (id) => document.getElementById(id);

const LANGUAGES = {
  en: ['English', '🇬🇧'], es: ['Spanish', '🇪🇸'], fr: ['French', '🇫🇷'], de: ['German', '🇩🇪'], it: ['Italian', '🇮🇹'],
  pt: ['Portuguese', '🇵🇹'], ja: ['Japanese', '🇯🇵'], ko: ['Korean', '🇰🇷'], zh: ['Chinese', '🇨🇳'], ru: ['Russian', '🇷🇺'],
  ar: ['Arabic', '🇸🇦'], nl: ['Dutch', '🇳🇱'], pl: ['Polish', '🇵🇱'], sv: ['Swedish', '🇸🇪'], tr: ['Turkish', '🇹🇷'],
  hi: ['Hindi', '🇮🇳'], th: ['Thai', '🇹🇭'],
};
const langLabel = (c) => `${LANGUAGES[c]?.[1] || '🌐'} ${LANGUAGES[c]?.[0] || String(c).toUpperCase()}`;

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
}

// The language this session watches in: only the learner's own LinguaScript
// languages, and asked for when there's more than one and none is picked yet.
async function loadLanguages() {
  const info = await send({ type: 'GET_LANGUAGES' });
  if (!info?.ok) return;
  const label = $('lang-label');
  label.innerHTML = '';
  if (!info.languages.length) {
    label.innerHTML = '<a href="https://linguascript.co.uk/profile" target="_blank" rel="noopener noreferrer">Add a language</a>';
  } else {
    label.append('Learning: ');
    const b = document.createElement('b'); b.textContent = langLabel(info.language); label.append(b);
  }
  $('lang-change').classList.toggle('hidden', info.languages.length < 2);
  const options = $('lang-options');
  options.innerHTML = '';
  info.languages.forEach((code) => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (code === info.language && !info.needsChoice ? ' on' : '');
    btn.textContent = langLabel(code);
    btn.addEventListener('click', async () => {
      const res = await send({ type: 'SET_LANGUAGE', language: code });
      if (!res?.ok) return;
      $('lang-picker').classList.add('hidden');
      loadLanguages();
      loadToday();
    });
    options.appendChild(btn);
  });
  $('lang-picker').classList.toggle('hidden', !info.needsChoice);
}

$('lang-change').addEventListener('click', () => $('lang-picker').classList.toggle('hidden'));

async function init() {
  const auth = await send({ type: 'GET_AUTH' });
  if (!auth?.session) { show('auth'); $('email').focus(); return; }
  show('main');
  $('user-email').textContent = auth.session.user?.email || '';
  loadLanguages();
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

// Chrome may close this pop-up while the Google window is open; the sign-in
// still finishes in the background and the pop-up shows it next time.
$('google-btn').addEventListener('click', async () => {
  $('auth-error').textContent = '';
  const res = await send({ type: 'GOOGLE_SIGN_IN' });
  if (!res?.ok) { $('auth-error').textContent = res?.error || 'Google sign-in didn’t finish. Try again or use email.'; return; }
  init();
});

$('logout-btn').addEventListener('click', async () => {
  await send({ type: 'SIGN_OUT' });
  show('auth');
});

init();
