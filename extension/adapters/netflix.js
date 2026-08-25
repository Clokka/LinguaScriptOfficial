// LinguaScript — Netflix adapter
// Netflix has no caption API we can rely on, so we scrape the live subtitle DOM
// and mirror it into our overlay. Native subs are hidden via LSCore's
// SubtitleShield ONLY while our overlay is actually showing text.
(() => {
  const C = window.LSCore;
  if (!C) { console.warn('[LinguaScript] core not loaded'); return; }
  C.keepAlive();

  const OVERLAY_CSS = `
    #ls-overlay { position:fixed; left:0; right:360px; bottom:0; z-index:2147483640; pointer-events:none; font-family:'Inter',-apple-system,sans-serif; background:rgba(5,4,12,0.96); border-top:1px solid hsla(145, 63%, 49%, 0.2); padding:14px 0 50px; text-align:center; transition:right .3s ease, opacity .15s ease; min-height:100px; }
    #ls-overlay.ls-panel-hidden { right:0; }
    #ls-primary { display:inline-block; padding:0 32px; font-size:32px; font-weight:700; color:#fff; line-height:1.5; pointer-events:auto; cursor:pointer; letter-spacing:-0.2px; }
    #ls-secondary { display:block; font-size:18px; font-weight:400; color:rgba(255,255,255,0.6); padding:4px 32px 0; pointer-events:none; }
    #ls-controls { bottom:10px; }
  `;

  const SELECTORS = [
    '.player-timedtext-text-container span',
    '.player-timedtext span',
    '[data-uia="player-timedtext"] span',
    '.subtitle span',
  ];
  function getText() {
    for (const sel of SELECTORS) {
      const els = document.querySelectorAll(sel);
      if (els.length) return Array.from(els).map((e) => e.textContent.trim()).filter(Boolean).join(' ');
    }
    return null;
  }

  const shield = C.SubtitleShield('.player-timedtext');
  const video = () => document.querySelector('video');

  // ── Transcript panel (incremental — Netflix gives no timestamps) ────────────
  const transcriptLines = [];
  let currentLineIdx = -1;
  let panelListEl = null;

  function logLine(text) {
    if (!text) return;
    const last = transcriptLines[transcriptLines.length - 1];
    if (last?.text === text) { currentLineIdx = transcriptLines.length - 1; updatePanelCurrent(); return; }
    transcriptLines.push({ text });
    currentLineIdx = transcriptLines.length - 1;
    addPanelLine(currentLineIdx);
    updatePanelCurrent();
  }
  function addPanelLine(idx) {
    if (!panelListEl) return;
    const div = document.createElement('div');
    div.className = 'ls-panel-line'; div.dataset.idx = idx;
    const textEl = document.createElement('div'); textEl.className = 'ls-panel-line-text';
    textEl.appendChild(C.makeWordSpansFor(transcriptLines[idx].text, true)); // panelMode: no gold here
    const trEl = document.createElement('div'); trEl.className = 'ls-panel-line-tr';
    div.appendChild(textEl); div.appendChild(trEl);
    div.addEventListener('click', () => {
      const v = video();
      if (v) { const diff = idx - currentLineIdx; if (diff < 0) v.currentTime = Math.max(0, v.currentTime + diff * 5 - 2); }
      currentLineIdx = idx; updatePanelCurrent();
    });
    panelListEl.appendChild(div);
    C.translate(transcriptLines[idx].text, C.nativeLang, C.learningLang).then((tr) => { if (tr) trEl.textContent = tr; });
  }
  function updatePanelCurrent() {
    document.querySelectorAll('.ls-panel-line').forEach((el) => el.classList.toggle('ls-current', parseInt(el.dataset.idx) === currentLineIdx));
    document.querySelector('.ls-panel-line.ls-current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  let lastPrimary = null, lastSecondarySource = null, autoPause = false, autoPauseArmed = false;
  let clearDebounce = null, translateDebounce = null;

  function renderPrimary(text) {
    if (text === lastPrimary) return; lastPrimary = text;
    logLine(text);
    const el = document.getElementById('ls-primary'); if (!el) return;
    el.innerHTML = '';
    el.onclick = () => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime - 4); };
    text.split(/\s+/).filter(Boolean).forEach((w) => el.appendChild(C.makeWordSpan(w, text)));
    // Line Blast only celebrates a line that was still incomplete when it
    // first appeared — arm it now, before anything can promote its words.
    C.LineBlast.armLine(text, C.learningLang);
    C.LineBlast.completeLine(text, C.learningLang);
  }
  function renderSecondary(text) {
    const el = document.getElementById('ls-secondary'); if (!el) return;
    el.textContent = text || ''; el.style.display = text ? 'block' : 'none';
  }
  function clearOverlay() {
    if (!lastPrimary) return; lastPrimary = null; lastSecondarySource = null;
    const el = document.getElementById('ls-primary'); if (el) el.innerHTML = '';
    renderSecondary('');
    document.getElementById('ls-overlay')?.style && (document.getElementById('ls-overlay').style.opacity = '0');
    shield.show(); // overlay empty → always let native subs through
  }

  function onSubtitleChange() {
    const text = getText();
    const overlay = document.getElementById('ls-overlay');
    if (!text) {
      clearTimeout(clearDebounce);
      clearDebounce = setTimeout(() => {
        if (!getText()) {
          clearOverlay();
          if (autoPause) { autoPauseArmed = true; const v = video(); if (v && !v.paused) v.pause(); }
        }
      }, 400);
      return;
    }
    clearTimeout(clearDebounce);
    try {
      if (overlay) overlay.style.opacity = '1';
      renderPrimary(text);
      shield.noteContent(); // we now have text → safe to hide native subs
    } catch (e) {
      shield.show(); // never strand the viewer on a render error
      console.warn('[LinguaScript] render failed, native subs restored', e);
    }
    if (C.learningLang !== C.nativeLang && text !== lastSecondarySource) {
      lastSecondarySource = text;
      clearTimeout(translateDebounce);
      translateDebounce = setTimeout(async () => {
        const tr = await C.translate(text, C.nativeLang, C.learningLang);
        if (lastSecondarySource === text) renderSecondary(tr || '');
      }, 150);
    }
  }

  // ── Mount ─────────────────────────────────────────────────────────────────────
  let mounted = false;
  async function mount() {
    if (mounted) return; mounted = true;
    C.injectStyles(OVERLAY_CSS);
    const overlay = document.createElement('div'); overlay.id = 'ls-overlay';
    overlay.innerHTML = `<div id="ls-primary"></div><div id="ls-secondary" style="display:none"></div>`;
    document.body.appendChild(overlay);

    // A new title means a fresh set of lines — the combo/armed/blasted state
    // from whatever was playing before must not leak into this one.
    C.LineBlast.reset();
    C.LineBlast.bindElements(document.getElementById('ls-primary'), overlay);
    // A word promoted elsewhere (flashcard review, another tab) while this
    // exact line is still on screen is exactly the kind of external
    // promotion Line Blast is meant to catch — re-check on every deck sync.
    C.Deck.onRefresh(() => { if (lastPrimary) C.LineBlast.completeLine(lastPrimary, C.learningLang); });

    panelListEl = C.buildPanelShell('Transcript');
    C.buildControls({
      seekBack: () => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime - 8); },
      seekRepeat: () => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime - 4); },
      seekForward: () => { const v = video(); if (v) v.currentTime += 3; },
      onSpeed: (sp) => { const v = video(); if (v) v.playbackRate = sp; },
      onAutoPause: (v) => { autoPause = v; autoPauseArmed = false; },
      getAutoPause: () => autoPause,
      onToggleOverlay: (visible) => { visible ? shield.hide() : shield.show(); },
      extraLinks: [{ label: '📚 Flashcards', href: 'https://linguascript.co.uk/flashcards' }],
    });
    C.attachKeyboardShortcuts({
      seekBack: () => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime - 8); },
      seekRepeat: () => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime - 4); },
      seekForward: () => { const v = video(); if (v) v.currentTime += 3; },
      onAutoPause: (v) => { autoPause = v; autoPauseArmed = false; },
      getAutoPause: () => autoPause,
    });

    const { ls_language: lang = 'fr', ls_native_language: nativeLang = 'en', ls_debug: dbg = false } =
      await C.getStorage({ ls_language: 'fr', ls_native_language: 'en', ls_debug: false });
    C.setLangs(lang, nativeLang); C.setDebug(dbg);

    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, async (res) => {
      if (res?.session) { await C.loadSavedWords(); C.startWordsRefresh(); }
    });

    shield.start(); // watchdog + unload-restore
    const target = document.querySelector('.watch-video') || document.body;
    new MutationObserver(onSubtitleChange).observe(target, { childList: true, subtree: true, characterData: true });
  }

  function waitForPlayer() {
    const found = ['.watch-video', '.NFPlayer', '[data-uia="video-canvas"]'].some((s) => document.querySelector(s));
    if (found) mount(); else setTimeout(waitForPlayer, 1000);
  }
  waitForPlayer();
})();
