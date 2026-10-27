// LinguaScript — YouTube adapter
// First try: fetch the full caption track and time-sync it to the <video>.
// YouTube now often refuses those downloads, so when that comes back empty we
// switch YouTube's own captions on and mirror them from the screen, the same
// way the Netflix adapter does (LSCore.LiveCaptions).
(() => {
  const C = window.LSCore;
  if (!C) { console.warn('[LinguaScript] core not loaded'); return; }
  C.keepAlive();

  const getVideoId = () => new URLSearchParams(location.search).get('v');
  function decodeHtml(t) {
    return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ── Caption track acquisition ─────────────────────────────────────────────────
  async function getCaptionTracksInnerTube(videoId) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' } }, videoId }),
      });
      const data = await res.json();
      return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    } catch { return []; }
  }
  function getCaptionTracksFromPage() {
    try { return window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []; } catch { return []; }
  }
  async function getCaptionTracks(videoId) {
    const fromPage = getCaptionTracksFromPage();
    return fromPage.length ? fromPage : getCaptionTracksInnerTube(videoId);
  }
  function parseJson3(json) {
    return (json?.events || []).filter((e) => e.segs && e.tStartMs != null).map((e) => ({
      start: e.tStartMs / 1000, end: (e.tStartMs + (e.dDurationMs || 3000)) / 1000,
      text: decodeHtml(e.segs.map((s) => s.utf8 || '').join('').trim()),
    })).filter((s) => s.text && s.text !== '\n');
  }
  function parseXml(xml) {
    const re = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g, subs = [];
    let m; while ((m = re.exec(xml)) !== null) {
      const text = decodeHtml(m[3].replace(/<[^>]+>/g, ''));
      if (text) subs.push({ start: parseFloat(m[1]), end: parseFloat(m[1]) + parseFloat(m[2]), text });
    }
    return subs;
  }
  async function downloadTrack(baseUrl, tlang, isBase) {
    for (const fmt of ['json3', 'srv3']) {
      try {
        const url = baseUrl + (isBase ? '' : `&tlang=${tlang}`) + `&fmt=${fmt}`;
        const res = await fetch(url); if (!res.ok) continue;
        const subs = fmt === 'json3' ? parseJson3(await res.json()) : parseXml(await res.text());
        if (subs.length) return subs;
      } catch {}
    }
    return [];
  }
  async function fetchSubtitles(videoId, l, n) {
    const tracks = await getCaptionTracks(videoId);
    if (!tracks.length) return { primary: [], secondary: [] };
    const exact = tracks.find((t) => t.languageCode === l);
    const nat = tracks.find((t) => t.languageCode === n);
    const base = exact || nat || tracks[0];
    const primary = await downloadTrack(base.baseUrl, l, base.languageCode === l);
    const secondary = l !== n ? (nat ? await downloadTrack(nat.baseUrl, n, true) : await downloadTrack(base.baseUrl, n, false)) : [];
    return { primary, secondary };
  }

  // ── Sync + render ─────────────────────────────────────────────────────────────
  let primarySubs = [], secondarySubs = [], currentSubIdx = 0, syncInterval = null, videoEl = null, live = null;
  const video = () => document.querySelector('video');
  const speed = C.SpeedKeeper(video);
  let stopLayout = null;
  let lastText = null, lastSecondarySource = null, autoPause = false, autoPausedAt = -1, overlayVisible = true;

  function renderPrimary(text) {
    if (text === lastText) return; lastText = text;
    const el = document.getElementById('ls-primary'); if (!el) return;
    el.innerHTML = '';
    el.onclick = () => { const sub = primarySubs[currentSubIdx]; if (sub && videoEl) videoEl.currentTime = sub.start; };
    const { parts, joiner } = C.splitWords(text, C.learningLang);
    C.Gold.beginLine();
    parts.forEach((p) => el.appendChild(p.word ? C.makeWordSpan(p.text, text, joiner, true) : document.createTextNode(p.text + joiner)));
  }
  function renderSecondary(text) {
    const el = document.getElementById('ls-secondary'); if (!el) return;
    el.textContent = text || ''; el.style.display = text ? '' : 'none';
  }
  function seekToSub(idx) {
    if (!primarySubs[idx] || !videoEl) return;
    currentSubIdx = idx; videoEl.currentTime = primarySubs[idx].start;
    if (videoEl.paused) videoEl.play();
    autoPausedAt = -1; lastText = null;
  }
  function updatePanelCurrent(idx) {
    document.querySelectorAll('.ls-panel-line').forEach((el, i) => el.classList.toggle('ls-current', i === idx));
    document.querySelector('.ls-panel-line.ls-current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function startSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => {
      if (!videoEl || !overlayVisible) return;
      const t = videoEl.currentTime;
      const idx = primarySubs.findIndex((s) => t >= s.start && t < s.end);
      const overlay = document.getElementById('ls-overlay'); if (!overlay) return;
      if (idx >= 0) {
        if (idx !== currentSubIdx) updatePanelCurrent(idx);
        currentSubIdx = idx;
        const pSub = primarySubs[idx];
        const sSub = secondarySubs.find((s) => t >= s.start && t < s.end);
        renderPrimary(pSub.text);
        if (!sSub && C.learningLang !== C.nativeLang) {
          if (lastSecondarySource !== pSub.text) {
            lastSecondarySource = pSub.text;
            C.translate(pSub.text, C.nativeLang, C.learningLang).then((tr) => { if (lastSecondarySource === pSub.text) renderSecondary(tr || ''); });
          }
        } else { renderSecondary(sSub?.text || ''); }
        overlay.style.opacity = '1';
        if (autoPause && autoPausedAt !== idx && t >= pSub.end - 0.15) { autoPausedAt = idx; videoEl.pause(); }
      } else { overlay.style.opacity = '0'; lastText = null; }
    }, 80);
  }

  async function populatePanel(subs, listEl) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const BATCH = 40, translations = new Array(subs.length).fill('');
    for (let i = 0; i < subs.length; i += BATCH) {
      const slice = subs.slice(i, i + BATCH);
      const results = await Promise.all(slice.map((s) => C.translate(s.text, C.nativeLang, C.learningLang).catch(() => '')));
      results.forEach((tr, j) => { translations[i + j] = tr || ''; });
    }
    subs.forEach((sub, i) => {
      const div = document.createElement('div'); div.className = 'ls-panel-line'; div.dataset.idx = i;
      const textEl = document.createElement('div'); textEl.className = 'ls-panel-line-text';
      textEl.appendChild(C.makeWordSpansFor(sub.text));
      const trEl = document.createElement('div'); trEl.className = 'ls-panel-line-tr'; trEl.textContent = translations[i];
      div.appendChild(textEl); div.appendChild(trEl);
      div.addEventListener('click', () => seekToSub(i));
      listEl.appendChild(div);
    });
  }

  // ── Screen-caption mode ─────────────────────────────────────────────────────
  // Each visual caption line on its own. Auto-generated captions roll: the
  // bottom line moves up as a new one appears, so the transcript logs lines
  // (de-duplicated by LiveCaptions), not whole screens.
  function getScreenLines() {
    const lines = Array.from(document.querySelectorAll('.ytp-caption-window-container .caption-visual-line'))
      .map((l) => Array.from(l.querySelectorAll('.ytp-caption-segment')).map((s) => s.textContent).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (lines.length) return lines;
    const segs = Array.from(document.querySelectorAll('.ytp-caption-segment')).map((s) => s.textContent.trim()).filter(Boolean);
    return segs.length ? [segs.join(' ').replace(/\s+/g, ' ')] : [];
  }
  function getScreenText() {
    const lines = getScreenLines();
    return lines.length ? lines.join(' ') : null;
  }
  // Ask the player for captions in the learning language (page-bridge.js);
  // if it can't be reached, press the CC button instead.
  async function turnOnCaptions() {
    const res = await C.requestCaptions(C.learningLang);
    if (res.ok) return true;
    const btn = document.querySelector('.ytp-subtitles-button');
    if (btn && btn.getAttribute('aria-pressed') === 'false') btn.click();
    return !!btn;
  }
  async function startScreenCaptions(listEl, myVideoId) {
    live = C.LiveCaptions({
      getText: getScreenText,
      getLines: getScreenLines,
      getTarget: () => document.querySelector('#movie_player') || document.body,
      shield: C.SubtitleShield('.ytp-caption-window-container'),
      getVideo: video,
    });
    live.start(listEl);
    if (autoPause) live.setAutoPause(true);
    C.setStatus('Turning on subtitles…');
    // The player can take a moment to be ready; keep trying briefly.
    let hasCaptions = false;
    for (let i = 0; i < 20; i++) {
      if (activeVideoId !== myVideoId || !live || live.hasText()) return;
      hasCaptions = (await turnOnCaptions()) || hasCaptions;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (activeVideoId === myVideoId && live && !live.hasText()) {
      C.setStatus(hasCaptions ? 'Waiting for subtitles… (CC is on)' : 'No subtitles for this video');
    }
  }

  // ── Mount ─────────────────────────────────────────────────────────────────────
  async function mount(videoId) {
    document.getElementById('ls-overlay')?.remove();
    document.getElementById('ls-controls')?.remove();
    document.getElementById('ls-panel')?.remove();
    document.getElementById('ls-toast')?.remove();
    C.closeCard(); C.stopWordsRefresh();
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    live?.stop(); live = null;
    lastText = null; lastSecondarySource = null; currentSubIdx = 0;

    C.injectStyles();
    C.buildOverlay();
    stopLayout?.(); stopLayout = C.watchLayout(video, () => document.querySelectorAll('.ytp-chrome-bottom'));

    const listEl = C.buildPanelShell('Transcript');
    // Track mode seeks line by line; screen-caption mode has no timestamps, so
    // it steps by seconds like Netflix.
    const nudge = (secs) => { const v = video(); if (v) v.currentTime = Math.max(0, v.currentTime + secs); };
    const seekBack = () => (live ? nudge(-8) : seekToSub(currentSubIdx - 1));
    const seekRepeat = () => (live ? nudge(-4) : seekToSub(currentSubIdx));
    const seekForward = () => (live ? nudge(3) : seekToSub(currentSubIdx + 1));
    const onAutoPause = (v) => { autoPause = v; autoPausedAt = -1; live?.setAutoPause(v); };
    C.buildControls({
      seekBack, seekRepeat, seekForward,
      onSpeed: speed.set,
      onAutoPause,
      getAutoPause: () => autoPause,
      onToggleOverlay: (visible) => { overlayVisible = visible; live?.setVisible(visible); },
      extraLinks: [{ label: '📚 Flashcards', href: 'https://linguascript.co.uk/flashcards' }],
    });
    C.attachKeyboardShortcuts({ seekBack, seekRepeat, seekForward, onAutoPause, getAutoPause: () => autoPause });

    const { lang, nativeLang } = await C.loadLangs();

    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, async (res) => {
      if (res?.session) { await C.loadSavedWords(); C.startWordsRefresh(); }
    });

    const { primary, secondary } = await fetchSubtitles(videoId, lang, nativeLang);
    if (activeVideoId !== videoId) return; // the learner moved on while we were fetching
    primarySubs = primary; secondarySubs = secondary;
    if (!primary.length) { startScreenCaptions(listEl, videoId); return; }
    videoEl = document.querySelector('video');
    if (!videoEl) { for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 500)); videoEl = document.querySelector('video'); if (videoEl) break; } }
    if (!videoEl) return;
    startSync();
    populatePanel(primary, listEl);
  }

  let activeVideoId = null;
  // The script runs on every YouTube page (it's a single-page app, so a
  // watch page is often reached without a reload); only show the player
  // overlay while a video is open, and take it down when the learner leaves.
  function unmount() {
    ['ls-overlay', 'ls-controls', 'ls-panel', 'ls-toast'].forEach((id) => document.getElementById(id)?.remove());
    C.closeCard(); C.stopWordsRefresh();
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    live?.stop(); live = null;
    stopLayout?.(); stopLayout = null;
    primarySubs = []; secondarySubs = []; videoEl = null;
  }
  async function checkAndMount() {
    const id = location.pathname === '/watch' ? getVideoId() : null;
    if (!id) { if (activeVideoId) { activeVideoId = null; unmount(); } return; }
    if (id === activeVideoId) return;
    activeVideoId = id; await mount(id);
  }
  checkAndMount();

  let lastHref = location.href;
  new MutationObserver(async () => {
    if (location.href !== lastHref) { lastHref = location.href; C.closeCard(); await checkAndMount(); }
  }).observe(document.body, { childList: true, subtree: true });
})();
