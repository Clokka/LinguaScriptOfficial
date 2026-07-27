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
      .replace(/[.,!?;:"'`«»()\[\]…]/g, '')
      .trim();
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
      <div id="ls-card-word">${word}</div>
      <div id="ls-card-tier" style="color:${tierColor}">${tierLabel}</div>
      <div id="ls-card-trans" style="color:#888;font-style:italic;font-size:14px;">looking up…</div>
      <div id="ls-card-body"></div>
      <button id="ls-card-save"${alreadySaved ? ' disabled' : ''}>${alreadySaved ? '✓ In your flashcards' : '+ Save to flashcards'}</button>`;
    document.body.appendChild(card);
    card.querySelector('#ls-card-close').addEventListener('click', closeCard);

    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - 150;
    left = Math.max(8, Math.min(left, window.innerWidth - 308));
    const top = rect.top - 180 < 8 ? rect.bottom + 8 : rect.top - 180;
    card.style.left = left + 'px'; card.style.top = top + 'px';
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
          const chips = detail.synonymGroups.flatMap((g) => g.words).slice(0, 10).map((w) => `<span class="ls-card-syn-chip">${w}</span>`).join('');
          bodyHTML += `<div class="ls-card-section-label">Synonyms</div><div class="ls-card-synonyms">${chips}</div>`;
        }
        const examples = [];
        if (fullLine && fullLine !== clean) {
          examples.push(`<div class="ls-card-example">${fullLine.replace(new RegExp(`\\b${clean}\\b`, 'gi'), (m) => `<em>${m}</em>`)}</div>`);
        }
        if (detail.examples?.length) {
          detail.examples.slice(0, 2).forEach((ex) => examples.push(`<div class="ls-card-example">${ex.replace(new RegExp(`\\b${clean}\\b`, 'gi'), (m) => `<em>${m}</em>`)}</div>`));
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
        saveBtn.replaceWith(buildMiniLogin(clean, fullLine, () => resolvedTranslation));
      } else {
        saveBtn.addEventListener('click', () => {
          saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
          chrome.runtime.sendMessage({ type: 'SAVE_WORD', word: clean, context: fullLine, language: learningLang, translation: resolvedTranslation }, (res) => {
            if (chrome.runtime.lastError || !res?.ok) { saveBtn.textContent = '+ Save to flashcards'; saveBtn.disabled = false; return; }
            Deck.markSaved(clean);
            saveBtn.textContent = res.already ? '✓ Already saved' : '✓ Saved!'; saveBtn.disabled = true;
            setTimeout(closeCard, 900);
          });
        });
      }
    });
  }

  function buildMiniLogin(word, context, getTranslation) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="ls-card-login-note">Log in to save words to your flashcards.</p>
      <input class="ls-card-login-input" id="ls-mini-email" type="email" placeholder="Email" autocomplete="email" />
      <input class="ls-card-login-input" id="ls-mini-pw" type="password" placeholder="Password" autocomplete="current-password" />
      <button class="ls-card-login-btn" id="ls-mini-submit">Log in &amp; Save</button>
      <div class="ls-card-login-err" id="ls-mini-err"></div>`;
    wrap.addEventListener('click', (e) => e.stopPropagation());
    const submit = () => {
      const email = wrap.querySelector('#ls-mini-email').value.trim();
      const pw = wrap.querySelector('#ls-mini-pw').value;
      const errEl = wrap.querySelector('#ls-mini-err');
      const btn = wrap.querySelector('#ls-mini-submit');
      if (!email || !pw) { errEl.textContent = 'Enter your email and password.'; return; }
      btn.textContent = 'Logging in…'; btn.disabled = true; errEl.textContent = '';
      chrome.runtime.sendMessage({ type: 'SIGN_IN', email, password: pw }, (res) => {
        if (!res?.ok) { errEl.textContent = res?.error || 'Login failed — check credentials.'; btn.textContent = 'Log in & Save'; btn.disabled = false; return; }
        btn.textContent = 'Saving…';
        chrome.runtime.sendMessage({ type: 'SAVE_WORD', word, context, language: learningLang, translation: getTranslation() }, (saveRes) => {
          if (!saveRes?.ok) { btn.textContent = 'Saved (refresh to colour words)'; btn.disabled = true; return; }
          Deck.markSaved(word);
          btn.textContent = '✓ Saved!'; btn.disabled = true;
          setTimeout(closeCard, 900);
        });
      });
    };
    wrap.querySelector('#ls-mini-submit').addEventListener('click', submit);
    wrap.querySelector('#ls-mini-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    return wrap;
  }

  // ── Word spans ───────────────────────────────────────────────────────────────
  function makeWordSpan(word, fullLine) {
    const clean = normalizeToken(word);
    if (!clean) return document.createTextNode(word + ' ');
    const span = document.createElement('span');
    span.className = 'ls-word'; span.dataset.word = clean; span.textContent = word + ' ';
    Deck.paint(span, clean);
    span.addEventListener('click', (e) => { e.stopPropagation(); openCard({ word, clean, fullLine, anchorEl: span }); });
    return span;
  }
  function makeWordSpansFor(text) {
    const frag = document.createDocumentFragment();
    text.split(/\s+/).filter(Boolean).forEach((w) => frag.appendChild(makeWordSpan(w, text)));
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
  const SHARED_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .ls-word { cursor:pointer; border-radius:4px; padding:0 3px; transition:color .35s ease, background .12s; display:inline; }
    .ls-word:hover { background:rgba(255,255,255,0.16); }
    /* The ONE deck palette — three distinct hexes, one per deck. */
    .ls-red    { color:${Deck.PALETTE.red}   !important; }
    .ls-orange { color:${Deck.PALETTE.orange}!important; }
    .ls-green  { color:${Deck.PALETTE.green} !important; }

    #ls-controls { position:fixed; z-index:2147483641; display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none; transition:right .3s ease; left:0; right:360px; }
    #ls-controls.ls-panel-hidden { right:0; }
    #ls-controls-inner { display:flex; align-items:center; gap:6px; background:rgba(10,8,20,0.92); border:1px solid rgba(124,58,237,0.28); border-radius:12px; padding:7px 12px; backdrop-filter:blur(16px); pointer-events:auto; box-shadow:0 4px 24px rgba(0,0,0,0.7); font-family:'Inter',-apple-system,sans-serif; }
    .ls-btn { background:rgba(255,255,255,0.08); color:#fff; border:none; border-radius:6px; padding:5px 11px; font-size:12px; font-weight:600; cursor:pointer; transition:background .12s, transform .1s; white-space:nowrap; font-family:inherit; text-decoration:none; display:inline-flex; align-items:center; }
    .ls-btn:hover { background:rgba(255,255,255,0.2); transform:scale(1.04); }
    .ls-btn:active { transform:scale(0.96); }
    .ls-btn.ls-on { background:#7c3aed; }
    .ls-btn.ls-link { background:rgba(52,199,89,0.14); color:#34C759; }
    .ls-btn.ls-link:hover { background:rgba(52,199,89,0.24); }
    .ls-sep { width:1px; height:18px; background:rgba(255,255,255,0.13); margin:0 2px; }
    .ls-kbd { font-size:10px; color:rgba(255,255,255,0.4); margin-left:3px; }

    #ls-card { position:fixed; z-index:2147483647; width:300px; background:rgba(10,10,18,0.97); border:1px solid rgba(124,58,237,0.4); border-radius:14px; padding:16px 18px 14px; font-family:'Inter',-apple-system,sans-serif; box-shadow:0 16px 48px rgba(0,0,0,0.9); backdrop-filter:blur(20px); pointer-events:auto; color:#fff; animation:ls-card-in .22s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes ls-card-in { from{opacity:0;transform:scale(.88) translateY(6px);} to{opacity:1;transform:scale(1) translateY(0);} }
    #ls-card-word { font-size:22px; font-weight:800; margin-bottom:3px; letter-spacing:-0.3px; }
    #ls-card-tier { font-size:11px; font-weight:600; letter-spacing:.04em; margin-bottom:8px; opacity:.9; }
    #ls-card-trans { min-height:20px; line-height:1.3; }
    .ls-card-section-label { font-size:10px; font-weight:600; letter-spacing:.08em; color:#666; text-transform:uppercase; margin-bottom:5px; }
    .ls-card-synonyms { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px; }
    .ls-card-syn-chip { font-size:12px; color:#b8a0ff; background:rgba(124,58,237,0.15); border:1px solid rgba(124,58,237,0.25); border-radius:20px; padding:2px 9px; cursor:pointer; }
    .ls-card-syn-chip:hover { background:rgba(124,58,237,0.3); }
    .ls-card-examples { margin-bottom:12px; }
    .ls-card-example { font-size:12px; color:#999; line-height:1.5; padding:4px 0; border-left:2px solid rgba(124,58,237,0.25); padding-left:8px; margin-bottom:4px; }
    .ls-card-example em { color:#b8a0ff; font-style:normal; font-weight:600; }
    #ls-card-save { width:100%; padding:9px; border:none; border-radius:8px; background:#7c3aed; color:#fff; font-size:13px; font-weight:700; cursor:pointer; transition:background .15s, transform .1s; font-family:inherit; }
    #ls-card-save:hover { background:#6d28d9; }
    #ls-card-save:disabled { background:#1e1e2e; color:#555; cursor:default; }
    #ls-card-close { position:absolute; top:12px; right:14px; background:none; border:none; color:#555; font-size:16px; cursor:pointer; line-height:1; }
    #ls-card-close:hover { color:#fff; }
    .ls-card-login-note { font-size:12px; color:#888; margin-bottom:10px; line-height:1.5; }
    .ls-card-login-input { width:100%; padding:7px 10px; margin-bottom:7px; background:#0d0d18; border:1px solid #2a2a40; border-radius:7px; color:#e8e8f0; font-size:12px; outline:none; box-sizing:border-box; font-family:inherit; }
    .ls-card-login-input:focus { border-color:#7c3aed; }
    .ls-card-login-btn { width:100%; padding:8px; border:none; border-radius:7px; background:#7c3aed; color:#fff; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
    .ls-card-login-btn:hover { background:#6d28d9; }
    .ls-card-login-err { font-size:11px; color:#f87171; margin-top:5px; min-height:14px; }

    #ls-panel { position:fixed; top:0; right:0; bottom:0; width:360px; background:rgba(7,7,12,0.98); border-left:1px solid rgba(124,58,237,0.18); z-index:2147483639; display:flex; flex-direction:column; font-family:'Inter',-apple-system,sans-serif; backdrop-filter:blur(12px); transition:transform .3s cubic-bezier(0.4,0,0.2,1); }
    #ls-panel.ls-hidden { transform:translateX(360px); }
    #ls-panel-header { padding:14px 16px 12px; border-bottom:1px solid rgba(124,58,237,0.15); display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
    #ls-panel-logo { font-size:15px; font-weight:800; letter-spacing:-0.3px; color:#fff; }
    #ls-panel-logo span { color:#34C759; }
    #ls-panel-meta { font-size:10px; color:#555; margin-top:1px; }
    #ls-panel-toggle { background:rgba(124,58,237,0.15); border:1px solid rgba(124,58,237,0.25); color:#9d7bea; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; padding:4px 10px; font-family:inherit; }
    #ls-panel-toggle:hover { background:rgba(124,58,237,0.28); }
    #ls-panel-list { flex:1; overflow-y:auto; padding:6px 0 80px; }
    #ls-panel-list::-webkit-scrollbar { width:3px; }
    #ls-panel-list::-webkit-scrollbar-thumb { background:rgba(124,58,237,0.3); border-radius:2px; }
    .ls-panel-line { padding:10px 16px 8px; cursor:pointer; border-left:3px solid transparent; transition:background .12s, border-color .12s; }
    .ls-panel-line:hover { background:rgba(255,255,255,0.04); }
    .ls-panel-line.ls-current { border-left-color:#7c3aed; background:rgba(124,58,237,0.1); }
    .ls-panel-line-text { font-size:14px; color:#ccc; line-height:1.55; margin-bottom:3px; }
    .ls-panel-line.ls-current .ls-panel-line-text { color:#fff; }
    .ls-panel-line-tr { font-size:11px; color:#666; line-height:1.4; }

    #ls-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#7c3aed; color:#fff; padding:7px 20px; border-radius:20px; font-size:13px; font-weight:700; pointer-events:none; opacity:0; transition:opacity .2s; z-index:2147483647; font-family:-apple-system,sans-serif; }
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
    setLangs, setDebug, get learningLang() { return learningLang; }, get nativeLang() { return nativeLang; },
    translate,
    // The colour feature — one module, one source of truth.
    Deck, get PALETTE() { return Deck.PALETTE; },
    // Back-compat aliases so adapters read cleanly.
    loadSavedWords: (force) => Deck.refresh(force),
    startWordsRefresh: () => Deck.startAutoRefresh(),
    stopWordsRefresh: () => Deck.stopAutoRefresh(),
    showToast, openCard, closeCard, makeWordSpan, makeWordSpansFor,
    SubtitleShield, buildPanelShell, togglePanel, buildControls, attachKeyboardShortcuts,
    injectStyles,
  };
})();
