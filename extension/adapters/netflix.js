// LinguaScript — Netflix adapter
// Netflix has no caption API we can rely on, so LSCore.LiveCaptions reads the
// live subtitle DOM and mirrors it into our overlay. Native subs are hidden via
// SubtitleShield ONLY while our overlay is actually showing text. Subtitles are
// switched on (in the learning language when there is one) via page-bridge.js.
(() => {
  const C = window.LSCore;
  if (!C) { console.warn('[LinguaScript] core not loaded'); return; }
  C.keepAlive();

  // One element per subtitle line. Netflix nests spans inside these, so reading
  // every span doubled each line ("JANITOR JANITOR").
  function getLines() {
    const boxes = document.querySelectorAll('.player-timedtext-text-container');
    const lines = Array.from(boxes).map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (lines.length) return lines;
    const fallback = document.querySelector('.player-timedtext, [data-uia="player-timedtext"]');
    const text = fallback?.textContent.replace(/\s+/g, ' ').trim();
    return text ? [text] : [];
  }
  function getText() {
    const lines = getLines();
    return lines.length ? lines.join(' ') : null;
  }

  const video = () => document.querySelector('video');
  const speed = C.SpeedKeeper(video);
  const live = C.LiveCaptions({
    getText,
    getTarget: () => document.querySelector('.watch-video') || document.body,
    shield: C.SubtitleShield('.player-timedtext'),
    getVideo: video,
  });

  // Switch Netflix's subtitles on until some show up (the player can take a
  // few seconds to be ready), then leave the learner's choice alone.
  async function captionsOn() {
    C.setStatus('Turning on subtitles…');
    for (let i = 0; i < 15 && mounted; i++) {
      if (live.hasText()) return;
      const res = await C.requestCaptions(C.learningLang);
      if (res.ok) { await new Promise((r) => setTimeout(r, 2500)); if (live.hasText()) return; }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (mounted && !live.hasText()) C.setStatus('Turn on subtitles in Netflix (the 💬 button) to see LinguaScript subtitles');
  }

  // ── Mount ─────────────────────────────────────────────────────────────────────
  let mounted = false, stopLayout = null;
  async function mount() {
    if (mounted) return; mounted = true;
    C.injectStyles();
    C.buildOverlay();

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
    // Dock our bar just above Netflix's own controls (play, volume, subtitles…).
    stopLayout = C.watchLayout(video, () => document.querySelectorAll('.watch-video--bottom-controls-container, [data-uia="controls-standard"] [data-uia="timeline"], [data-uia="timeline-bar"]'));

    await C.loadLangs();

    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, async (res) => {
      if (res?.session) { await C.loadSavedWords(); C.startWordsRefresh(); }
    });

    live.start(panelListEl);
    captionsOn();
  }

  function unmount() {
    if (!mounted) return; mounted = false;
    live.stop();
    stopLayout?.(); stopLayout = null;
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
