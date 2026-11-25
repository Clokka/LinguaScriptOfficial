// LinguaScript — the list of video sites the universal adapter knows.
// ONE entry per site. Used by background.js (importScripts), popup.js and the
// universal adapter, so a new site is just a new entry here.
//
//   id, name         — shown in the pop-up
//   origins          — every origin the player lives on (the page AND its
//                      player iframe). Asked for together, at the learner's
//                      click, as optional permissions: no install warning.
//   builtIn          — already in manifest.json content_scripts (no click needed)
//   subtitleSelectors— where the site prints its own subtitles (read + hidden)
//   controlSelectors — the site's control bar (our bar steps out of its way)
//   minDuration      — shortest video worth mounting on (TikTok clips are short)
//   genericDom       — also try the generic [class*=subtitle] selectors
//                      (off where those match the wrong thing, e.g. TikTok
//                      descriptions)
//   videoId()        — which video is playing, for feeds with many videos
//   note             — what to tell the learner
//
// Sites NOT on this list still work: the pop-up's "Turn on for this site"
// asks for that one origin and runs the same adapter there.
(function (root) {
  const SITES = [
    {
      id: 'crunchyroll', name: 'Crunchyroll', builtIn: true,
      origins: ['https://www.crunchyroll.com/*', 'https://static.crunchyroll.com/*'],
      subtitleSelectors: ['canvas.libassjs-canvas', '.libassjs-canvas-parent', 'canvas[class*="jassub" i]', '[class*="subtitle" i]:not(#ls-overlay *)'],
      controlSelectors: ['#vilosControlsContainer', '[data-testid="vilos-controls"]', '.vjs-control-bar'],
      note: 'Anime subtitles are read from the subtitle file, so they work even though Crunchyroll draws them as a picture.',
    },
    {
      id: 'tv5monde', name: 'TV5MONDE', builtIn: true,
      origins: ['https://*.tv5mondeplus.com/*', 'https://*.tv5monde.com/*'],
      subtitleSelectors: ['.vjs-text-track-display', '.jw-text-track-container', '.jw-captions', '.bmpui-ui-subtitle-overlay'],
      controlSelectors: ['.vjs-control-bar', '.jw-controlbar', '.bmpui-ui-controlbar'],
    },
    {
      id: 'stremio', name: 'Stremio Web',
      origins: ['https://web.stremio.com/*', 'https://web.strem.io/*', 'https://app.strem.io/*'],
      subtitleSelectors: ['[class*="subtitles-container" i]', '[class*="subtitles" i]:not(#ls-overlay *)'],
      controlSelectors: ['[class*="control-bar-container" i]', '[class*="control-bar" i]'],
      note: 'Pick subtitles in Stremio (e.g. OpenSubtitles or the LinguaScript add-on) and LinguaScript reads them.',
    },
    {
      id: 'tiktok', name: 'TikTok',
      origins: ['https://www.tiktok.com/*'],
      subtitleSelectors: ['[class*="DivCaptionContainer" i]', '[data-e2e="video-caption"]'],
      controlSelectors: ['[class*="DivVideoControlContainer" i]', '[class*="DivSeekBarContainer" i]'],
      minDuration: 3, genericDom: false,
      videoId: () => (location.pathname.match(/\/video\/(\d+)/) || [])[1] || null,
      note: 'Works on TikTok videos that have captions (CC). Open a video to read its captions.',
    },
    {
      id: 'dailymotion', name: 'Dailymotion',
      origins: ['https://www.dailymotion.com/*', 'https://geo.dailymotion.com/*'],
      subtitleSelectors: ['[class*="subtitles" i]', '.dmp_SubtitleView'],
      controlSelectors: ['[class*="ControlBar" i]', '.dmp_ControlBar'],
    },
    {
      id: 'vimeo', name: 'Vimeo',
      origins: ['https://vimeo.com/*', 'https://player.vimeo.com/*'],
      subtitleSelectors: ['.vp-captions', '[class*="CaptionsRenderer" i]'],
      controlSelectors: ['.vp-controls', '[class*="ControlBar" i]'],
    },
    {
      id: 'primevideo', name: 'Prime Video',
      origins: ['https://www.primevideo.com/*', 'https://www.amazon.com/*', 'https://www.amazon.co.uk/*'],
      subtitleSelectors: ['.atvwebplayersdk-captions-text', '[class*="captions-text" i]'],
      controlSelectors: ['.atvwebplayersdk-bottompanel-container', '.atvwebplayersdk-controls-overlay'],
    },
    {
      id: 'disneyplus', name: 'Disney+',
      origins: ['https://www.disneyplus.com/*'],
      subtitleSelectors: ['.dss-subtitle-renderer-cue-window', '.dss-subtitle-renderer-line', '[class*="hive-subtitle" i]'],
      controlSelectors: ['.controls__footer', '[class*="controls__bottom" i]'],
    },
    {
      id: 'max', name: 'Max',
      origins: ['https://play.max.com/*', 'https://play.hbomax.com/*'],
      subtitleSelectors: ['[data-testid="CueBoxContainer"]', '[class*="CaptionWindow" i]'],
      controlSelectors: ['[data-testid="player-ux-controls"]'],
    },
    {
      id: 'viki', name: 'Viki',
      origins: ['https://www.viki.com/*'],
      subtitleSelectors: ['.vjs-text-track-display', '[class*="subtitle" i]'],
      controlSelectors: ['.vjs-control-bar'],
    },
    {
      id: 'bilibili', name: 'Bilibili',
      origins: ['https://www.bilibili.com/*', 'https://www.bilibili.tv/*'],
      subtitleSelectors: ['.bpx-player-subtitle-panel-text', '.bili-subtitle-x-subtitle-panel-text', '[class*="subtitle-item-text" i]'],
      controlSelectors: ['.bpx-player-control-wrap', '.bpx-player-control-entity'],
    },
    {
      id: 'plex', name: 'Plex',
      origins: ['https://app.plex.tv/*', 'https://watch.plex.tv/*'],
      subtitleSelectors: ['[class*="Subtitles" i]', '.libjass-subs'],
      controlSelectors: ['[class*="BottomControls" i]', '[class*="PlayerControls" i]'],
    },
    {
      id: 'arte', name: 'ARTE',
      origins: ['https://www.arte.tv/*'],
      subtitleSelectors: ['[class*="subtitle" i]', '.avp-subtitles'],
      controlSelectors: ['[class*="control-bar" i]'],
    },
    {
      id: 'francetv', name: 'france.tv',
      origins: ['https://www.france.tv/*'],
      subtitleSelectors: ['.ftv-magneto--subtitles', '[class*="subtitle" i]'],
      controlSelectors: ['[class*="control-bar" i]'],
    },
    {
      id: 'rtve', name: 'RTVE Play',
      origins: ['https://www.rtve.es/*'],
      subtitleSelectors: ['.vjs-text-track-display', '[class*="subtitle" i]'],
      controlSelectors: ['.vjs-control-bar'],
    },
    {
      id: 'ardzdf', name: 'ARD / ZDF',
      origins: ['https://www.ardmediathek.de/*', 'https://www.zdf.de/*'],
      subtitleSelectors: ['[class*="subtitle" i]', '.zdfplayer-subtitle'],
      controlSelectors: ['[class*="control" i][class*="bar" i]'],
    },
    {
      id: 'raiplay', name: 'RaiPlay',
      origins: ['https://www.raiplay.it/*'],
      subtitleSelectors: ['.vjs-text-track-display', '[class*="subtitle" i]'],
      controlSelectors: ['.vjs-control-bar'],
    },
    {
      id: 'ted', name: 'TED',
      origins: ['https://www.ted.com/*'],
      subtitleSelectors: ['[class*="caption" i]'],
      controlSelectors: ['[class*="controls" i]'],
    },
    {
      id: 'udemy', name: 'Udemy',
      origins: ['https://www.udemy.com/*'],
      subtitleSelectors: ['[data-purpose="captions-cue-text"]'],
      controlSelectors: ['[data-purpose="video-controls"]'],
    },
    {
      id: 'coursera', name: 'Coursera',
      origins: ['https://www.coursera.org/*'],
      subtitleSelectors: ['.vjs-text-track-display'],
      controlSelectors: ['.vjs-control-bar'],
    },
  ];

  // Generic places players put subtitles, tried after the site's own.
  const GENERIC_SUBTITLE_SELECTORS = [
    '.vjs-text-track-display', '.jw-text-track-container', '.jw-captions',
    '.bmpui-ui-subtitle-overlay', '.shaka-text-container', '.dash-subtitle', '.plyr__captions', '.mejs__captions-layer',
    '[class*="subtitle" i]:not(#ls-overlay *)', '[class*="caption" i]:not(#ls-overlay *)',
  ];
  const GENERIC_CONTROL_SELECTORS = ['.vjs-control-bar', '.jw-controlbar', '.bmpui-ui-controlbar', '.plyr__controls', '.shaka-bottom-controls'];

  const escape = (x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const patternRegex = (pattern) => {
    // "https://*.tv5monde.com/*" → any subdomain (or none) of tv5monde.com
    const m = pattern.match(/^(https?|\*):\/\/([^/]+)(\/.*)$/);
    if (!m) return new RegExp('^' + escape(pattern).replace(/\*/g, '.*') + '$');
    const host = m[2].startsWith('*.')
      ? '([^/]+\\.)?' + m[2].slice(2).replace(/\./g, '\\.')
      : m[2].replace(/\./g, '\\.').replace(/\*/g, '[^/]*');
    return new RegExp(`^${m[1] === '*' ? 'https?' : m[1]}://${host}${escape(m[3]).replace(/\*/g, '.*')}$`);
  };

  /** The site entry for a URL, or null for a site that isn't on the list. */
  function siteFor(url) {
    const u = String(url || '');
    return SITES.find((s) => s.origins.some((o) => patternRegex(o).test(u))) || null;
  }

  /** "https://example.com/*" for any http(s) URL. */
  function originPattern(url) {
    try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? `${u.protocol}//${u.hostname}/*` : null; } catch { return null; }
  }

  const api = { SITES, GENERIC_SUBTITLE_SELECTORS, GENERIC_CONTROL_SELECTORS, siteFor, originPattern, patternRegex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LSSites = api;
})(typeof self !== 'undefined' ? self : globalThis);
