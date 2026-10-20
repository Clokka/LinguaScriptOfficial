// LinguaScript — page bridge (runs in the page's own JavaScript world)
// The content scripts can't reach the YouTube or Netflix player objects, so
// they ask this script (via window.postMessage) to switch the site's subtitles
// on, in the learner's language when the video has it. Nothing else.
(() => {
  if (window.__lsBridge) return;
  window.__lsBridge = true;

  const matches = (code, lang) => {
    const c = String(code || '').toLowerCase();
    return c === lang || c.startsWith(lang + '-');
  };

  function youtube(lang) {
    const p = document.getElementById('movie_player');
    if (!p?.getOption) return { ok: false, reason: 'no_player' };
    p.loadModule?.('captions');
    const list = p.getOption('captions', 'tracklist') || [];
    if (!list.length) return { ok: false, reason: 'no_tracks' };
    const pick = list.find((t) => matches(t.languageCode, lang) && t.kind !== 'asr')
      || list.find((t) => matches(t.languageCode, lang))
      || list[0];
    p.setOption('captions', 'track', pick);
    return { ok: true, language: pick.languageCode, inLearningLanguage: matches(pick.languageCode, lang) };
  }

  function netflix(lang) {
    const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
    const ids = api?.getAllPlayerSessionIds?.() || [];
    const player = ids.length ? api.getVideoPlayerBySessionId(ids[ids.length - 1]) : null;
    if (!player?.getTimedTextTrackList) return { ok: false, reason: 'no_player' };
    const tracks = player.getTimedTextTrackList().filter((t) => !t.isNoneTrack && !t.isForcedNarrative);
    if (!tracks.length) return { ok: false, reason: 'no_tracks' };
    const current = player.getTimedTextTrack?.();
    const pick = tracks.find((t) => matches(t.bcp47, lang)) || (current && !current.isNoneTrack ? current : tracks[0]);
    if (!current || current.trackId !== pick.trackId) player.setTimedTextTrack(pick);
    return { ok: true, language: pick.bcp47, inLearningLanguage: matches(pick.bcp47, lang) };
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== 'ls-content' || e.data.type !== 'captions-on') return;
    let result;
    try {
      result = location.hostname.includes('netflix') ? netflix(e.data.lang) : youtube(e.data.lang);
    } catch (err) {
      result = { ok: false, reason: String(err?.message || err) };
    }
    window.postMessage({ source: 'ls-bridge', id: e.data.id, ...result }, '*');
  });
})();
