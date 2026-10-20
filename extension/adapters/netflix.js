// LinguaScript — Netflix adapter
// Netflix has no caption API we can rely on, so LSCore.LiveCaptions reads the
// live subtitle DOM and mirrors it into our overlay. Native subs are hidden via
// SubtitleShield ONLY while our overlay is actually showing text.
(() => {
  const C = window.LSCore;
  if (!C) { console.warn('[LinguaScript] core not loaded'); return; }
  C.keepAlive();

  const OVERLAY_CSS = `
    #ls-overlay { position:fixed; left:0; right:360px; bottom:0; z-index:2147483640; pointer-events:none; font-family:'LS Inter','Inter',system-ui,-apple-system,sans-serif; background:rgba(8,8,11,0.96); border-top:1px solid rgba(52,199,89,0.25); padding:14px 0 50px; text-align:center; transition:right .3s ease, opacity .15s ease; min-height:100px; }
    #ls-overlay.ls-panel-hidden { right:0; }
    #ls-primary { display:inline-block; padding:0 32px; font-size:34px; font-weight:800; color:#fff; line-height:1.5; pointer-events:auto; cursor:pointer; letter-spacing:-0.2px; }
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

  const video = () => document.querySelector('video');
  const speed = C.SpeedKeeper(video);
  const live = C.LiveCaptions({
    getText,
    getTarget: () => document.querySelector('.watch-video') || document.body,
    shield: C.SubtitleShield('.player-timedtext'),
    getVideo: video,
  });

  // ── Mount ─────────────────────────────────────────────────────────────────────
  let mounted = false;
  async function mount() {
    if (mounted) return; mounted = true;
    C.injectStyles(OVERLAY_CSS);
    const overlay = document.createElement('div'); overlay.id = 'ls-overlay';
    overlay.innerHTML = `<div id="ls-primary" translate="no"></div><div id="ls-secondary" style="display:none"></div>`;
    document.body.appendChild(overlay);

    const panelListEl = C.buildPanelShell('Transcript');
    const seekBack = () => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime - 8); };
    const seekRepeat = () => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime - 4); };
    const seekForward = () => { const v = video(); if (v) v.currentTime += 3; };
    C.buildControls({
      seekBack, seekRepeat, seekForward,
      onSpeed: speed.set,
      onAutoPause: live.setAutoPause,
      getAutoPause: live.getAutoPause,
      onToggleOverlay: live.setVisible,
      extraLinks: [{ label: '📚 Flashcards', href: 'https://linguascript.co.uk/flashcards' }],
    });
    C.attachKeyboardShortcuts({ seekBack, seekRepeat, seekForward, onAutoPause: live.setAutoPause, getAutoPause: live.getAutoPause });

    await C.loadLangs();

    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, async (res) => {
      if (res?.session) { await C.loadSavedWords(); C.startWordsRefresh(); }
    });

    live.start(panelListEl);
  }

  function unmount() {
    if (!mounted) return; mounted = false;
    live.stop();
    ['ls-overlay', 'ls-controls', 'ls-panel', 'ls-toast'].forEach((id) => document.getElementById(id)?.remove());
    C.closeCard(); C.stopWordsRefresh();
  }

  // The script runs on every Netflix page (browse → watch happens without a
  // reload), so only show the overlay while a title is playing.
  setInterval(() => {
    const onWatch = location.pathname.startsWith('/watch');
    const player = ['.watch-video', '.NFPlayer', '[data-uia="video-canvas"]'].some((s) => document.querySelector(s));
    if (onWatch && player) mount(); else if (!onWatch) unmount();
  }, 1000);
})();
