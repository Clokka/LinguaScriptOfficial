// LinguaScript — Netflix (Language Reactor clone)
(async () => {

  // Keep MV3 service worker alive — it sleeps after 30s otherwise
  function keepAlive() {
    try {
      const port = chrome.runtime.connect({ name: 'ls-keepalive' });
      port.onDisconnect.addListener(() => setTimeout(keepAlive, 25000));
    } catch {}
  }
  keepAlive();

  function getStorage(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }

  // ── Translation — always via background SW (CSP-exempt, GTX→MyMemory chain) ─
  function translate(text, targetLang, sourceLang = 'auto') {
    return new Promise(resolve => {
      let tries = 0;
      function attempt() {
        tries++;
        try {
          const port = chrome.runtime.connect({ name: 'ls-keepalive' });
          setTimeout(() => { try { port.disconnect(); } catch {} }, 250);
        } catch {}
        chrome.runtime.sendMessage({ type: 'TRANSLATE', text, targetLang, sourceLang }, res => {
          if (chrome.runtime.lastError) {
            if (tries < 3) { setTimeout(attempt, 400); return; }
            resolve(null); return;
          }
          resolve(res?.translation ?? null);
        });
      }
      attempt();
    });
  }

  // ── Colour coding ─────────────────────────────────────────────────────────
  let savedWordMap = new Map();
  async function loadSavedWords() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_WORDS' }, res => {
        if (chrome.runtime.lastError || !res?.ok) { resolve(); return; }
        savedWordMap.clear();
        for (const [word, tier] of Object.entries(res.words || {})) {
          savedWordMap.set(word, tier);
        }
        // ── DIAGNOSTIC (temporary) — read in the Netflix page console (F12) ──
        console.log('[LinguaScript] deck map loaded:', savedWordMap.size, 'words |',
          'le →', savedWordMap.get('le'), 'la →', savedWordMap.get('la'), 'des →', savedWordMap.get('des'));
        // ────────────────────────────────────────────────────────────────────
        // Re-colour any already-rendered word spans
        savedWordMap.forEach((tier, word) => {
          document.querySelectorAll(`.ls-word[data-word="${word}"]`).forEach(el => {
            el.classList.remove('ls-red', 'ls-orange', 'ls-green');
            el.classList.add('ls-' + tier);
          });
        });
        resolve();
      });
    });
  }

  // ── Netflix subtitle DOM ─────────────────────────────────────────────────
  const SELECTORS = [
    '.player-timedtext-text-container span',
    '.player-timedtext span',
    '[data-uia="player-timedtext"] span',
    '.subtitle span',
  ];
  function getNetflixText() {
    for (const sel of SELECTORS) {
      const els = document.querySelectorAll(sel);
      if (els.length) return Array.from(els).map(e => e.textContent.trim()).filter(Boolean).join(' ');
    }
    return null;
  }

  // ── Transcript log (collect lines as they appear) ─────────────────────────
  const transcriptLines = [];
  let currentLineIdx = -1;

  function logLine(text) {
    if (!text) return;
    const last = transcriptLines[transcriptLines.length - 1];
    if (last?.text === text) { currentLineIdx = transcriptLines.length - 1; updatePanelCurrent(); return; }
    transcriptLines.push({ text, tr: null });
    currentLineIdx = transcriptLines.length - 1;
    addPanelLine(currentLineIdx);
    updatePanelCurrent();
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ls-styles')) return;
    const s = document.createElement('style'); s.id = 'ls-styles';
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      .player-timedtext { visibility: hidden !important; }

      /* ── Subtitle band — below video, Language Reactor style ── */
      #ls-overlay {
        position: fixed; left: 0; right: 360px; bottom: 0;
        z-index: 2147483640; pointer-events: none;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: rgba(5,4,12,0.96);
        border-top: 1px solid rgba(124,58,237,0.2);
        padding: 14px 0 18px;
        text-align: center;
        transition: right 0.3s ease;
        min-height: 100px;
      }
      #ls-overlay.ls-panel-hidden { right: 0; }

      #ls-primary {
        display: inline-block; padding: 0 32px;
        font-size: 32px; font-weight: 700;
        color: #fff; line-height: 1.5; pointer-events: auto; cursor: pointer;
        letter-spacing: -0.2px;
      }
      #ls-secondary {
        display: block; font-size: 18px; font-weight: 400;
        color: rgba(255,255,255,0.6);
        padding: 4px 32px 0; pointer-events: none;
        letter-spacing: 0.01em;
      }
      .ls-word { cursor: pointer; border-radius: 4px; padding: 0 3px; transition: color 0.35s ease, background 0.12s; display: inline; }
      .ls-word:hover { background: rgba(255,255,255,0.14); }
      /* Exact LinguaScript deck palette — must match DECK_CONFIG in
         src/pages/Flashcards.tsx and DECK_COLORS in SubtitleOverlay.tsx so a
         word's colour is identical to its flashcard deck across every surface. */
      .ls-red    { color: #FF3B30; }
      .ls-orange { color: #FF8A00; }
      .ls-green  { color: #34C759; }

      /* ── Controls bar — sits inside the subtitle band ── */
      #ls-controls {
        position: fixed; bottom: 0; left: 0; right: 360px;
        z-index: 2147483641; display: flex; align-items: center; justify-content: center; gap: 6px;
        padding: 6px 12px 8px;
        background: rgba(4,3,10,0.98); border-top: 1px solid rgba(124,58,237,0.15);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: right 0.3s ease;
      }
      #ls-controls.ls-panel-hidden { right: 0; }
      .ls-ctrl-btn {
        background: rgba(255,255,255,0.07); color: #fff; border: none;
        border-radius: 6px; padding: 5px 11px; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: background 0.12s, transform 0.1s; white-space: nowrap;
        font-family: inherit;
      }
      .ls-ctrl-btn:hover { background: rgba(255,255,255,0.18); transform: scale(1.04); }
      .ls-ctrl-btn:active { transform: scale(0.96); }
      .ls-ctrl-btn.ls-active { background: #7c3aed; }
      .ls-kbd { font-size: 10px; color: rgba(255,255,255,0.35); margin-left: 3px; }
      .ls-divider { width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 2px; }

      /* ── Word card ── */
      #ls-card {
        position: fixed; z-index: 2147483647; width: 300px;
        background: rgba(10,10,18,0.97); border: 1px solid rgba(124,58,237,0.4);
        border-radius: 14px; padding: 16px 18px 14px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 16px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(124,58,237,0.18);
        backdrop-filter: blur(20px); pointer-events: auto; color: #fff;
        animation: ls-card-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes ls-card-in {
        from { opacity:0; transform:scale(0.88) translateY(6px); }
        to   { opacity:1; transform:scale(1) translateY(0); }
      }
      #ls-card-word  { font-size: 22px; font-weight: 800; margin-bottom: 3px; letter-spacing: -0.3px; }
      #ls-card-tier  { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; margin-bottom: 8px; opacity: 0.9; }
      #ls-card-trans { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 10px; min-height: 20px; line-height: 1.3; }
      .ls-card-section-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; color: #555; text-transform: uppercase; margin-bottom: 5px; }
      .ls-card-synonyms { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
      .ls-card-syn-chip {
        font-size: 12px; color: #b8a0ff; background: rgba(124,58,237,0.15);
        border: 1px solid rgba(124,58,237,0.25); border-radius: 20px;
        padding: 2px 9px; cursor: pointer; transition: background 0.12s;
      }
      .ls-card-syn-chip:hover { background: rgba(124,58,237,0.3); }
      .ls-card-examples { margin-bottom: 12px; }
      .ls-card-example {
        font-size: 12px; color: #777; line-height: 1.5; padding: 4px 0;
        border-left: 2px solid rgba(124,58,237,0.25); padding-left: 8px; margin-bottom: 4px;
      }
      .ls-card-example em { color: #b8a0ff; font-style: normal; font-weight: 600; }
      #ls-card-save  {
        width: 100%; padding: 9px; border: none; border-radius: 8px;
        background: #7c3aed; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
        transition: background 0.15s, transform 0.1s; font-family: inherit;
      }
      #ls-card-save:hover { background: #6d28d9; }
      #ls-card-save:active { transform: scale(0.97); }
      #ls-card-save:disabled { background: #1e1e2e; color: #444; cursor: default; transform: none; }
      #ls-card-close {
        position: absolute; top: 12px; right: 14px; background: none; border: none;
        color: #444; font-size: 16px; cursor: pointer; padding: 0; line-height: 1; transition: color 0.1s;
      }
      #ls-card-close:hover { color: #fff; }

      /* ── Mini login (shown inside card when not authenticated) ── */
      .ls-card-login-note { font-size: 12px; color: #666; margin-bottom: 10px; line-height: 1.5; }
      .ls-card-login-input {
        width: 100%; padding: 7px 10px; margin-bottom: 7px;
        background: #0d0d18; border: 1px solid #2a2a40; border-radius: 7px;
        color: #e8e8f0; font-size: 12px; outline: none; box-sizing: border-box; font-family: inherit;
        transition: border-color 0.15s;
      }
      .ls-card-login-input:focus { border-color: #7c3aed; }
      .ls-card-login-btn {
        width: 100%; padding: 8px; border: none; border-radius: 7px;
        background: #7c3aed; color: #fff; font-size: 12px; font-weight: 700;
        cursor: pointer; font-family: inherit; transition: background 0.15s;
      }
      .ls-card-login-btn:hover { background: #6d28d9; }
      .ls-card-login-btn:disabled { opacity: 0.5; cursor: default; }
      .ls-card-login-err { font-size: 11px; color: #f87171; margin-top: 5px; min-height: 14px; }

      /* ── Flashcards control button ── */
      .ls-ctrl-link {
        background: rgba(74,222,128,0.12); color: #4ade80; border: 1px solid rgba(74,222,128,0.25);
        border-radius: 6px; padding: 5px 11px; font-size: 12px; font-weight: 600;
        cursor: pointer; text-decoration: none; transition: background 0.12s; white-space: nowrap;
        font-family: inherit; display: inline-flex; align-items: center;
      }
      .ls-ctrl-link:hover { background: rgba(74,222,128,0.22); }

      /* ── Side panel ── */
      #ls-panel {
        position: fixed; top: 0; right: 0; bottom: 0; width: 360px;
        background: rgba(7,7,12,0.98); border-left: 1px solid rgba(124,58,237,0.18);
        z-index: 2147483639; display: flex; flex-direction: column;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        backdrop-filter: blur(12px); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
      }
      #ls-panel.ls-hidden { transform: translateX(360px); }
      #ls-panel-header {
        padding: 14px 16px 12px; border-bottom: 1px solid rgba(124,58,237,0.15);
        display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
      }
      #ls-panel-logo { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; color: #fff; }
      #ls-panel-logo span { color: #4ade80; }
      #ls-panel-meta { font-size: 10px; color: #444; margin-top: 1px; }
      #ls-panel-toggle {
        background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.25);
        color: #9d7bea; border-radius: 6px; cursor: pointer; font-size: 11px;
        font-weight: 600; padding: 4px 10px; transition: background 0.12s; font-family: inherit;
      }
      #ls-panel-toggle:hover { background: rgba(124,58,237,0.28); }
      #ls-panel-list { flex: 1; overflow-y: auto; padding: 6px 0 60px; }
      #ls-panel-list::-webkit-scrollbar { width: 3px; }
      #ls-panel-list::-webkit-scrollbar-track { background: transparent; }
      #ls-panel-list::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 2px; }
      .ls-panel-line {
        padding: 10px 16px 8px; cursor: pointer;
        border-left: 3px solid transparent; transition: background 0.12s, border-color 0.12s;
      }
      .ls-panel-line:hover { background: rgba(255,255,255,0.04); }
      .ls-panel-line.ls-current { border-left-color: #7c3aed; background: rgba(124,58,237,0.1); }
      .ls-panel-line-text { font-size: 14px; color: #ccc; line-height: 1.55; margin-bottom: 3px; }
      .ls-panel-line.ls-current .ls-panel-line-text { color: #fff; }
      .ls-panel-line-tr { font-size: 11px; color: #555; line-height: 1.4; }
      .ls-panel-line.ls-current .ls-panel-line-tr { color: #777; }

      #ls-toast {
        position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%);
        background: #7c3aed; color: #fff; padding: 6px 18px; border-radius: 20px;
        font-size: 13px; font-weight: 700; pointer-events: none; opacity: 0;
        transition: opacity 0.2s; z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #ls-toast.ls-show { opacity: 1; }
    `;
    document.head.appendChild(s);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    let t = document.getElementById('ls-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ls-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('ls-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('ls-show'), 2200);
  }

  // ── Word card ─────────────────────────────────────────────────────────────
  let activeCard = null;
  function closeCard() { activeCard?.remove(); activeCard = null; }

  function openCard({ word, clean, fullLine, lang, anchorEl }) {
    closeCard();
    const tier = savedWordMap.get(clean);
    const tierLabel = tier === 'green' ? '🟢 Known' : tier === 'orange' ? '🟠 Learning' : tier === 'red' ? '🔴 New word' : '⬜ Unseen';
    const tierColor = tier === 'green' ? '#4ade80' : tier === 'orange' ? '#fb923c' : tier === 'red' ? '#f87171' : '#666';
    const alreadySaved = !!tier;

    const card = document.createElement('div'); card.id = 'ls-card'; activeCard = card;
    card.innerHTML = `
      <button id="ls-card-close">✕</button>
      <div id="ls-card-word">${word}</div>
      <div id="ls-card-tier" style="color:${tierColor}">${tierLabel}</div>
      <div id="ls-card-trans" style="color:#555;font-style:italic;font-size:14px;">looking up…</div>
      <div id="ls-card-body"></div>
      <button id="ls-card-save"${alreadySaved ? ' disabled' : ''}>${alreadySaved ? '✓ In your flashcards' : '+ Save to flashcards'}</button>
    `;
    document.body.appendChild(card);
    card.querySelector('#ls-card-close').addEventListener('click', closeCard);

    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left + rect.width/2 - 150;
    left = Math.max(8, Math.min(left, window.innerWidth - 308));
    const top = rect.top - 180 < 8 ? rect.bottom + 8 : rect.top - 180;
    card.style.left = left + 'px'; card.style.top = top + 'px';

    setTimeout(() => document.addEventListener('click', e => { if (!card.contains(e.target)) closeCard(); }, { once: true }), 0);

    let resolvedTranslation = '';

    chrome.runtime.sendMessage(
      { type: 'WORD_DETAIL', word: clean, sourceLang: lang, targetLang: currentNativeLang },
      detail => {
        if (!activeCard) return;
        const transEl = card.querySelector('#ls-card-trans');
        const bodyEl  = card.querySelector('#ls-card-body');

        if (detail?.ok && detail.translation) {
          resolvedTranslation = detail.translation;
          if (transEl) transEl.textContent = detail.translation;

          let bodyHTML = '';

          // Synonyms
          if (detail.synonymGroups?.length) {
            const chips = detail.synonymGroups
              .flatMap(g => g.words)
              .slice(0, 10)
              .map(w => `<span class="ls-card-syn-chip">${w}</span>`)
              .join('');
            bodyHTML += `<div class="ls-card-section-label">Synonyms</div><div class="ls-card-synonyms">${chips}</div>`;
          }

          // Current subtitle as first example
          const examples = [];
          if (fullLine && fullLine !== clean) {
            const highlighted = fullLine.replace(new RegExp(`\\b${clean}\\b`, 'gi'), m => `<em>${m}</em>`);
            examples.push(`<div class="ls-card-example">${highlighted}</div>`);
          }
          // Tatoeba examples from GTX
          if (detail.examples?.length) {
            detail.examples.slice(0, 2).forEach(ex => {
              const highlighted = ex.replace(new RegExp(`\\b${clean}\\b`, 'gi'), m => `<em>${m}</em>`);
              examples.push(`<div class="ls-card-example">${highlighted}</div>`);
            });
          }
          if (examples.length) {
            bodyHTML += `<div class="ls-card-section-label">Examples</div><div class="ls-card-examples">${examples.join('')}</div>`;
          }

          if (bodyEl) bodyEl.innerHTML = bodyHTML;
        } else {
          // Fallback to plain translation
          translate(clean, currentNativeLang, lang).then(tr => {
            resolvedTranslation = tr || '';
            if (transEl) { transEl.style.cssText = 'font-size:15px;color:#e5e5e5;margin-bottom:12px;'; transEl.textContent = tr || 'Translation unavailable'; }
          });
        }
      }
    );

    // Check auth — swap save button for mini login if not signed in
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, authRes => {
      if (!activeCard) return;
      const isLoggedIn = !!authRes?.session;
      const saveBtn = card.querySelector('#ls-card-save');

      if (!isLoggedIn) {
        // Replace save button with inline login form
        saveBtn.replaceWith(buildMiniLogin(card, clean, fullLine, lang, () => resolvedTranslation));
      } else {
        saveBtn.addEventListener('click', () => {
          saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
          chrome.runtime.sendMessage(
            { type: 'SAVE_WORD', word: clean, context: fullLine, language: lang, translation: resolvedTranslation },
            res => {
              if (chrome.runtime.lastError || !res?.ok) {
                saveBtn.textContent = '+ Save to flashcards'; saveBtn.disabled = false; return;
              }
              savedWordMap.set(clean, 'red');
              document.querySelectorAll(`.ls-word[data-word="${clean}"]`).forEach(el => {
                el.classList.remove('ls-orange', 'ls-green'); el.classList.add('ls-red');
              });
              saveBtn.textContent = res.already ? '✓ Already saved' : '✓ Saved!';
              saveBtn.disabled = true;
              setTimeout(closeCard, 900);
            }
          );
        });
      }
    });
  }

  function buildMiniLogin(card, word, context, lang, getTranslation) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="ls-card-login-note">Log in to save words to your flashcards.</p>
      <input class="ls-card-login-input" id="ls-mini-email" type="email" placeholder="Email" autocomplete="email" />
      <input class="ls-card-login-input" id="ls-mini-pw" type="password" placeholder="Password" autocomplete="current-password" />
      <button class="ls-card-login-btn" id="ls-mini-submit">Log in &amp; Save</button>
      <div class="ls-card-login-err" id="ls-mini-err"></div>
    `;

    // Stop card from closing when typing
    wrap.addEventListener('click', e => e.stopPropagation());

    wrap.querySelector('#ls-mini-submit').addEventListener('click', () => {
      const email = wrap.querySelector('#ls-mini-email').value.trim();
      const pw    = wrap.querySelector('#ls-mini-pw').value;
      const errEl = wrap.querySelector('#ls-mini-err');
      const btn   = wrap.querySelector('#ls-mini-submit');
      if (!email || !pw) { errEl.textContent = 'Enter your email and password.'; return; }
      btn.textContent = 'Logging in…'; btn.disabled = true; errEl.textContent = '';

      chrome.runtime.sendMessage({ type: 'SIGN_IN', email, password: pw }, res => {
        if (!res?.ok) {
          errEl.textContent = res?.error || 'Login failed — check credentials.';
          btn.textContent = 'Log in & Save'; btn.disabled = false; return;
        }
        // Logged in — now save the word
        btn.textContent = 'Saving…';
        chrome.runtime.sendMessage(
          { type: 'SAVE_WORD', word, context, language: lang, translation: getTranslation() },
          saveRes => {
            if (!saveRes?.ok) { btn.textContent = 'Saved (refresh to colour words)'; btn.disabled = true; return; }
            savedWordMap.set(word, 'red');
            document.querySelectorAll(`.ls-word[data-word="${word}"]`).forEach(el => {
              el.classList.remove('ls-orange', 'ls-green'); el.classList.add('ls-red');
            });
            btn.textContent = '✓ Saved!'; btn.disabled = true;
            setTimeout(closeCard, 900);
          }
        );
      });
    });

    // Enter key submits
    wrap.querySelector('#ls-mini-pw').addEventListener('keydown', e => {
      if (e.key === 'Enter') wrap.querySelector('#ls-mini-submit').click();
    });

    return wrap;
  }

  // ── Word span ─────────────────────────────────────────────────────────────
  function makeWordSpan(word, fullLine, lang) {
    const clean = word.replace(/[.,!?;:"""''«»¿¡\n]/g,'').trim().toLowerCase();
    if (!clean) return document.createTextNode(word + ' ');
    const span = document.createElement('span');
    span.className = 'ls-word'; span.dataset.word = clean; span.textContent = word + ' ';
    const col = savedWordMap.get(clean); if (col) span.classList.add('ls-' + col);
    span.addEventListener('click', e => { e.stopPropagation(); openCard({ word, clean, fullLine, lang, anchorEl: span }); });
    return span;
  }

  // ── Side panel ────────────────────────────────────────────────────────────
  let panelVisible = true;

  function buildPanel() {
    if (document.getElementById('ls-panel')) return;
    const panel = document.createElement('div'); panel.id = 'ls-panel';
    panel.innerHTML = `
      <div id="ls-panel-header">
        <div>
          <div id="ls-panel-logo">Lingua<span>Script</span></div>
          <div id="ls-panel-meta">Transcript</div>
        </div>
        <button id="ls-panel-toggle">Hide</button>
      </div>
      <div id="ls-panel-list"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById('ls-panel-toggle').addEventListener('click', () => togglePanel(false));
  }

  function togglePanel(show) {
    panelVisible = show ?? !panelVisible;
    const panel = document.getElementById('ls-panel');
    const overlay = document.getElementById('ls-overlay');
    const controls = document.getElementById('ls-controls');
    if (panel) panel.classList.toggle('ls-hidden', !panelVisible);
    if (overlay) overlay.classList.toggle('ls-panel-hidden', !panelVisible);
    if (controls) controls.classList.toggle('ls-panel-hidden', !panelVisible);
    const btn = document.getElementById('ls-panel-btn');
    if (btn) btn.classList.toggle('ls-active', panelVisible);
  }

  function addPanelLine(idx) {
    const list = document.getElementById('ls-panel-list'); if (!list) return;
    const div = document.createElement('div');
    div.className = 'ls-panel-line'; div.dataset.idx = idx;
    div.innerHTML = `<div class="ls-panel-line-text">${transcriptLines[idx].text}</div><div class="ls-panel-line-tr"></div>`;
    div.addEventListener('click', () => {
      // Seek back to approximate position by replaying (Netflix has no timestamps)
      const v = document.querySelector('video');
      if (v) {
        const diff = idx - currentLineIdx;
        if (diff < 0) v.currentTime = Math.max(0, v.currentTime + (diff * 5) - 2);
      }
      currentLineIdx = idx;
      updatePanelCurrent();
    });
    list.appendChild(div);
    // Lazy translate for panel
    translate(transcriptLines[idx].text, currentNativeLang, currentLang).then(tr => {
      if (tr) {
        transcriptLines[idx].tr = tr;
        const trEl = div.querySelector('.ls-panel-line-tr');
        if (trEl) trEl.textContent = tr;
      }
    });
  }

  function updatePanelCurrent() {
    document.querySelectorAll('.ls-panel-line').forEach(el => {
      el.classList.toggle('ls-current', parseInt(el.dataset.idx) === currentLineIdx);
    });
    const current = document.querySelector('.ls-panel-line.ls-current');
    if (current) current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  let lastPrimary = null, lastSecondarySource = null;

  function renderPrimary(text) {
    if (text === lastPrimary) return; lastPrimary = text;
    logLine(text);
    const el = document.getElementById('ls-primary'); if (!el) return;
    el.innerHTML = '';
    el.onclick = () => { const v = document.querySelector('video'); if (v) v.currentTime = Math.max(0, v.currentTime - 4); };
    text.split(/\s+/).filter(Boolean).forEach(w => el.appendChild(makeWordSpan(w, text, currentLang)));
  }

  function renderSecondary(text) {
    const el = document.getElementById('ls-secondary'); if (!el) return;
    el.textContent = text || ''; el.style.display = text ? 'block' : 'none';
  }

  function clearOverlay() {
    if (!lastPrimary) return; lastPrimary = null; lastSecondarySource = null;
    const el = document.getElementById('ls-primary'); if (el) el.innerHTML = '';
    renderSecondary('');
    const ov = document.getElementById('ls-overlay'); if (ov) ov.style.opacity = '0';
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  let autoPause = false, autoPauseArmed = false, overlayVisible = true;

  function buildControls() {
    if (document.getElementById('ls-controls')) return;
    const bar = document.createElement('div'); bar.id = 'ls-controls';

    const btn = (label, hint, onClick, id) => {
      const b = document.createElement('button'); b.className = 'ls-ctrl-btn';
      if (id) b.id = id;
      b.innerHTML = `${label}<span class="ls-kbd">${hint}</span>`;
      b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
      return b;
    };
    const sep = () => { const d = document.createElement('div'); d.className = 'ls-divider'; return d; };

    const apBtn = btn('A|P Off', 'Q', () => {
      autoPause = !autoPause; autoPauseArmed = false;
      apBtn.innerHTML = `${autoPause ? 'A|P On' : 'A|P Off'}<span class="ls-kbd">Q</span>`;
      apBtn.classList.toggle('ls-active', autoPause);
    });

    const panelBtn = btn('≡ Subs', '', () => togglePanel(), 'ls-panel-btn');
    panelBtn.classList.add('ls-active');

    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const speedBtns = speeds.map(sp => {
      const b = btn(sp + '×', '', () => {
        const v = document.querySelector('video'); if (v) v.playbackRate = sp;
        speedBtns.forEach(b2 => b2.classList.remove('ls-active'));
        b.classList.add('ls-active');
      });
      if (sp === 1) b.classList.add('ls-active');
      return b;
    });

    const hideBtn = btn('LS', '', () => {
      overlayVisible = !overlayVisible;
      hideBtn.innerHTML = 'LS'; hideBtn.classList.toggle('ls-active', overlayVisible);
      const ov = document.getElementById('ls-overlay'); if (ov) ov.style.opacity = overlayVisible ? '1' : '0';
      document.querySelectorAll('.player-timedtext').forEach(el => {
        el.style.visibility = overlayVisible ? 'hidden' : '';
      });
    });
    hideBtn.classList.add('ls-active');

    const flashcardsLink = document.createElement('a');
    flashcardsLink.className = 'ls-ctrl-link';
    flashcardsLink.href = 'https://linguascript.co.uk/flashcards';
    flashcardsLink.target = '_blank';
    flashcardsLink.rel = 'noopener noreferrer';
    flashcardsLink.textContent = '📚 Flashcards';

    [btn('⏮', 'A', () => { const v = document.querySelector('video'); if (v) v.currentTime = Math.max(0, v.currentTime - 8); }),
     btn('↩', 'S', () => { const v = document.querySelector('video'); if (v) v.currentTime = Math.max(0, v.currentTime - 4); }),
     btn('⏭', 'D', () => { const v = document.querySelector('video'); if (v) v.currentTime += 3; }),
     sep(), apBtn, sep(), ...speedBtns, sep(), panelBtn, hideBtn, sep(), flashcardsLink
    ].forEach(el => bar.appendChild(el));
    document.body.appendChild(bar);
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  function attachKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
      const v = document.querySelector('video');
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); if (v) v.currentTime = Math.max(0, v.currentTime - 4); }
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); if (v) v.currentTime = Math.max(0, v.currentTime - 8); }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); if (v) v.currentTime += 3; }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        autoPause = !autoPause; autoPauseArmed = false;
        document.querySelectorAll('#ls-controls .ls-ctrl-btn').forEach(b => {
          if (b.textContent.includes('A|P')) {
            b.innerHTML = `${autoPause ? 'A|P On' : 'A|P Off'}<span class="ls-kbd">Q</span>`;
            b.classList.toggle('ls-active', autoPause);
          }
        });
        showToast(autoPause ? 'Auto-pause ON' : 'Auto-pause OFF');
      }
    }, true);
  }

  // ── MutationObserver ───────────────────────────────────────────────────────
  let clearDebounce = null, translateDebounce = null;

  function onSubtitleChange() {
    const text = getNetflixText();
    const overlay = document.getElementById('ls-overlay');

    if (!text) {
      clearTimeout(clearDebounce);
      clearDebounce = setTimeout(() => {
        if (!getNetflixText()) {
          clearOverlay();
          if (autoPause) {
            autoPauseArmed = true;
            const v = document.querySelector('video');
            if (v && !v.paused) v.pause();
          }
        }
      }, 400);
      return;
    }

    clearTimeout(clearDebounce);
    if (overlay) overlay.style.opacity = '1';
    renderPrimary(text);

    if (currentLang !== currentNativeLang && text !== lastSecondarySource) {
      lastSecondarySource = text;
      clearTimeout(translateDebounce);
      translateDebounce = setTimeout(async () => {
        const tr = await translate(text, currentNativeLang, currentLang);
        if (lastSecondarySource === text) renderSecondary(tr || '');
      }, 150);
    }
  }

  // ── Mount ─────────────────────────────────────────────────────────────────
  let currentLang = 'fr', currentNativeLang = 'en';
  let mounted = false;

  async function mount() {
    if (mounted) return; mounted = true;
    injectStyles();

    const overlay = document.createElement('div'); overlay.id = 'ls-overlay';
    overlay.innerHTML = `<div id="ls-primary"></div><div id="ls-secondary" style="display:none"></div>`;
    document.body.appendChild(overlay);

    buildPanel();
    buildControls();
    attachKeyboardShortcuts();

    const { ls_language: lang = 'fr', ls_native_language: nativeLang = 'en' } =
      await getStorage({ ls_language: 'fr', ls_native_language: 'en' });
    currentLang = lang; currentNativeLang = nativeLang;

    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, async res => {
      if (res?.session) { await loadSavedWords(); startWordsRefresh(); }
    });

    const target = document.querySelector('.watch-video') || document.body;
    new MutationObserver(onSubtitleChange).observe(target, { childList: true, subtree: true, characterData: true });
  }

  // Poll saved_words periodically so a word promoted in the app's flashcards
  // (red → orange → green) recolours in the Netflix overlay without a reload.
  // loadSavedWords() re-applies colours to already-rendered spans, so this is
  // cheap: one indexed query per open video tab.
  let wordsRefreshTimer = null;
  function startWordsRefresh() {
    if (wordsRefreshTimer) return;
    wordsRefreshTimer = setInterval(loadSavedWords, 15000);
  }

  function waitForPlayer() {
    const found = ['.watch-video', '.NFPlayer', '[data-uia="video-canvas"]'].some(s => document.querySelector(s));
    if (found) mount(); else setTimeout(waitForPlayer, 1000);
  }

  waitForPlayer();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_LINE_COUNT') { sendResponse({ count: savedWordMap.size }); return true; }
  });

})();
