// LinguaScript — subtitle file reader (shared by every video site)
// Turns any subtitle file a player downloads into timed lines:
//   [{ start, end, text }]  (seconds)
// Understands WebVTT, SRT, ASS/SSA (anime: Crunchyroll), TTML/DFXP (BBC,
// Netflix-style XML), Bilibili BCC JSON and YouTube json3. Pure functions, no
// DOM, so it also runs in Node for `npm run test:subs`.
(function (root) {
  const clean = (s) => String(s || '')
    .replace(/<[^>]+>/g, '')            // <i>, <c.yellow>, <00:01.000> karaoke tags
    .replace(/\{[^}]*\}/g, '')          // ASS override tags {\i1\pos(…)}
    .replace(/\\N/gi, ' ').replace(/\\h/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "01:02:03.456", "02:03,456", "1:02:03.45" (ASS centiseconds), "12.5s", "1234ms", "10t"
  function toSeconds(raw, tickRate) {
    const s = String(raw || '').trim();
    if (!s) return NaN;
    let m = s.match(/^(-?[\d.]+)(h|m|s|ms|t|f)$/);
    if (m) {
      const n = parseFloat(m[1]);
      return { h: n * 3600, m: n * 60, s: n, ms: n / 1000, t: n / (tickRate || 10000000), f: n / 30 }[m[2]];
    }
    m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,:](\d+))?$/);
    if (!m) return NaN;
    const frac = m[4] ? parseFloat('0.' + m[4]) : 0;
    return (parseInt(m[1] || '0', 10) * 3600) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + frac;
  }

  // WebVTT and SRT share the "start --> end" line.
  function parseArrowFormat(text) {
    const cues = [];
    const blocks = String(text).replace(/\r/g, '').split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split('\n');
      const i = lines.findIndex((l) => l.includes('-->'));
      if (i < 0) continue;
      const [a, b] = lines[i].split('-->');
      const start = toSeconds(a);
      const end = toSeconds(String(b).trim().split(/\s+/)[0]);
      const body = clean(lines.slice(i + 1).join(' '));
      if (!isNaN(start) && !isNaN(end) && body) cues.push({ start, end, text: body });
    }
    return cues;
  }

  function parseAss(text) {
    const cues = [];
    let format = null;
    let inEvents = false;
    for (const raw of String(text).replace(/\r/g, '').split('\n')) {
      const line = raw.trim();
      if (/^\[events\]/i.test(line)) { inEvents = true; continue; }
      if (/^\[/.test(line)) { inEvents = false; continue; }
      if (!inEvents) continue;
      if (/^format:/i.test(line)) { format = line.slice(7).split(',').map((f) => f.trim().toLowerCase()); continue; }
      if (!/^dialogue:/i.test(line)) continue;
      const f = format || ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
      const parts = line.slice(9).split(',');
      const head = parts.slice(0, f.length - 1);
      const body = parts.slice(f.length - 1).join(',');
      const get = (k) => head[f.indexOf(k)];
      const style = String(get('style') || '').toLowerCase();
      // Signs, karaoke songs and on-screen text styles aren't dialogue.
      if (/sign|song|karaoke|^op|^ed|title|note/.test(style)) continue;
      if (/\\p[1-9]/.test(body)) continue; // vector drawings
      const start = toSeconds(get('start'));
      const end = toSeconds(get('end'));
      const t = clean(body);
      if (!isNaN(start) && !isNaN(end) && t) cues.push({ start, end, text: t });
    }
    return cues;
  }

  // TTML / DFXP: <p begin="…" end="…">…<br/>…</p>, sometimes with dur=.
  function parseTtml(text) {
    const cues = [];
    const tick = parseFloat((String(text).match(/ttp:tickRate="(\d+)"/) || [])[1]) || 10000000;
    const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = re.exec(text))) {
      const attrs = m[1];
      const attr = (n) => (attrs.match(new RegExp(`\\b${n}="([^"]+)"`)) || [])[1];
      const start = toSeconds(attr('begin'), tick);
      let end = toSeconds(attr('end'), tick);
      if (isNaN(end) && attr('dur')) end = start + toSeconds(attr('dur'), tick);
      const body = clean(m[2].replace(/<br\s*\/?>/gi, ' '));
      if (!isNaN(start) && !isNaN(end) && body) cues.push({ start, end, text: body });
    }
    return cues;
  }

  function parseJson(text) {
    let data;
    try { data = JSON.parse(text); } catch { return []; }
    // Bilibili BCC: { body: [{ from, to, content }] }
    if (Array.isArray(data?.body) && data.body[0] && 'from' in data.body[0]) {
      return data.body.map((c) => ({ start: +c.from, end: +c.to, text: clean(c.content) })).filter((c) => c.text);
    }
    // YouTube json3: { events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] }
    if (Array.isArray(data?.events)) {
      return data.events
        .filter((e) => e.segs)
        .map((e) => ({ start: e.tStartMs / 1000, end: (e.tStartMs + (e.dDurationMs || 2000)) / 1000, text: clean(e.segs.map((s) => s.utf8).join('')) }))
        .filter((c) => c.text);
    }
    return [];
  }

  /** What kind of subtitle file is this? null = not subtitles. */
  function sniff(text) {
    const head = String(text || '').slice(0, 2000).replace(/^﻿/, '').trimStart();
    if (/^WEBVTT/.test(head)) return 'vtt';
    if (/^\[Script Info\]/i.test(head) || /\[Events\][\s\S]*Dialogue:/i.test(head)) return 'ass';
    if (/<tt[\s>]/i.test(head) && /<p\b[^>]*begin=/i.test(String(text).slice(0, 20000))) return 'ttml';
    if (/^\d+\s*\r?\n\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(head)) return 'srt';
    if (/^[{[]/.test(head) && (/"from"\s*:[\s\d.]+,\s*"to"/.test(head) || /"tStartMs"/.test(head))) return 'json';
    return null;
  }

  function parseSubtitles(text, kind = sniff(text)) {
    const body = String(text || '').replace(/^﻿/, '');
    let cues = [];
    if (kind === 'vtt' || kind === 'srt') cues = parseArrowFormat(body);
    else if (kind === 'ass') cues = parseAss(body);
    else if (kind === 'ttml') cues = parseTtml(body);
    else if (kind === 'json') cues = parseJson(body);
    cues.sort((a, b) => a.start - b.start);
    // Merge lines that share exactly the same time (two-line subtitles in ASS/TTML).
    const out = [];
    for (const c of cues) {
      const prev = out[out.length - 1];
      if (prev && prev.start === c.start && prev.end === c.end) { if (!prev.text.includes(c.text)) prev.text += ' ' + c.text; }
      else out.push({ ...c });
    }
    return out;
  }

  /** The line(s) on screen at time t (seconds), joined. Binary search, cues sorted. */
  function textAt(cues, t) {
    if (!cues?.length) return null;
    let lo = 0, hi = cues.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    const on = [];
    for (let i = idx; i >= 0 && i > idx - 4; i--) if (cues[i].start <= t && cues[i].end > t) on.unshift(cues[i].text);
    return on.length ? on.join(' ') : null;
  }

  /** A language code hinted by a subtitle URL or file name ("…/fr-FR/…", "film.fre.srt", "lang=es"). */
  function langFromUrl(url) {
    const u = String(url || '').toLowerCase();
    const m = u.match(/(?:[/_.=\-]|^)(fr|fre|fra|es|spa|de|ger|deu|it|ita|pt|por|ja|jpn|ko|kor|zh|chi|zho|ru|rus|ar|ara|nl|dut|nld|pl|pol|sv|swe|tr|tur|hi|hin|th|tha|en|eng)(?:[-_](?:[a-z]{2}|\d{3}))?(?=[/_.\-?&]|$)/);
    if (!m) return null;
    const MAP = { fre: 'fr', fra: 'fr', spa: 'es', ger: 'de', deu: 'de', ita: 'it', por: 'pt', jpn: 'ja', kor: 'ko', chi: 'zh', zho: 'zh', rus: 'ru', ara: 'ar', dut: 'nl', nld: 'nl', pol: 'pl', swe: 'sv', tur: 'tr', hin: 'hi', tha: 'th', eng: 'en' };
    return MAP[m[1]] || m[1];
  }

  const api = { sniff, parseSubtitles, textAt, langFromUrl, toSeconds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LSSubs = api;
})(typeof self !== 'undefined' ? self : globalThis);
