// Checks extension/subtitles.js (the subtitle file reader every video site
// uses) and extension/sites.js (which site a URL belongs to).
// Run: npm run test:subs
import assert from 'node:assert/strict';

await import('../extension/subtitles.js');
await import('../extension/sites.js');
const P = globalThis.LSSubs;
const S = globalThis.LSSites;
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

ok('WebVTT with tags and settings', () => {
  const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500 align:start\n<c.yellow>Bonjour</c> <i>tout</i> le monde\n\n00:00:04.000 --> 00:00:05.000\nÇa va ?';
  assert.equal(P.sniff(vtt), 'vtt');
  const c = P.parseSubtitles(vtt);
  assert.equal(c.length, 2);
  assert.deepEqual(c[0], { start: 1, end: 3.5, text: 'Bonjour tout le monde' });
  assert.equal(P.textAt(c, 2), 'Bonjour tout le monde');
  assert.equal(P.textAt(c, 3.7), null);
  assert.equal(P.textAt(c, 4.5), 'Ça va ?');
});

ok('SRT (with BOM and CRLF)', () => {
  const srt = '﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nHola\r\namigo\r\n\r\n2\r\n00:01:00,250 --> 00:01:02,000\r\n¿Qué tal?\r\n';
  assert.equal(P.sniff(srt), 'srt');
  const c = P.parseSubtitles(srt);
  assert.equal(c.length, 2);
  assert.equal(c[0].text, 'Hola amigo');
  assert.equal(c[1].start, 60.25);
});

ok('ASS (Crunchyroll anime): skips signs, strips tags, keeps commas', () => {
  const ass = `[Script Info]\nTitle: x\n\n[V4+ Styles]\nFormat: Name, Fontname\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\i1}Je t'aime,\\Npas toi ?\nDialogue: 0,0:00:02.00,0:00:04.00,Sign,,0,0,0,,{\\pos(10,10)}SHOP\nDialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,{\\p1}m 0 0 l 10 10{\\p0}`;
  assert.equal(P.sniff(ass), 'ass');
  const c = P.parseSubtitles(ass);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0], { start: 1, end: 3.5, text: "Je t'aime, pas toi ?" });
});

ok('TTML / DFXP with ticks and <br/>', () => {
  const ttml = '<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml" ttp:tickRate="10000000"><body><div><p begin="10000000t" end="30000000t">Guten<br/>Tag</p><p begin="00:00:04.000" dur="1s">Tschüss</p></div></body></tt>';
  assert.equal(P.sniff(ttml), 'ttml');
  const c = P.parseSubtitles(ttml);
  assert.deepEqual(c.map((x) => [x.start, x.end, x.text]), [[1, 3, 'Guten Tag'], [4, 5, 'Tschüss']]);
});

ok('Bilibili BCC JSON and YouTube json3', () => {
  const bcc = JSON.stringify({ font_size: 0.4, body: [{ from: 1.2, to: 2.5, content: '你好' }] });
  assert.equal(P.sniff(bcc), 'json');
  assert.deepEqual(P.parseSubtitles(bcc), [{ start: 1.2, end: 2.5, text: '你好' }]);
  const j3 = JSON.stringify({ events: [{ tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: 'Ciao ' }, { utf8: 'a tutti' }] }] });
  assert.deepEqual(P.parseSubtitles(j3), [{ start: 1, end: 2.5, text: 'Ciao a tutti' }]);
});

ok('not subtitles → null', () => {
  assert.equal(P.sniff('<html><body>hi</body></html>'), null);
  assert.equal(P.sniff('{"user":"x"}'), null);
  assert.deepEqual(P.parseSubtitles('hello'), []);
});

ok('language hints from subtitle URLs', () => {
  assert.equal(P.langFromUrl('https://cdn.x.com/subs/fr-FR/ep1.ass'), 'fr');
  assert.equal(P.langFromUrl('Film.2019.fre.srt'), 'fr');
  assert.equal(P.langFromUrl('https://x.com/t?lang=es&id=2'), 'es');
  assert.equal(P.langFromUrl('https://x.com/track/12345.vtt'), null);
});

ok('sites.js matches page + player iframe, rejects look-alikes', () => {
  assert.equal(S.siteFor('https://static.crunchyroll.com/vilos-v2/web/vilos/player.html')?.id, 'crunchyroll');
  assert.equal(S.siteFor('https://web.stremio.com/#/player/abc')?.id, 'stremio');
  assert.equal(S.siteFor('https://fr.tv5mondeplus.com/x')?.id, 'tv5monde');
  assert.equal(S.siteFor('https://geo.dailymotion.com/player.html')?.id, 'dailymotion');
  assert.equal(S.siteFor('https://evil.com/?u=https://www.tiktok.com/'), null);
  assert.equal(S.siteFor('https://tiktok.com.evil.com/'), null);
  assert.equal(S.originPattern('https://videos.example.org/watch?v=1'), 'https://videos.example.org/*');
  const ids = S.SITES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'site ids are unique');
});

console.log(`\n${n} subtitle/site checks passed`);
