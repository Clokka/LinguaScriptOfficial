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

  // ── Translation — direct fetch first, SW fallback ────────────────────────
  async function translate(text, targetLang, sourceLang = 'auto') {
    const sl = (sourceLang && sourceLang !== 'auto') ? sourceLang : 'fr';

    // 1. Try direct fetch from content script (extension host_permissions bypass CSP)
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${targetLang}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const tr = data?.responseData?.translatedText;
        if (tr && !tr.startsWith('MYMEMORY WARNING') && tr.toLowerCase() !== text.toLowerCase()) {
          return tr;
        }
      }
    } catch(e) { console.warn('[LS] direct fetch failed:', e.message); }

    // 2. Fallback: route through background service worker
    return new Promise(resolve => {
      let tries = 0;
      function attempt() {
        tries++;
        chrome.runtime.sendMessage({ type: 'TRANSLATE', text, targetLang, sourceLang }, res => {
          if (chrome.runtime.lastError) {
            if (tries < 3) { setTimeout(attempt, 500); return; }
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
  async function loadSavedWords(accessToken, userId) {
    try {
      const SUPA = 'https://ffephracinqeylfhqkiz.supabase.co';
      const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA';
      const res = await fetch(`${SUPA}/rest/v1/saved_words?user_id=eq.${userId}&select=word,review_count,interval_days,ease_factor`,
        { headers: { apikey: KEY, Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      savedWordMap.clear();
      for (const r of await res.json()) {
        const w = r.word.toLowerCase(), count = r.review_count||0, interval = r.interval_days||0, ease = r.ease_factor||2.5;
        savedWordMap.set(w, (interval>=21||(count>=5&&ease>=2.5)) ? 'green' : (count>=2||interval>=3) ? 'orange' : 'red');
      }
    } catch {}
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
      .player-timedtext { visibility: hidden !important; }

      #ls-overlay {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        z-index: 2147483640; text-align: center; pointer-events: none;
        width: calc(90% - 340px); max-width: 860px;
        font-family: 'Netflix Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: width 0.3s;
      }
      #ls-overlay.ls-panel-hidden { width: 90%; max-width: 900px; }
      #ls-primary {
        display: inline-block; background: rgba(8,8,8,0.82); border-radius: 4px;
        padding: 6px 20px 8px; margin-bottom: 4px; font-size: 24px; font-weight: 700;
        color: #fff; line-height: 1.55; pointer-events: auto; cursor: pointer;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8); letter-spacing: 0.01em;
      }
      #ls-secondary {
        display: block; font-size: 15px; color: rgba(255,255,255,0.75);
        background: rgba(8,8,8,0.6); border-radius: 3px;
        padding: 2px 12px; pointer-events: none; letter-spacing: 0.01em;
      }
      .ls-word { cursor: pointer; border-radius: 3px; padding: 0 2px; transition: background 0.12s; display: inline; }
      .ls-word:hover { background: rgba(255,255,255,0.18); }
      .ls-red    { color: #f87171; }
      .ls-orange { color: #fb923c; }
      .ls-green  { color: #4ade80; }

      #ls-controls {
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        z-index: 2147483640; display: flex; align-items: center; gap: 6px;
        background: rgba(8,8,8,0.82); border-radius: 8px; padding: 6px 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        backdrop-filter: blur(6px);
      }
      .ls-ctrl-btn {
        background: rgba(255,255,255,0.08); color: #fff; border: none;
        border-radius: 5px; padding: 5px 10px; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: background 0.12s; white-space: nowrap;
      }
      .ls-ctrl-btn:hover { background: rgba(255,255,255,0.2); }
      .ls-ctrl-btn.ls-active { background: #7c3aed; }
      .ls-kbd { font-size: 10px; color: rgba(255,255,255,0.4); margin-left: 3px; }
      .ls-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.15); margin: 0 2px; }

      #ls-card {
        position: fixed; z-index: 2147483647; width: 260px;
        background: rgba(12,12,18,0.92); border: 1px solid rgba(124,58,237,0.35);
        border-radius: 12px; padding: 14px 16px 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.15);
        backdrop-filter: blur(16px); pointer-events: auto; color: #fff;
      }
      #ls-card-word  { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
      #ls-card-trans { font-size: 15px; color: #e5e5e5; margin-bottom: 12px; min-height: 20px; }
      #ls-card-save  {
        width: 100%; padding: 8px; border: none; border-radius: 6px;
        background: #7c3aed; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
      }
      #ls-card-save:disabled { background: #333; color: #666; cursor: default; }
      #ls-card-close {
        position: absolute; top: 10px; right: 12px; background: none; border: none;
        color: #666; font-size: 16px; cursor: pointer; padding: 0; line-height: 1;
      }
      #ls-card-close:hover { color: #fff; }

      /* Side panel */
      #ls-panel {
        position: fixed; top: 0; right: 0; bottom: 0; width: 320px;
        background: rgba(8,8,8,0.96); border-left: 1px solid rgba(255,255,255,0.08);
        z-index: 2147483639; display: flex; flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        backdrop-filter: blur(10px); transition: transform 0.3s;
      }
      #ls-panel.ls-hidden { transform: translateX(320px); }
      #ls-panel-header {
        padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08);
        font-size: 12px; font-weight: 700; color: #888; letter-spacing: 0.08em;
        text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;
      }
      #ls-panel-close { background: none; border: none; color: #555; cursor: pointer; font-size: 16px; }
      #ls-panel-close:hover { color: #fff; }
      #ls-panel-list { flex: 1; overflow-y: auto; padding: 8px 0; }
      #ls-panel-list::-webkit-scrollbar { width: 4px; }
      #ls-panel-list::-webkit-scrollbar-track { background: transparent; }
      #ls-panel-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      .ls-panel-line {
        padding: 8px 14px; cursor: pointer; border-left: 3px solid transparent; transition: background 0.1s;
      }
      .ls-panel-line:hover { background: rgba(255,255,255,0.05); }
      .ls-panel-line.ls-current { border-left-color: #7c3aed; background: rgba(124,58,237,0.08); }
      .ls-panel-line-text { font-size: 13px; color: #ddd; line-height: 1.45; }
      .ls-panel-line-tr   { font-size: 11px; color: #666; margin-top: 2px; line-height: 1.4; }

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
    const card = document.createElement('div'); card.id = 'ls-card'; activeCard = card;
    card.innerHTML = `
      <button id="ls-card-close">✕</button>
      <div id="ls-card-word">${word}</div>
      <div id="ls-card-trans" style="color:#555;font-style:italic;">translating…</div>
      <button id="ls-card-save">+ Save to flashcards</button>
    `;
    document.body.appendChild(card);
    card.querySelector('#ls-card-close').addEventListener('click', closeCard);

    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left + rect.width/2 - 130;
    left = Math.max(8, Math.min(left, window.innerWidth - 268));
    const top = rect.top - 140 < 8 ? rect.bottom + 8 : rect.top - 140;
    card.style.left = left + 'px'; card.style.top = top + 'px';

    setTimeout(() => document.addEventListener('click', e => { if (!card.contains(e.target)) closeCard(); }, { once: true }), 0);

    let resolvedTranslation = '';
    translate(clean, currentNativeLang, currentLang).then(tr => {
      resolvedTranslation = tr || '';
      const el = card.querySelector('#ls-card-trans');
      if (el) { el.style.cssText = 'font-size:15px;color:#e5e5e5;margin-bottom:12px;'; el.textContent = tr || 'Translation unavailable'; }
    });

    card.querySelector('#ls-card-save').addEventListener('click', () => {
      const btn = card.querySelector('#ls-card-save');
      btn.textContent = 'Saving…'; btn.disabled = true;
      chrome.runtime.sendMessage(
        { type: 'SAVE_WORD', word: clean, context: fullLine, language: lang, translation: resolvedTranslation },
        res => {
          if (chrome.runtime.lastError || !res?.ok) { btn.textContent = 'Not logged in'; return; }
          savedWordMap.set(clean, 'red');
          document.querySelectorAll(`.ls-word[data-word="${clean}"]`).forEach(el => {
            el.classList.remove('ls-orange', 'ls-green'); el.classList.add('ls-red');
          });
          btn.textContent = res.already ? 'Already saved' : 'Saved!';
          setTimeout(closeCard, 800);
        }
      );
    });
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
        <span>Transcript</span>
        <button id="ls-panel-close">✕</button>
      </div>
      <div id="ls-panel-list"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById('ls-panel-close').addEventListener('click', () => togglePanel(false));
  }

  function togglePanel(show) {
    panelVisible = show ?? !panelVisible;
    const panel = document.getElementById('ls-panel');
    const overlay = document.getElementById('ls-overlay');
    if (panel) panel.classList.toggle('ls-hidden', !panelVisible);
    if (overlay) overlay.classList.toggle('ls-panel-hidden', !panelVisible);
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

    [btn('⏮', 'A', () => { const v = document.querySelector('video'); if (v) v.currentTime = Math.max(0, v.currentTime - 8); }),
     btn('↩', 'S', () => { const v = document.querySelector('video'); if (v) v.currentTime = Math.max(0, v.currentTime - 4); }),
     btn('⏭', 'D', () => { const v = document.querySelector('video'); if (v) v.currentTime += 3; }),
     sep(), apBtn, sep(), ...speedBtns, sep(), panelBtn, hideBtn
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
      if (res?.session) await loadSavedWords(res.session.access_token, res.session.user.id);
    });

    const target = document.querySelector('.watch-video') || document.body;
    new MutationObserver(onSubtitleChange).observe(target, { childList: true, subtree: true, characterData: true });
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
