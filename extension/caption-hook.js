// LinguaScript — caption catcher (runs in the page's own JavaScript world, at
// document_start, in every frame of a site the learner switched on).
// Many players draw subtitles on a <canvas> (Crunchyroll anime) or inside
// closed components, so there is nothing to read on screen. But every player
// first DOWNLOADS its subtitle file. We watch fetch() and XMLHttpRequest, and
// when a response looks like subtitles (WebVTT, SRT, ASS, TTML, Bilibili JSON)
// we hand a COPY of the text to the content script with window.postMessage.
// Rules: never change the response, never slow it down, never throw.
(() => {
  if (window.__lsCaptionHook) return;
  window.__lsCaptionHook = true;

  const MAX = 4 * 1024 * 1024;
  const SUB_URL = /\.(vtt|webvtt|srt|ass|ssa|ttml|dfxp|xml)(\?|$)|[/_-](subtitles?|captions?|texttrack|timedtext|subs)([/_.?-]|$)|format=(vtt|ttml|srt)|fmt=(vtt|json3)/i;
  const SKIP_URL = /\.(m3u8|mpd|ts|m4s|mp4|webm|aac|png|jpe?g|webp|gif|svg|woff2?|css|js)(\?|$)/i;
  const seen = new Set();

  const looksLikeSubs = (t) => {
    const h = t.slice(0, 2000).replace(/^﻿/, '').trimStart();
    return /^WEBVTT/.test(h) || /^\[Script Info\]/i.test(h) || (/<tt[\s>]/i.test(h) && /begin=/.test(t.slice(0, 20000)))
      || /^\d+\s*\r?\n\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(h)
      || (/^[{[]/.test(h) && /"from"\s*:[\s\d.]+,\s*"to"/.test(h));
  };

  // Players often fetch subtitles before the content script is listening
  // (it starts at document_idle), so keep the last few and send them again
  // when it says hello.
  const kept = [];
  function post(url, text) {
    if (!text || text.length > MAX) return;
    const key = url + ':' + text.length;
    if (seen.has(key)) return;
    if (!looksLikeSubs(text)) return;
    seen.add(key);
    const msg = { source: 'ls-caphook', url: String(url || ''), text };
    kept.push(msg);
    if (kept.length > 8) kept.shift();
    window.postMessage(msg, '*');
  }
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data?.source === 'ls-content' && e.data.type === 'caphook-replay') {
      kept.forEach((msg) => window.postMessage(msg, '*'));
    }
  });

  // JSON from the site's own API sometimes lists subtitle URLs instead of the
  // text (TikTok "subtitleInfos"). Collect those and fetch them as the page.
  function scanJson(text) {
    if (!text || text.length > MAX || !/subtitle|caption/i.test(text)) return;
    const urls = text.match(/https?:\\?\/\\?\/[^"'\s]+?(?:\.vtt|\.srt|webvtt|format=vtt|\.ass)[^"'\s]*/gi) || [];
    const meta = (url) => {
      // Video id + language next to the URL in the JSON, when there is one.
      const i = text.indexOf(url);
      const near = text.slice(Math.max(0, i - 600), i + 200);
      const lang = (near.match(/"(?:LanguageCodeName|languageCode|lang|language)"\s*:\s*"([a-zA-Z-]{2,8})"/) || [])[1] || '';
      return { lang };
    };
    for (const raw of urls.slice(0, 12)) {
      const url = raw.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
      if (seen.has('u:' + url)) continue;
      seen.add('u:' + url);
      const { lang } = meta(raw);
      origFetch(url, { credentials: 'omit' })
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) => post(url + (lang ? `#lang=${lang}` : ''), t))
        .catch(() => {});
    }
  }

  function inspect(url, contentType, readText) {
    try {
      const u = String(url || '');
      if (SKIP_URL.test(u.split('#')[0])) return;
      const ct = String(contentType || '').toLowerCase();
      const subByType = /text\/vtt|application\/x-subrip|text\/srt|ttml|x-ssa|x-ass/.test(ct);
      const isJson = /json/.test(ct);
      const maybeText = subByType || SUB_URL.test(u) || /text\/plain|xml|octet-stream/.test(ct);
      if (!maybeText && !isJson) return;
      readText().then((t) => {
        if (typeof t !== 'string') return;
        if (isJson && !subByType) { if (/"from"\s*:/.test(t.slice(0, 2000))) post(u, t); else scanJson(t); return; }
        post(u, t);
      }).catch(() => {});
    } catch { /* never break the page */ }
  }

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args);
      try {
        const req = args[0];
        const url = typeof req === 'string' ? req : req?.url || String(req);
        p.then((res) => {
          try {
            const len = +res.headers.get('content-length') || 0;
            if (len > MAX) return;
            inspect(res.url || url, res.headers.get('content-type'), () => res.clone().text());
          } catch { /* ignore */ }
        }).catch(() => {});
      } catch { /* ignore */ }
      return p;
    };
  }

  const XHR = window.XMLHttpRequest?.prototype;
  if (XHR) {
    const open = XHR.open;
    XHR.open = function (method, url, ...rest) {
      try { this.__lsUrl = url; } catch { /* ignore */ }
      return open.call(this, method, url, ...rest);
    };
    const send = XHR.send;
    XHR.send = function (...args) {
      try {
        this.addEventListener('load', () => {
          try {
            const type = this.responseType;
            if (type && type !== 'text' && type !== 'json' && type !== 'arraybuffer') return;
            inspect(this.responseURL || this.__lsUrl, this.getResponseHeader('content-type'), async () => {
              if (!type || type === 'text') return this.responseText;
              if (type === 'json') return JSON.stringify(this.response);
              const buf = this.response;
              return buf && buf.byteLength < MAX ? new TextDecoder().decode(buf) : '';
            });
          } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
      return send.apply(this, args);
    };
  }
})();
