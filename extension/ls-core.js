// LinguaScript — shared engine (ls-core.js)
// ─────────────────────────────────────────────────────────────────────────────
// One core, many platforms. This file owns everything that is IDENTICAL across
// Netflix, YouTube and any future platform: translation, the saved-word colour
// map, the word card, the transcript panel shell, controls, keyboard shortcuts,
// the toast, and the SubtitleShield (safe native-subtitle hiding).
//
// Platform adapters (adapters/netflix.js, adapters/youtube.js) implement ONLY
// the bits that genuinely differ — how to obtain the current subtitle and how
// to seek — and call into window.LSCore for all the shared behaviour.
//
// Content scripts from the same extension injected together share one isolated
// world, so attaching to `window.LSCore` is a reliable way to share code.
(() => {
  if (window.LSCore) return; // guard against double-injection

  // ── MV3 keep-alive ─────────────────────────────────────────────────────────
  function keepAlive() {
    try {
      const port = chrome.runtime.connect({ name: 'ls-keepalive' });
      port.onDisconnect.addListener(() => setTimeout(keepAlive, 25000));
    } catch {}
  }

  const getStorage = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));

  // ── Canonical token normalisation ──────────────────────────────────────────
  // MUST stay byte-for-byte identical to normalizeToken() in background.js and
  // src/lib/vocab.ts. The extension, the background worker and the web app all
  // share ONE keyspace; if these diverge, a saved word (e.g. a green "le") is
  // stored under one key but looked up under another, so its colour silently
  // falls back to red/unseen. Keeping a single definition here is the fix for
  // "my green words show red".
  function normalizeToken(raw) {
    return (raw || '')
      .toLowerCase()
      .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, '')
      .trim();
  }

  // Text from subtitles and the translation service goes into innerHTML in a
  // few places; escape it so a subtitle can never inject markup.
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // The little "ding" the app plays when a word is saved (two soft sine notes).
  let audioCtx = null;
  function playDing() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      [[880, 0], [1320, 0.09]].forEach(([freq, at]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + at); osc.stop(t0 + at + 0.4);
      });
    } catch {}
  }

  // Chinese, Japanese and Thai are written without spaces, so split those
  // lines into words with Intl.Segmenter (like src/lib/wordSegments.ts);
  // everything else splits on spaces.
  const SEGMENTED_LANGS = new Set(['zh', 'ja', 'th']);
  function splitWords(text, lang) {
    const base = (lang || '').toLowerCase().split('-')[0];
    if (SEGMENTED_LANGS.has(base) && typeof Intl !== 'undefined' && Intl.Segmenter) {
      const out = [];
      for (const seg of new Intl.Segmenter(base, { granularity: 'word' }).segment(text)) {
        if (!seg.segment.trim()) continue;
        if (seg.isWordLike) out.push({ text: seg.segment, word: true });
        else if (out.length) out[out.length - 1].text += seg.segment; // keep punctuation on the word before it
        else out.push({ text: seg.segment, word: false });
      }
      return { parts: out, joiner: '' };
    }
    return { parts: text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, word: true })), joiner: ' ' };
  }

  // The red/orange/green colour feature lives entirely in the Deck module below
  // (defined after config, since it reads learningLang). Deck.PALETTE is the
  // single source of truth for the three hexes.

  // ── Config (set by the adapter) ─────────────────────────────────────────────
  let learningLang = 'fr';
  let nativeLang = 'en';
  let DEBUG = false;
  function setLangs(l, n) { learningLang = l || 'fr'; nativeLang = n || 'en'; }
  function setDebug(v) { DEBUG = !!v; }
  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (res) => r(chrome.runtime.lastError ? null : res)));

  const SITE = 'https://linguascript.co.uk';
  const LANGUAGES = {
    en: ['English', '🇬🇧'], es: ['Spanish', '🇪🇸'], fr: ['French', '🇫🇷'], de: ['German', '🇩🇪'], it: ['Italian', '🇮🇹'],
    pt: ['Portuguese', '🇵🇹'], ja: ['Japanese', '🇯🇵'], ko: ['Korean', '🇰🇷'], zh: ['Chinese', '🇨🇳'], ru: ['Russian', '🇷🇺'],
    ar: ['Arabic', '🇸🇦'], nl: ['Dutch', '🇳🇱'], pl: ['Polish', '🇵🇱'], sv: ['Swedish', '🇸🇪'], tr: ['Turkish', '🇹🇷'],
    hi: ['Hindi', '🇮🇳'], th: ['Thai', '🇹🇭'],
  };
  const langName = (c) => LANGUAGES[c]?.[0] || String(c || '').toUpperCase();
  const langFlag = (c) => LANGUAGES[c]?.[1] || '🌐';
  const flashcardsUrl = (c) => `${SITE}/flashcards?lang=${encodeURIComponent(c)}`;

  // Logged in: the language this session uses, which is always one of the
  // learner's own LinguaScript languages. Logged out: the last one we knew
  // (French + English to start), so new users see the subtitles straight away.
  async function loadLangs() {
    const stored = await getStorage({ ls_language: 'fr', ls_native_language: 'en', ls_debug: false });
    const info = await send({ type: 'GET_LANGUAGES' });
    const lang = info?.ok && info.language ? info.language : stored.ls_language;
    const native = info?.ok && info.nativeLanguage ? info.nativeLanguage : stored.ls_native_language;
    if (info?.ok && info.language) chrome.storage.local.set({ ls_language: lang, ls_native_language: native });
    setLangs(lang, native); setDebug(stored.ls_debug);
    return { lang, nativeLang: native };
  }

  // A language picked in the pop-up or the word card applies to every open tab.
  function applyLanguage(lang) {
    if (!lang || lang === learningLang) return;
    setLangs(lang, nativeLang);
    Deck.refresh(true);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ls_language) applyLanguage(changes.ls_language.newValue);
  });
  const log = (...a) => { if (DEBUG) console.log('[LinguaScript]', ...a); };

  // ── Translation (GTX direct → background chain) ─────────────────────────────
  async function translate(text, targetLang, sourceLang = 'auto') {
    const sl = sourceLang && sourceLang !== 'auto' ? sourceLang : learningLang;
    const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await Promise.race([fetch(url), timeout(2000)]);
      if (res.ok) {
        const data = await res.json();
        const tr = (data[0] || []).map((c) => c?.[0] || '').join('').trim();
        if (tr && tr.toLowerCase() !== text.toLowerCase()) return tr;
      }
    } catch {}
    return new Promise((resolve) => {
      let tries = 0;
      (function attempt() {
        tries++;
        chrome.runtime.sendMessage({ type: 'TRANSLATE', text, targetLang, sourceLang }, (res) => {
          if (chrome.runtime.lastError) {
            if (tries < 3) { setTimeout(attempt, 500); return; }
            resolve(null); return;
          }
          resolve(res?.translation ?? null);
        });
      })();
    });
  }

  // ══ Deck — THE red/orange/green colour feature ═══════════════════════════════
  // Single source of truth for word colours in the extension. It mirrors the
  // user's flashcard decks 1:1:
  //   • background GET_DECK returns { normalizedWord → state } for the CURRENT
  //     learning language — the exact same language-scoped saved_words the app's
  //     Flashcards page reads — so a word wears the same colour here as on its
  //     card (red = UNKNOWN, orange = LEARNING, green = KNOWN).
  //   • state is read straight from saved_words.state (what flashcard review
  //     writes); no SRS re-derivation.
  //   • lookups are keyed by normalizeToken(), identical on both sides, so a
  //     stored "Les." / "le " can't miss its span and fall back to red.
  // Nothing else in the codebase should read or write word colours directly —
  // go through Deck.
  const Deck = {
    // Exact hexes from DECK_CONFIG in src/pages/Flashcards.tsx.
    PALETTE: { red: '#FF3B30', orange: '#FF8A00', green: '#34C759' },
    STATES: ['red', 'orange', 'green'],
    _map: new Map(),          // normalizedWord → 'red' | 'orange' | 'green'
    _timer: null,

    // The deck state for a word, or null if it isn't in any deck (unseen).
    stateOf(word) { return this._map.get(normalizeToken(word)) || null; },

    // Paint one span to match its deck (clears all three tier classes first so a
    // recolour red→green never leaves a stale class behind).
    paint(el, word) {
      const s = this._map.get(normalizeToken(word ?? el.dataset.word ?? ''));
      el.classList.remove('ls-red', 'ls-orange', 'ls-green');
      if (s) el.classList.add('ls-' + s);
    },

    // Repaint every rendered word span from the current map.
    repaintAll() { document.querySelectorAll('.ls-word').forEach((el) => this.paint(el)); },

    // Pull the deck for the active learning language from the background and
    // repaint. Called on mount and every refresh tick.
    refresh(force = false) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_DECK', language: learningLang, force }, (res) => {
          if (chrome.runtime.lastError || !res?.ok) { log('GET_DECK failed'); resolve(false); return; }
          this._map.clear();
          for (const [word, state] of Object.entries(res.deck || {})) {
            if (this.STATES.includes(state)) this._map.set(normalizeToken(word), state);
          }
          const dist = { red: 0, orange: 0, green: 0 };
          this._map.forEach((s) => dist[s]++);
          log('deck loaded:', this._map.size, 'words', dist, '| le/la/des =', this._map.get('le'), this._map.get('la'), this._map.get('des'));
          this.repaintAll();
          resolve(true);
        });
      });
    },

    // A word just saved from the overlay enters the red (UNKNOWN) deck; reflect
    // that instantly without waiting for the next refresh.
    markSaved(word) {
      const key = normalizeToken(word);
      if (!key) return;
      this._map.set(key, 'red');
      document.querySelectorAll(`.ls-word[data-word="${CSS.escape(key)}"]`).forEach((el) => this.paint(el, key));
    },

    // Poll so a card promoted in the app (red→orange→green) recolours live. The
    // background force-refreshes past its cache when we ask on the tick.
    startAutoRefresh(ms = 15000) {
      if (this._timer) return;
      this._timer = setInterval(() => this.refresh(true), ms);
    },
    stopAutoRefresh() { clearInterval(this._timer); this._timer = null; },
  };

  // ── Toast ────────────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    let t = document.getElementById('ls-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ls-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('ls-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('ls-show'), 2200);
  }

  // ── Word card ──────────────────────────────────────────────────────────────
  let activeCard = null;
  function closeCard() { activeCard?.remove(); activeCard = null; }

  function openCard({ word, clean, fullLine, anchorEl }) {
    closeCard();
    const tier = Deck.stateOf(clean);
    const tierLabel = tier === 'green' ? '🟢 Known' : tier === 'orange' ? '🟠 Learning' : tier === 'red' ? '🔴 New word' : '⬜ Unseen';
    const tierColor = tier === 'green' ? Deck.PALETTE.green : tier === 'orange' ? Deck.PALETTE.orange : tier === 'red' ? Deck.PALETTE.red : '#888';
    const alreadySaved = !!tier;

    const card = document.createElement('div'); card.id = 'ls-card'; activeCard = card;
    card.innerHTML = `
      <button id="ls-card-close">✕</button>
      <div id="ls-card-word" translate="no">${escapeHtml(word.replace(/[.,!?;:"`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, '').trim() || word)}</div>
      <div id="ls-card-tier" style="color:${tierColor}">${tierLabel}</div>
      <div id="ls-card-trans" style="color:#9A9AA6;font-style:italic;font-size:14px;">looking up…</div>
      <div id="ls-card-body"></div>
      <div id="ls-card-action"><button id="ls-card-save"${alreadySaved ? ' disabled' : ''}>${alreadySaved ? '✓ In your flashcards' : '+ Save to flashcards'}</button></div>`;
    document.body.appendChild(card);
    card.querySelector('#ls-card-close').addEventListener('click', closeCard);

    // Sit above the word when there's room, else below, and always stay on
    // screen: the card grows (translation, login form, language buttons), so
    // re-place it whenever its size changes.
    const rect = anchorEl.getBoundingClientRect();
    const place = () => {
      const h = card.offsetHeight;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 308));
      let top = rect.top - h - 8 >= 8 ? rect.top - h - 8 : rect.bottom + 8;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      card.style.left = left + 'px'; card.style.top = top + 'px';
    };
    place();
    new ResizeObserver(place).observe(card);
    setTimeout(() => document.addEventListener('click', (e) => { if (!card.contains(e.target)) closeCard(); }, { once: true }), 0);

    let resolvedTranslation = '';
    chrome.runtime.sendMessage({ type: 'WORD_DETAIL', word: clean, sourceLang: learningLang, targetLang: nativeLang }, (detail) => {
      if (!activeCard) return;
      const transEl = card.querySelector('#ls-card-trans');
      const bodyEl = card.querySelector('#ls-card-body');
      if (detail?.ok && detail.translation) {
        resolvedTranslation = detail.translation;
        if (transEl) { transEl.style.cssText = 'font-size:17px;font-weight:700;color:#fff;margin-bottom:10px;'; transEl.textContent = detail.translation; }
        let bodyHTML = '';
        if (detail.synonymGroups?.length) {
          const chips = detail.synonymGroups.flatMap((g) => g.words).slice(0, 10).map((w) => `<span class="ls-card-syn-chip">${escapeHtml(w)}</span>`).join('');
          bodyHTML += `<div class="ls-card-section-label">Synonyms</div><div class="ls-card-synonyms">${chips}</div>`;
        }
        // Escape first, then highlight the word (it's escaped the same way, so it still matches).
        const highlight = (line) => {
          const safe = escapeHtml(line);
          const target = escapeRegExp(escapeHtml(clean));
          const re = SEGMENTED_LANGS.has(learningLang) ? new RegExp(target, 'gi') : new RegExp(`(^|[^\\p{L}])(${target})(?=$|[^\\p{L}])`, 'giu');
          return SEGMENTED_LANGS.has(learningLang)
            ? safe.replace(re, (m) => `<em>${m}</em>`)
            : safe.replace(re, (_m, pre, w) => `${pre}<em>${w}</em>`);
        };
        const examples = [];
        if (fullLine && fullLine !== clean) {
          examples.push(`<div class="ls-card-example" translate="no">${highlight(fullLine)}</div>`);
        }
        if (detail.examples?.length) {
          detail.examples.filter((ex) => ex.trim() !== (fullLine || '').trim()).slice(0, 2).forEach((ex) => examples.push(`<div class="ls-card-example" translate="no">${highlight(ex)}</div>`));
        }
        if (examples.length) bodyHTML += `<div class="ls-card-section-label">Examples</div><div class="ls-card-examples">${examples.join('')}</div>`;
        if (bodyEl) bodyEl.innerHTML = bodyHTML;
      } else {
        translate(clean, nativeLang, learningLang).then((tr) => {
          resolvedTranslation = tr || '';
          if (transEl) { transEl.style.cssText = 'font-size:15px;color:#e5e5e5;margin-bottom:12px;'; transEl.textContent = tr || 'Translation unavailable'; }
        });
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, (authRes) => {
      if (!activeCard) return;
      const saveBtn = card.querySelector('#ls-card-save');
      if (!authRes?.session) {
        setCardAction(card, buildMiniLogin(card, clean, fullLine, () => resolvedTranslation));
      } else if (!alreadySaved) {
        saveBtn.addEventListener('click', () => saveFromCard(card, clean, fullLine, resolvedTranslation));
      }
    });
  }

  // ── Saving from the word card ─────────────────────────────────────────────────
  // A word goes into the deck of the language being watched, which must be one
  // of the learner's own LinguaScript languages; the card says which, with a link.
  function setCardAction(card, node) {
    const slot = card.querySelector('#ls-card-action');
    if (slot) slot.replaceChildren(node);
  }
  function cardNote(html, cls = 'ls-card-status') {
    const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d;
  }

  async function saveFromCard(card, word, context, translation) {
    setCardAction(card, cardNote('Saving…'));
    const res = await send({ type: 'SAVE_WORD', word, context, language: learningLang, translation });
    if (activeCard !== card) return;
    if (res?.error === 'not_your_language') {
      showLanguagePicker(card, res.languages || [], () => saveFromCard(card, word, context, translation));
      return;
    }
    if (!res?.ok) {
      const retry = document.createElement('button'); retry.id = 'ls-card-save';
      retry.textContent = res?.message || 'Couldn’t save. Tap to try again';
      retry.disabled = !!res?.message;
      retry.addEventListener('click', () => saveFromCard(card, word, context, translation));
      setCardAction(card, retry);
      return;
    }
    Deck.markSaved(word);
    playDing();
    Deck.refresh(true);
    const tierEl = card.querySelector('#ls-card-tier');
    if (tierEl && !res.already) { tierEl.textContent = '🔴 New word'; tierEl.style.color = Deck.PALETTE.red; }
    const lang = res.language || learningLang;
    setCardAction(card, cardNote(
      `<b>✓ ${res.already ? 'Already in' : 'Saved to'} your ${langFlag(lang)} ${escapeHtml(langName(lang))} flashcards</b>` +
      `<a href="${flashcardsUrl(lang)}" target="_blank" rel="noopener noreferrer">Open your ${escapeHtml(langName(lang))} flashcards →</a>`,
      'ls-card-status ls-card-saved'));
  }

  // Ask which of the learner's languages they're watching in. Only their own
  // LinguaScript languages are offered.
  function showLanguagePicker(card, languages, then) {
    if (!languages.length) {
      setCardAction(card, cardNote(`Add the language you're learning on LinguaScript first. <a href="${SITE}/profile" target="_blank" rel="noopener noreferrer">Open LinguaScript →</a>`));
      return;
    }
    const wrap = cardNote('<b>Which language are you watching in?</b>', 'ls-card-status');
    const row = document.createElement('div'); row.className = 'ls-card-langs';
    languages.forEach((code) => {
      const b = document.createElement('button'); b.className = 'ls-card-lang-btn';
      b.textContent = `${langFlag(code)} ${langName(code)}`;
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await send({ type: 'SET_LANGUAGE', language: code });
        if (!res?.ok) return;
        applyLanguage(code);
        then();
      });
      row.appendChild(b);
    });
    wrap.appendChild(row);
    setCardAction(card, wrap);
  }

  // Straight after logging in from the card: watch in the language on screen if
  // it's one of theirs, otherwise ask, then save the word.
  async function afterLogin(card, word, context, getTranslation) {
    const info = await send({ type: 'GET_LANGUAGES' });
    if (activeCard !== card) return;
    Deck.refresh(true); Deck.startAutoRefresh();
    const languages = info?.languages || [];
    const save = () => saveFromCard(card, word, context, getTranslation());
    if (languages.includes(learningLang)) {
      await send({ type: 'SET_LANGUAGE', language: learningLang });
      save();
    } else {
      showLanguagePicker(card, languages, save);
    }
  }

  function buildMiniLogin(card, word, context, getTranslation) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="ls-card-login-note">Log in to save words to your flashcards. New here? <a href="${SITE}/auth?mode=signup" target="_blank" rel="noopener noreferrer">Create a free account</a></p>
      <button class="ls-card-google" id="ls-mini-google"><span class="ls-g">G</span> Continue with Google</button>
      <div class="ls-card-or">or</div>
      <input class="ls-card-login-input" id="ls-mini-email" type="email" placeholder="Email" autocomplete="email" />
      <input class="ls-card-login-input" id="ls-mini-pw" type="password" placeholder="Password" autocomplete="current-password" />
      <button class="ls-card-login-btn" id="ls-mini-submit">Log in &amp; Save</button>
      <a class="ls-card-forgot" href="${SITE}/auth?mode=forgot" target="_blank" rel="noopener noreferrer">Forgot password?</a>
      <div class="ls-card-login-err" id="ls-mini-err"></div>`;
    wrap.addEventListener('click', (e) => e.stopPropagation());
    const errEl = wrap.querySelector('#ls-mini-err');
    const submit = async () => {
      const email = wrap.querySelector('#ls-mini-email').value.trim();
      const pw = wrap.querySelector('#ls-mini-pw').value;
      const btn = wrap.querySelector('#ls-mini-submit');
      if (!email || !pw) { errEl.textContent = 'Enter your email and password.'; return; }
      btn.textContent = 'Logging in…'; btn.disabled = true; errEl.textContent = '';
      const res = await send({ type: 'SIGN_IN', email, password: pw });
      if (!res?.ok) { errEl.textContent = res?.error || 'Login failed. Check your email and password.'; btn.textContent = 'Log in & Save'; btn.disabled = false; return; }
      afterLogin(card, word, context, getTranslation);
    };
    wrap.querySelector('#ls-mini-submit').addEventListener('click', submit);
    wrap.querySelector('#ls-mini-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    wrap.querySelector('#ls-mini-google').addEventListener('click', async () => {
      errEl.textContent = '';
      const res = await send({ type: 'GOOGLE_SIGN_IN' });
      if (!res?.ok) { errEl.textContent = res?.error || 'Google sign-in didn’t finish. Try again or use email.'; return; }
      afterLogin(card, word, context, getTranslation);
    });
    return wrap;
  }

  // ── Word spans ───────────────────────────────────────────────────────────────
  function makeWordSpan(word, fullLine, joiner = ' ') {
    const clean = normalizeToken(word);
    if (!clean) return document.createTextNode(word + joiner);
    const span = document.createElement('span');
    span.className = 'ls-word'; span.dataset.word = clean; span.textContent = word + joiner;
    span.setAttribute('translate', 'no');
    Deck.paint(span, clean);
    span.addEventListener('click', (e) => { e.stopPropagation(); openCard({ word, clean, fullLine, anchorEl: span }); });
    return span;
  }
  function makeWordSpansFor(text) {
    const frag = document.createDocumentFragment();
    const { parts, joiner } = splitWords(text, learningLang);
    parts.forEach((p) => frag.appendChild(p.word ? makeWordSpan(p.text, text, joiner) : document.createTextNode(p.text + joiner)));
    return frag;
  }

  // ── Subtitle shield — SAFE native-subtitle hiding ─────────────────────────────
  // The blank-screen bug came from hiding native subs up-front and never
  // restoring them if our overlay failed or the extension reloaded. Rules:
  //   1. Only hide native subs once WE actually have text to show (noteContent).
  //   2. Restore them the moment our overlay is empty, on error, or on teardown.
  //   3. A watchdog un-hides if no content has been shown for a few seconds, so
  //      an orphaned hide-style can never strand the viewer with a blank screen.
  function SubtitleShield(selector) {
    let styleEl = null, hidden = false, lastContentTs = 0, watchdog = null;
    function hide() {
      if (hidden) return;
      styleEl = document.getElementById('ls-native-hide') || document.createElement('style');
      styleEl.id = 'ls-native-hide';
      styleEl.textContent = `${selector} { visibility: hidden !important; }`;
      document.head.appendChild(styleEl);
      hidden = true;
    }
    function show() {
      document.getElementById('ls-native-hide')?.remove();
      styleEl = null; hidden = false;
    }
    function noteContent() { lastContentTs = Date.now(); hide(); }
    function start() {
      stop();
      watchdog = setInterval(() => { if (hidden && Date.now() - lastContentTs > 4000) show(); }, 2000);
      // Always restore native subs if the page/extension goes away.
      window.addEventListener('pagehide', show, { once: true });
      window.addEventListener('beforeunload', show, { once: true });
    }
    function stop() { clearInterval(watchdog); watchdog = null; }
    return { hide, show, noteContent, start, stop, isHidden: () => hidden };
  }

  // ── Live captions — mirror the subtitles the site itself shows ─────────────────
  // Netflix never hands out a subtitle file and YouTube now guards its caption
  // files, so both read what the player puts on screen and render it into our
  // overlay (#ls-primary / #ls-secondary). The transcript fills in line by line.
  //   getText()   → the on-screen subtitle text, or null
  //   getTarget() → the element to watch for subtitle changes
  //   shield      → SubtitleShield for the site's own subtitles
  //   getVideo()  → the <video>
  function LiveCaptions({ getText, getTarget, shield, getVideo }) {
    const lines = [];
    let current = -1, listEl = null, observer = null;
    let lastPrimary = null, lastSecondarySource = null, autoPause = false, visible = true;
    let clearDebounce = null, translateDebounce = null;

    function fillPanelLine(div, idx) {
      div.innerHTML = '';
      const textEl = document.createElement('div'); textEl.className = 'ls-panel-line-text'; textEl.setAttribute('translate', 'no');
      textEl.appendChild(makeWordSpansFor(lines[idx].text));
      const trEl = document.createElement('div'); trEl.className = 'ls-panel-line-tr';
      div.appendChild(textEl); div.appendChild(trEl);
      const text = lines[idx].text;
      translate(text, nativeLang, learningLang).then((tr) => { if (tr && lines[idx]?.text === text) trEl.textContent = tr; });
    }
    function addPanelLine(idx) {
      if (!listEl) return;
      const div = document.createElement('div');
      div.className = 'ls-panel-line'; div.dataset.idx = idx;
      div.addEventListener('click', () => {
        // No timestamps on screen-read subtitles: step back about 5s per line.
        const v = getVideo();
        const diff = idx - current;
        if (v && diff < 0) v.currentTime = Math.max(0, v.currentTime + diff * 5 - 2);
        current = idx; updatePanelCurrent();
      });
      fillPanelLine(div, idx);
      listEl.appendChild(div);
    }
    function updatePanelCurrent() {
      document.querySelectorAll('.ls-panel-line').forEach((el) => el.classList.toggle('ls-current', parseInt(el.dataset.idx) === current));
      document.querySelector('.ls-panel-line.ls-current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function logLine(text) {
      const last = lines[lines.length - 1];
      if (last?.text === text) { current = lines.length - 1; updatePanelCurrent(); return; }
      // Auto-generated captions grow word by word: update that line in place
      // instead of logging every step.
      if (last && text.startsWith(last.text)) {
        last.text = text; current = lines.length - 1;
        const div = listEl?.querySelector(`.ls-panel-line[data-idx="${current}"]`);
        if (div) fillPanelLine(div, current);
        updatePanelCurrent();
        return;
      }
      lines.push({ text });
      current = lines.length - 1;
      addPanelLine(current);
      updatePanelCurrent();
    }

    function renderPrimary(text) {
      if (text === lastPrimary) return; lastPrimary = text;
      logLine(text);
      const el = document.getElementById('ls-primary'); if (!el) return;
      el.style.cssText = ''; el.innerHTML = '';
      el.onclick = () => { const v = getVideo(); if (v) v.currentTime = Math.max(0, v.currentTime - 4); };
      const { parts, joiner } = splitWords(text, learningLang);
      parts.forEach((p) => el.appendChild(p.word ? makeWordSpan(p.text, text, joiner) : document.createTextNode(p.text + joiner)));
    }
    function renderSecondary(text) {
      const el = document.getElementById('ls-secondary'); if (!el) return;
      el.textContent = text || ''; el.style.display = text ? 'block' : 'none';
    }
    function clearOverlay() {
      if (!lastPrimary) return; lastPrimary = null; lastSecondarySource = null;
      const el = document.getElementById('ls-primary'); if (el) el.innerHTML = '';
      renderSecondary('');
      const overlay = document.getElementById('ls-overlay'); if (overlay) overlay.style.opacity = '0';
      shield.show(); // overlay empty → always let the site's subtitles through
    }

    function onChange() {
      if (!visible) return;
      const text = getText();
      if (!text) {
        clearTimeout(clearDebounce);
        clearDebounce = setTimeout(() => {
          if (!getText()) {
            clearOverlay();
            if (autoPause) { const v = getVideo(); if (v && !v.paused) v.pause(); }
          }
        }, 400);
        return;
      }
      clearTimeout(clearDebounce);
      try {
        const overlay = document.getElementById('ls-overlay'); if (overlay) overlay.style.opacity = '1';
        renderPrimary(text);
        shield.noteContent(); // we now have text → safe to hide the site's subtitles
      } catch (e) {
        shield.show(); // never strand the viewer on a render error
        console.warn('[LinguaScript] render failed, native subs restored', e);
      }
      if (learningLang !== nativeLang && text !== lastSecondarySource) {
        lastSecondarySource = text;
        clearTimeout(translateDebounce);
        translateDebounce = setTimeout(async () => {
          const tr = await translate(text, nativeLang, learningLang);
          if (lastSecondarySource === text) renderSecondary(tr || '');
        }, 150);
      }
    }

    return {
      start(panelList) {
        listEl = panelList;
        shield.start();
        observer = new MutationObserver(onChange);
        observer.observe(getTarget() || document.body, { childList: true, subtree: true, characterData: true });
        onChange();
      },
      stop() {
        observer?.disconnect(); observer = null;
        clearTimeout(clearDebounce); clearTimeout(translateDebounce);
        shield.stop(); shield.show();
        lines.length = 0; current = -1; listEl = null; lastPrimary = null; lastSecondarySource = null;
      },
      setVisible(v) { visible = v; if (v) { shield.hide(); onChange(); } else shield.show(); },
      setAutoPause(v) { autoPause = v; },
      getAutoPause: () => autoPause,
      hasText: () => lines.length > 0,
    };
  }

  // ── Playback speed ────────────────────────────────────────────────────────────
  // Find the <video> on every click (players swap it out) and put the speed back
  // if the site resets it, which Netflix does.
  function SpeedKeeper(getVideo) {
    let rate = 1, watched = null;
    const enforce = () => { const v = getVideo(); if (v && Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate; };
    function set(r) {
      rate = r;
      const v = getVideo(); if (!v) return;
      if (watched !== v) { watched?.removeEventListener('ratechange', enforce); v.addEventListener('ratechange', enforce); watched = v; }
      v.playbackRate = r;
    }
    return { set, get: () => rate };
  }

  // ── Panel shell ────────────────────────────────────────────────────────────
  let panelVisible = true;
  function buildPanelShell(metaLabel = 'Transcript') {
    if (document.getElementById('ls-panel')) return document.getElementById('ls-panel-list');
    const panel = document.createElement('div'); panel.id = 'ls-panel';
    panel.innerHTML = `
      <div id="ls-panel-header">
        <div><div id="ls-panel-logo">Lingua<span>Script</span></div><div id="ls-panel-meta">${metaLabel}</div></div>
        <button id="ls-panel-toggle">Hide</button>
      </div>
      <div id="ls-panel-list"></div>`;
    document.body.appendChild(panel);
    panel.querySelector('#ls-panel-toggle').addEventListener('click', () => togglePanel(false));
    return panel.querySelector('#ls-panel-list');
  }
  function togglePanel(show) {
    panelVisible = show ?? !panelVisible;
    document.getElementById('ls-panel')?.classList.toggle('ls-hidden', !panelVisible);
    document.getElementById('ls-overlay')?.classList.toggle('ls-panel-hidden', !panelVisible);
    document.getElementById('ls-controls')?.classList.toggle('ls-panel-hidden', !panelVisible);
    document.getElementById('ls-panel-btn')?.classList.toggle('ls-on', panelVisible);
  }

  // ── Controls + keyboard shortcuts ─────────────────────────────────────────────
  // spec: { seekBack, seekRepeat, seekForward, onSpeed(rate), onAutoPause(bool),
  //         onToggleOverlay(bool), extraLinks: [{label, href}] }
  function buildControls(spec) {
    if (document.getElementById('ls-controls')) return;
    const bar = document.createElement('div'); bar.id = 'ls-controls';
    const inner = document.createElement('div'); inner.id = 'ls-controls-inner'; bar.appendChild(inner);
    const mk = (label, hint, onClick, id) => {
      const b = document.createElement('button'); b.className = 'ls-btn'; if (id) b.id = id;
      b.innerHTML = hint ? `${label}<span class="ls-kbd">${hint}</span>` : label;
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
      return b;
    };
    const sep = () => { const d = document.createElement('div'); d.className = 'ls-sep'; return d; };

    let autoPause = false;
    const apBtn = mk('A|P Off', 'Q', () => { autoPause = !autoPause; apBtn.innerHTML = `${autoPause ? 'A|P On' : 'A|P Off'}<span class="ls-kbd">Q</span>`; apBtn.classList.toggle('ls-on', autoPause); spec.onAutoPause?.(autoPause); }, 'ls-ap-btn');
    const panelBtn = mk('≡ Transcript', '', () => togglePanel(), 'ls-panel-btn'); panelBtn.classList.add('ls-on');
    const speedBtns = [0.5, 0.75, 1, 1.25, 1.5].map((sp) => {
      const b = mk(sp + '×', '', () => { spec.onSpeed?.(sp); speedBtns.forEach((x) => x.classList.remove('ls-on')); b.classList.add('ls-on'); });
      if (sp === 1) b.classList.add('ls-on');
      return b;
    });
    let overlayVisible = true;
    const hideBtn = mk('LS', '', () => { overlayVisible = !overlayVisible; hideBtn.classList.toggle('ls-on', overlayVisible); document.getElementById('ls-overlay')?.style && (document.getElementById('ls-overlay').style.opacity = overlayVisible ? '1' : '0'); spec.onToggleOverlay?.(overlayVisible); }, 'ls-hide-btn');
    hideBtn.classList.add('ls-on');

    const nodes = [
      mk('⏮', 'A', () => spec.seekBack?.()),
      mk('↩', 'S', () => spec.seekRepeat?.()),
      mk('⏭', 'D', () => spec.seekForward?.()),
      sep(), apBtn, sep(), ...speedBtns, sep(), panelBtn, hideBtn,
    ];
    (spec.extraLinks || []).forEach(({ label, href }) => {
      nodes.push(sep());
      const a = document.createElement('a'); a.className = 'ls-btn ls-link'; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label;
      nodes.push(a);
    });
    nodes.forEach((n) => inner.appendChild(n));
    document.body.appendChild(bar);

    // Reflect keyboard toggles back onto the A|P button.
    window.__lsSetAutoPause = (v) => { autoPause = v; apBtn.innerHTML = `${v ? 'A|P On' : 'A|P Off'}<span class="ls-kbd">Q</span>`; apBtn.classList.toggle('ls-on', v); };
  }

  function attachKeyboardShortcuts(spec) {
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); spec.seekRepeat?.(); }
      else if (k === 'a') { e.preventDefault(); spec.seekBack?.(); }
      else if (k === 'd') { e.preventDefault(); spec.seekForward?.(); }
      else if (k === 'q') {
        e.preventDefault();
        const next = !(spec.getAutoPause?.() ?? false);
        spec.onAutoPause?.(next); window.__lsSetAutoPause?.(next);
        showToast(next ? 'Auto-pause ON' : 'Auto-pause OFF');
      }
    }, true);
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  // Brand tokens match the website (src/index.css) and brand.css: near-black
  // surfaces, green primary, orange accent. Inter is bundled with the
  // extension (no Google Fonts request); if a page blocks it we fall back to
  // the system font.
  const FONT_URL = (f) => { try { return chrome.runtime.getURL(`fonts/${f}`); } catch { return ''; } };
  const SHARED_CSS = `
    @font-face { font-family:'LS Inter'; font-style:normal; font-weight:100 900; font-display:swap; src:url('${FONT_URL('inter-latin-wght-normal.woff2')}') format('woff2'); unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF, U+FFFD; }
    @font-face { font-family:'LS Inter'; font-style:normal; font-weight:100 900; font-display:swap; src:url('${FONT_URL('inter-latin-ext-wght-normal.woff2')}') format('woff2'); unicode-range:U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+1EF2-1EFF, U+20A0-20AB, U+20AD-20C0, U+2C60-2C7F, U+A720-A7FF; }
    .ls-word { cursor:pointer; border-radius:4px; padding:0 3px; transition:color .35s ease, background .12s; display:inline; }
    .ls-word:hover { background:rgba(255,255,255,0.16); }
    /* The ONE deck palette — three distinct hexes, one per deck. */
    .ls-red    { color:${Deck.PALETTE.red}   !important; }
    .ls-orange { color:${Deck.PALETTE.orange}!important; }
    .ls-green  { color:${Deck.PALETTE.green} !important; }

    #ls-controls { position:fixed; z-index:2147483641; display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none; transition:right .3s ease; left:0; right:360px; }
    #ls-controls.ls-panel-hidden { right:0; }
    #ls-controls-inner { display:flex; align-items:center; gap:6px; background:rgba(8,8,11,0.94); border:1px solid #24242D; border-radius:999px; padding:7px 12px; backdrop-filter:blur(16px); pointer-events:auto; box-shadow:0 4px 24px rgba(0,0,0,0.7); font-family:'LS Inter','Inter',system-ui,-apple-system,sans-serif; }
    .ls-btn { background:rgba(255,255,255,0.08); color:#F5F5F7; border:none; border-radius:999px; padding:5px 11px; font-size:12px; font-weight:600; cursor:pointer; transition:background .12s, transform .1s; white-space:nowrap; font-family:inherit; text-decoration:none; display:inline-flex; align-items:center; }
    .ls-btn:hover { background:rgba(255,255,255,0.18); transform:scale(1.04); }
    .ls-btn:active { transform:scale(0.96); }
    .ls-btn.ls-on { background:#34C759; color:#08080B; }
    .ls-btn.ls-on .ls-kbd { color:rgba(8,8,11,0.55); }
    .ls-btn.ls-link { background:rgba(255,138,0,0.14); color:#FF8A00; }
    .ls-btn.ls-link:hover { background:rgba(255,138,0,0.26); }
    .ls-sep { width:1px; height:18px; background:rgba(255,255,255,0.13); margin:0 2px; }
    .ls-kbd { font-size:10px; color:rgba(255,255,255,0.4); margin-left:3px; }

    #ls-card { position:fixed; z-index:2147483647; width:300px; max-height:calc(100vh - 16px); overflow-y:auto; box-sizing:border-box; background:rgba(17,17,22,0.98); border:1px solid #24242D; border-radius:16px; padding:16px 18px 14px; font-family:'LS Inter','Inter',system-ui,-apple-system,sans-serif; box-shadow:0 16px 48px rgba(0,0,0,0.9); backdrop-filter:blur(20px); pointer-events:auto; color:#F5F5F7; animation:ls-card-in .22s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes ls-card-in { from{opacity:0;transform:scale(.88) translateY(6px);} to{opacity:1;transform:scale(1) translateY(0);} }
    #ls-card-word { font-size:22px; font-weight:800; margin-bottom:3px; letter-spacing:-0.3px; }
    #ls-card-tier { font-size:11px; font-weight:600; letter-spacing:.04em; margin-bottom:8px; opacity:.9; }
    #ls-card-trans { min-height:20px; line-height:1.3; }
    .ls-card-section-label { font-size:10px; font-weight:600; letter-spacing:.08em; color:#9A9AA6; text-transform:uppercase; margin-bottom:5px; }
    .ls-card-synonyms { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px; }
    .ls-card-syn-chip { font-size:12px; color:#F5F5F7; background:#17171E; border:1px solid #24242D; border-radius:20px; padding:2px 9px; }
    .ls-card-examples { margin-bottom:12px; }
    .ls-card-example { font-size:12px; color:#B5B5C0; line-height:1.5; padding:4px 0 4px 8px; border-left:2px solid rgba(255,138,0,0.45); margin-bottom:4px; }
    .ls-card-example em { color:#FF8A00; font-style:normal; font-weight:700; }
    #ls-card-save { width:100%; padding:10px; border:none; border-radius:999px; background:#34C759; color:#08080B; font-size:13px; font-weight:700; cursor:pointer; transition:filter .15s, transform .1s; font-family:inherit; }
    #ls-card-save:hover { filter:brightness(1.08); }
    #ls-card-save:active { transform:scale(0.98); }
    #ls-card-save:disabled { background:#17171E; color:#9A9AA6; cursor:default; filter:none; }
    #ls-card-close { position:absolute; top:12px; right:14px; background:none; border:none; color:#9A9AA6; font-size:16px; cursor:pointer; line-height:1; }
    #ls-card-close:hover { color:#fff; }
    .ls-card-login-note { font-size:12px; color:#9A9AA6; margin-bottom:10px; line-height:1.5; }
    .ls-card-login-note a { color:#34C759; }
    .ls-card-login-input { width:100%; padding:8px 12px; margin-bottom:7px; background:#08080B; border:1px solid #24242D; border-radius:10px; color:#F5F5F7; font-size:12px; outline:none; box-sizing:border-box; font-family:inherit; }
    .ls-card-login-input:focus { border-color:#34C759; }
    .ls-card-login-btn { width:100%; padding:9px; border:none; border-radius:999px; background:#34C759; color:#08080B; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
    .ls-card-login-btn:hover { filter:brightness(1.08); }
    .ls-card-login-err { font-size:11px; color:#FF3B30; margin-top:5px; min-height:14px; }
    .ls-card-google { width:100%; padding:9px; border:1px solid #24242D; border-radius:999px; background:#F5F5F7; color:#08080B; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px; }
    .ls-card-google:hover { filter:brightness(0.95); }
    .ls-g { font-weight:800; color:#4285F4; }
    .ls-card-or { text-align:center; font-size:11px; color:#9A9AA6; margin:8px 0; }
    .ls-card-forgot { display:block; text-align:center; font-size:11px; color:#9A9AA6; margin-top:7px; text-decoration:none; }
    .ls-card-forgot:hover { color:#F5F5F7; }
    .ls-card-status { font-size:13px; color:#F5F5F7; line-height:1.5; }
    .ls-card-status a { display:block; margin-top:6px; color:#34C759; font-weight:600; text-decoration:none; }
    .ls-card-saved b { color:#34C759; }
    .ls-card-langs { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .ls-card-lang-btn { padding:7px 12px; border:1px solid #24242D; border-radius:999px; background:#17171E; color:#F5F5F7; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
    .ls-card-lang-btn:hover { border-color:#34C759; }

    #ls-panel { position:fixed; top:0; right:0; bottom:0; width:360px; background:rgba(8,8,11,0.98); border-left:1px solid #24242D; z-index:2147483639; display:flex; flex-direction:column; font-family:'LS Inter','Inter',system-ui,-apple-system,sans-serif; backdrop-filter:blur(12px); transition:transform .3s cubic-bezier(0.4,0,0.2,1); }
    #ls-panel.ls-hidden { transform:translateX(360px); }
    #ls-panel-header { padding:14px 16px 12px; border-bottom:1px solid #24242D; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
    #ls-panel-logo { font-size:15px; font-weight:800; letter-spacing:-0.3px; color:#F5F5F7; }
    #ls-panel-logo span { color:#34C759; }
    #ls-panel-meta { font-size:10px; color:#9A9AA6; margin-top:1px; }
    #ls-panel-toggle { background:#17171E; border:1px solid #24242D; color:#F5F5F7; border-radius:999px; cursor:pointer; font-size:11px; font-weight:600; padding:4px 12px; font-family:inherit; }
    #ls-panel-toggle:hover { background:#24242D; }
    #ls-panel-list { flex:1; overflow-y:auto; padding:6px 0 80px; }
    #ls-panel-list::-webkit-scrollbar { width:3px; }
    #ls-panel-list::-webkit-scrollbar-thumb { background:#24242D; border-radius:2px; }
    .ls-panel-line { padding:10px 16px 8px; cursor:pointer; border-left:3px solid transparent; transition:background .12s, border-color .12s; }
    .ls-panel-line:hover { background:rgba(255,255,255,0.04); }
    .ls-panel-line.ls-current { border-left-color:#34C759; background:rgba(52,199,89,0.08); }
    .ls-panel-line-text { font-size:14px; color:#ccc; line-height:1.55; margin-bottom:3px; }
    .ls-panel-line.ls-current .ls-panel-line-text { color:#fff; }
    .ls-panel-line-tr { font-size:11px; color:#9A9AA6; line-height:1.4; }

    #ls-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#34C759; color:#08080B; padding:8px 20px; border-radius:999px; font-size:13px; font-weight:700; pointer-events:none; opacity:0; transition:opacity .2s; z-index:2147483647; font-family:'LS Inter','Inter',system-ui,-apple-system,sans-serif; }
    #ls-toast.ls-show { opacity:1; }
  `;

  function injectStyles(extraCss = '') {
    // Clear any stale style node from a previous (possibly orphaned) injection
    // so a leftover native-hide rule can never strand the viewer.
    document.getElementById('ls-styles')?.remove();
    const s = document.createElement('style'); s.id = 'ls-styles';
    s.textContent = SHARED_CSS + '\n' + extraCss;
    document.head.appendChild(s);
  }

  window.LSCore = {
    keepAlive, getStorage, normalizeToken,
    setLangs, setDebug, loadLangs, get learningLang() { return learningLang; }, get nativeLang() { return nativeLang; },
    translate,
    // The colour feature — one module, one source of truth.
    Deck, get PALETTE() { return Deck.PALETTE; },
    // Back-compat aliases so adapters read cleanly.
    loadSavedWords: (force) => Deck.refresh(force),
    startWordsRefresh: () => Deck.startAutoRefresh(),
    stopWordsRefresh: () => Deck.stopAutoRefresh(),
    showToast, openCard, closeCard, makeWordSpan, makeWordSpansFor, splitWords, playDing, escapeHtml,
    SubtitleShield, LiveCaptions, SpeedKeeper, buildPanelShell, togglePanel, buildControls, attachKeyboardShortcuts,
    injectStyles,
  };
})();
