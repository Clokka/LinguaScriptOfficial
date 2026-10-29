// LinguaScript — generic streaming adapter (TV5MONDE, Crunchyroll)
// These players have no caption API we can call, so we read subtitles two ways:
//  1. The <video>'s own text tracks (set to "hidden" so we get the cues while
//     the player's copy stays out of the way) — works on HTML5 players.
//  2. The player's subtitle DOM (selectors below), mirrored into our overlay.
// If neither has text (e.g. Crunchyroll's canvas-drawn anime subtitles), we
// say so honestly; highlighting words on the page still works everywhere.
(() => {
  const C = window.LSCore;
  if (!C) return;
  C.keepAlive();

  const host = location.hostname;
  const SITE = /crunchyroll/.test(host) ? 'Crunchyroll' : 'TV5MONDE';
  const SUB_SELECTORS = [
    '.vjs-text-track-display', '.jw-text-track-container', '.jw-captions',
    '.bmpui-ui-subtitle-overlay', '.shaka-text-container', '.dash-subtitle',
    '[class*="subtitle" i]:not(#ls-overlay *)', '[class*="caption" i]:not(#ls-overlay *)',
  ];

  const video = () => {
    const vids = Array.from(document.querySelectorAll('video'));
    return vids.find((v) => v.duration > 30) || vids[0] || null;
  };

  let pickedTrack = null;
  function trackText() {
    const v = video();
    if (!v || !v.textTracks || !v.textTracks.length) return null;
    const tracks = Array.from(v.textTracks).filter((t) => t.kind === 'subtitles' || t.kind === 'captions');
    if (!tracks.length) return null;
    if (!pickedTrack || !tracks.includes(pickedTrack)) {
      pickedTrack = tracks.find((t) => (t.language || '').toLowerCase().startsWith(C.learningLang))
        || tracks.find((t) => t.mode === 'showing') || tracks[0];
    }
    if (pickedTrack.mode === 'disabled') pickedTrack.mode = 'hidden';
    const cues = pickedTrack.activeCues ? Array.from(pickedTrack.activeCues) : [];
    const text = cues.map((c) => (c.text || '').replace(/<[^>]+>/g, '')).join(' ').replace(/\s+/g, ' ').trim();
    return text || null;
  }
  function domText() {
    for (const sel of SUB_SELECTORS) {
      const el = Array.from(document.querySelectorAll(sel)).find((n) => n.offsetParent && n.textContent.trim().length > 1 && n.textContent.length < 400);
      if (el) return el.textContent.replace(/\s+/g, ' ').trim();
    }
    return null;
  }
  const getText = () => trackText() || domText();

  const speed = C.SpeedKeeper(video);
  const live = C.LiveCaptions({
    getText,
    getTarget: () => video()?.parentElement || document.body,
    shield: C.SubtitleShield(SUB_SELECTORS.slice(0, 6).join(', ')),
    getVideo: video,
  });

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
    stopLayout = C.watchLayout(video, () => document.querySelectorAll('.vjs-control-bar, .jw-controlbar, .bmpui-ui-controlbar'));
    await C.loadLangs();
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, async (res) => {
      if (res?.session) { await C.loadSavedWords(); C.startWordsRefresh(); }
    });
    live.start(panelListEl);
    setTimeout(() => {
      if (mounted && !live.hasText()) C.setStatus(`Turn on subtitles in ${SITE} to see LinguaScript subtitles`);
    }, 12000);
  }

  function unmount() {
    if (!mounted) return; mounted = false;
    live.stop();
    stopLayout?.(); stopLayout = null;
    ['ls-overlay', 'ls-controls', 'ls-panel', 'ls-toast', 'ls-goal-card'].forEach((id) => document.getElementById(id)?.remove());
    C.closeCard(); C.stopWordsRefresh();
  }

  // Players load late and pages change without reloads: mount while a real
  // video is on the page.
  setInterval(() => {
    const v = video();
    if (v && v.duration > 30) mount(); else if (!v) unmount();
  }, 1500);
})();
