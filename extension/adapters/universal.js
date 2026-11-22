// LinguaScript — universal video adapter (every site except YouTube & Netflix)
// Works on any page with a <video>: Crunchyroll, TV5MONDE, Stremio Web, TikTok,
// Dailymotion, Vimeo, Prime Video, Disney+, … and any site the learner turns
// on from the pop-up. The site list lives in sites.js.
//
// Where the subtitles come from, best first:
//   1. A subtitle FILE the learner loaded (📄 button / pop-up) — any site.
//   2. A subtitle FILE the player downloaded, caught by caption-hook.js
//      (works even when the player paints subtitles on a canvas).
//   3. The <video>'s own text tracks (<track> / HLS / DASH subtitles).
//   4. The subtitle text the player prints on the page (sites.js selectors,
//      then generic ones), including inside open shadow roots.
// If none has text we say so honestly; highlighting words still works.
(() => {
  const C = window.LSCore, S = window.LSSites, P = window.LSSubs;
  if (!C || !S || !P || window.__lsUniversal) return;
  window.__lsUniversal = true;
  C.keepAlive();

  const site = S.siteFor(location.href) || {
    id: 'custom', name: location.hostname.replace(/^www\./, ''), subtitleSelectors: [], controlSelectors: [],
  };
  const domSelectors = [...(site.subtitleSelectors || []), ...(site.genericDom === false ? [] : S.GENERIC_SUBTITLE_SELECTORS)];
  const controlSelectors = [...(site.controlSelectors || []), ...S.GENERIC_CONTROL_SELECTORS].join(', ');
  const minDuration = site.minDuration ?? 30;

  // ── Open shadow roots (web-component players) ─────────────────────────────
  let roots = [document], rootsAt = 0;
  function allRoots() {
    if (Date.now() - rootsAt < 3000) return roots;
    rootsAt = Date.now();
    const found = [document];
    const walk = (root) => {
      root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) { found.push(el.shadowRoot); walk(el.shadowRoot); } });
    };
    try { walk(document); } catch { /* ignore */ }
    roots = found;
    return roots;
  }
  const queryAll = (sel) => allRoots().flatMap((r) => { try { return Array.from(r.querySelectorAll(sel)); } catch { return []; } });

  // ── The video: the biggest visible one, playing ones first ─────────────────
  let cachedVideo = null, videoAt = 0;
  function video() {
    if (Date.now() - videoAt < 500 && cachedVideo?.isConnected) return cachedVideo;
    videoAt = Date.now();
    let best = null, bestScore = 0;
    for (const v of queryAll('video')) {
      const r = v.getBoundingClientRect();
      const area = r.width * r.height;
      if (area < 160 * 90) continue;
      const score = area * (v.paused ? 1 : 4);
      if (score > bestScore) { best = v; bestScore = score; }
    }
    cachedVideo = best;
    return best;
  }

  // ── 1 + 2: subtitle files (loaded by the learner or caught from the player) ─
  const caught = [];      // { url, lang, cues, videoId, at }
  let manual = null;      // the learner's own file always wins
  let offset = 0;         // seconds, [ and ] keys, for files out of sync

  function addTrack(url, text, isManual = false) {
    const cues = P.parseSubtitles(text);
    if (cues.length < 2) return false;
    const lang = (String(url).match(/#lang=([a-z]{2})/i) || [])[1]?.toLowerCase() || P.langFromUrl(url);
    const track = { url, lang, cues, videoId: site.videoId?.() ?? null, at: Date.now() };
    if (isManual) { manual = track; offset = 0; return true; }
    // Same file again (players re-download): replace, don't duplicate.
    const i = caught.findIndex((t) => t.url === url);
    if (i >= 0) caught.splice(i, 1);
    caught.push(track);
    if (caught.length > 12) caught.shift();
    return true;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== 'ls-caphook' || typeof e.data.text !== 'string') return;
    addTrack(e.data.url, e.data.text);
  });
  // Ask the catcher for files it caught before we were listening.
  window.postMessage({ source: 'ls-content', type: 'caphook-replay' }, '*');

  function pickTrack() {
    if (manual) return manual;
    if (!caught.length) return null;
    const v = video();
    const vid = site.videoId ? site.videoId() : null;
    const fits = (t) => {
      if (site.videoId && t.videoId !== vid) return false;
      // A track that runs far past the end of this video belongs to another one.
      const last = t.cues[t.cues.length - 1]?.end || 0;
      return !(v && isFinite(v.duration) && v.duration > 0 && last > v.duration + 90);
    };
    const pool = caught.filter(fits);
    const want = C.learningLang;
    return pool.filter((t) => t.lang === want).pop()
      || pool.filter((t) => !t.lang).pop()
      || pool[pool.length - 1] || null;
  }

  // ── 3: the <video>'s own text tracks ───────────────────────────────────────
  let pickedTrack = null;
  function textTrackList() {
    const v = video();
    if (!v?.textTracks?.length) return [];
    return Array.from(v.textTracks).filter((t) => t.kind === 'subtitles' || t.kind === 'captions');
  }
  function trackText() {
    const tracks = textTrackList();
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

  // ── 4: subtitle text printed on the page ───────────────────────────────────
  function domText() {
    for (const sel of domSelectors) {
      const el = queryAll(sel).find((n) => (n.offsetParent || n.getClientRects().length) && n.textContent.trim().length > 1 && n.textContent.length < 400 && !n.closest('#ls-overlay, #ls-panel, #ls-controls'));
      if (el) return el.textContent.replace(/\s+/g, ' ').trim();
    }
    return null;
  }

  // Tell the core what language this video's subtitles are, when the file or
  // <track> says (the core also reads the words themselves).
  let reportedLang = null;
  function reportLang(code) {
    if (code && code !== reportedLang) { reportedLang = code; C.noteVideoLanguage(code, true); }
  }

  function getText() {
    const track = pickTrack();
    if (track?.lang) reportLang(track.lang);
    else if (!track && pickedTrack?.language) reportLang(pickedTrack.language);
    const v = video();
    if (track) return v ? P.textAt(track.cues, v.currentTime + offset) : null;
    return trackText() || domText();
  }
  const timed = () => !!pickTrack() || textTrackList().length > 0;

  // ── Wire it to the shared overlay ──────────────────────────────────────────
  const speed = C.SpeedKeeper(video);
  const live = C.LiveCaptions({
    getText,
    getTarget: () => video()?.parentElement || document.body,
    shield: C.SubtitleShield([...(site.subtitleSelectors || []), ...S.GENERIC_SUBTITLE_SELECTORS.slice(0, 8)].join(', ')),
    getVideo: video,
  });

  function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.vtt,.ass,.ssa,.ttml,.dfxp,.xml,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      loadFileText(file.name, await file.text());
    });
    input.click();
  }
  function loadFileText(name, text) {
    if (addTrack(name, text, true)) {
      C.showToast(`📄 ${name} loaded. Out of sync? Press [ or ] to shift it.`);
      mount();
      live.poke();
      return true;
    }
    C.showToast('That file has no subtitles LinguaScript can read (.srt, .vtt, .ass, .ttml).');
    return false;
  }

  let mounted = false, stopLayout = null, poll = null;
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
      extraButtons: [{ label: '📄 Subtitles', title: 'Load a subtitle file (.srt, .vtt, .ass) for this video', onClick: pickFile }],
      extraLinks: [{ label: '📚 Flashcards', href: 'https://linguascript.co.uk/flashcards' }],
    });
    C.attachKeyboardShortcuts({ seekBack, seekRepeat, seekForward, onAutoPause: live.setAutoPause, getAutoPause: live.getAutoPause });
    stopLayout = C.watchLayout(video, () => (controlSelectors ? queryAll(controlSelectors) : []));
    await C.loadLangs();
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, async (res) => {
      if (chrome.runtime.lastError) return;
      if (res?.session) { await C.loadSavedWords(); C.startWordsRefresh(); }
    });
    live.start(panelListEl);
    poll = setInterval(() => { if (timed()) live.poke(); }, 250);
    setTimeout(() => {
      if (mounted && !live.hasText()) C.setStatus(`Turn on subtitles in ${site.name}, or press 📄 to load a subtitle file`);
    }, 12000);
  }

  function unmount() {
    if (!mounted) return; mounted = false;
    clearInterval(poll); poll = null;
    live.stop();
    stopLayout?.(); stopLayout = null;
    ['ls-overlay', 'ls-controls', 'ls-panel', 'ls-toast', 'ls-goal-card'].forEach((id) => document.getElementById(id)?.remove());
    C.closeCard(); C.stopWordsRefresh();
  }

  // [ and ] nudge a subtitle file by half a second.
  document.addEventListener('keydown', (e) => {
    if (!mounted || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
    if ((e.key !== '[' && e.key !== ']') || !(manual || caught.length)) return;
    offset += e.key === ']' ? 0.5 : -0.5;
    C.showToast(`Subtitles ${offset >= 0 ? '+' : ''}${offset.toFixed(1)} s`);
    live.poke();
  }, true);

  // What's happening on this page (for debugging from the pop-up/devtools).
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'LS_PING_VIDEO' && video()) { sendResponse({ ok: true, site: site.name, video: !!video(), mounted, source: manual ? 'file' : pickTrack() ? 'caught' : textTrackList().length ? 'tracks' : 'page' }); }
  });

  // Players load late and pages change without reloads: mount while a real
  // video is on the page (live streams have an Infinity duration).
  let missing = 0;
  setInterval(() => {
    const v = video();
    if (v && (v.duration > minDuration || v.duration === Infinity || manual)) { missing = 0; mount(); }
    else if (!v && ++missing > 2) unmount();
  }, 1500);
})();
