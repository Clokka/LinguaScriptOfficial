// Static "most common words" pages (docs/plans/frequency-word-lists-seo.md).
// Rendered to plain HTML inside `vite build` (plugin in vite.config.ts), so
// Google reads the words without running JavaScript and Cloudflare's build
// command doesn't change. Data: src/data/wordlists/<lang>.json
// (scripts/build-word-lists.mjs). Colours = the chameleon decks in brand/README.md.
import fs from "node:fs";
import path from "node:path";

const SITE = "https://linguascript.co.uk";
const C = { red: "#FF3B30", orange: "#FF8A00", green: "#34C759", gold: "#FFD54A", blue: "#2F7BFF" };
export const LANGS = [
  { code: "es", file: "es", slug: "spanish", name: "Spanish", voice: "es-ES" },
  { code: "fr", file: "fr", slug: "french", name: "French", voice: "fr-FR" },
  { code: "de", file: "de", slug: "german", name: "German", voice: "de-DE" },
  { code: "it", file: "it", slug: "italian", name: "Italian", voice: "it-IT" },
  { code: "pt", file: "pt_br", slug: "portuguese", name: "Portuguese", voice: "pt-BR", note: "Brazilian Portuguese" },
  { code: "en", file: "en", slug: "english", name: "English", voice: "en-GB" },
];
const TIPS = {
  es: "Spanish has two verbs for “to be”: es/está, soy/estoy and son/están are all near the top. Learn which goes with which (ser for what something is, estar for how or where it is) and a big part of the list clicks at once.",
  fr: "Many of the top French words are tiny elided forms: c', j', l', d', qu'. They join the next word (c'est, j'ai, l'ami), so practise them in short phrases rather than alone.",
  de: "German articles change with the role in the sentence: der, die, das, den, dem all sit in the top 100. Learn each noun with its article and these forms stop being confusing.",
  it: "Italian films drop accents in subtitles (perche for perché, piu for più), so you'll see both. Elided words like l', c' and un' join the next word, so read them as part of a phrase.",
  pt: "This is Brazilian Portuguese: você (you) is far more common than tu, and short words like que, não and é carry a huge share of every conversation.",
  en: "English is full of contractions: don't, didn't, I'm, it's. Subtitles split them, so “don” and “didn” on this list really mean do not and did not. Learn the full forms together.",
};
const SIZES = [100, 1000, 3000];
export const GUIDE_PATH = "/words/anki-and-quizlet";
export const wordPagePaths = () => ["/words", GUIDE_PATH, ...LANGS.flatMap((l) => SIZES.map((n) => pagePath(l, n)))];
const pagePath = (l, n) => (n === 100 ? `/words/${l.slug}` : `/words/${l.slug}/top-${n}`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => n.toLocaleString("en-GB");

const TONES = {
  red: [C.red, "#D62C22", "#9E1F18", "#FFD0CC"], orange: [C.orange, "#D97400", "#9A5300", "#FFE0B0"],
  green: [C.green, "#26A047", "#1B7A35", "#B8EFC8"], gold: [C.gold, "#E0B52E", "#A8821A", "#FFF1C2"],
  blue: [C.blue, "#1F5FD6", "#163F99", "#C7DBFF"],
};
/** The logo chameleon (public/logo.svg art), recoloured per deck. */
function chameleon(tone, size = 64, label = "") {
  const [body, dark, ridge, belly] = TONES[tone];
  return `<svg class="cham" viewBox="14 76 372 184" width="${size}" height="${Math.round(size / 2)}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}><path d="M20 236 Q200 222 380 240 L380 254 Q200 236 20 250 Z" fill="#5b4332"/><path d="M272 176 C322 168 348 190 344 214 C340 236 316 242 304 230 C295 220 302 206 314 207" fill="none" stroke="${dark}" stroke-width="15" stroke-linecap="round"/><rect x="233" y="196" width="15" height="38" rx="7.5" fill="${dark}"/><path d="M136 196 Q128 118 205 106 Q276 96 285 160 Q290 202 244 208 L164 210 Q140 208 136 196 Z" fill="${body}"/><path d="M158 130 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 l-2 10 q-49 -10 -94 2 Z" fill="${ridge}"/><path d="M150 196 Q152 168 178 166 Q166 190 190 206 L164 208 Q152 206 150 196 Z" fill="${belly}"/><rect x="182" y="198" width="15" height="40" rx="7.5" fill="${dark}"/><path d="M162 118 Q160 92 134 88 Q104 84 88 112 Q74 138 84 162 Q94 186 126 188 Q152 189 160 168 Q166 148 162 118 Z" fill="${body}"/><path d="M82 148 Q104 162 128 154" fill="none" stroke="#3d2b1f" stroke-width="4.5" stroke-linecap="round"/><circle cx="118" cy="126" r="21" fill="${belly}"/><circle cx="118" cy="126" r="11.5" fill="#fffef9"/><circle cx="122.27" cy="124.58" r="5.5" fill="#241a12"/></svg>`;
}

const CSS = `
:root{--bg:#0B0B0D;--card:#131316;--line:#1E1E23;--text:#F2F2F5;--muted:#A1A1AA;--faint:#8E8E98;--red:${C.red};--orange:${C.orange};--green:${C.green};--gold:${C.gold};--blue:${C.blue}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--green)}a:hover{color:#5EDC7E}
.wrap{max-width:860px;margin:0 auto;padding:0 18px}
header.top{border-bottom:1px solid var(--line)}header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px;padding-bottom:14px}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-weight:700;font-size:18px}.brand b{color:var(--green);font-weight:700}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border-radius:999px;background:var(--green);color:#0B0B0D;font-weight:700;text-decoration:none;border:0;cursor:pointer;font-size:15px}.btn:hover{background:#5EDC7E;color:#0B0B0D}
.btn.ghost{background:transparent;color:var(--text);border:1px solid #2A2A30}.btn.ghost:hover{background:#17171B;color:var(--text)}
.crumbs{font-size:13px;color:var(--faint);margin:22px 0 10px}.crumbs a{color:var(--faint);text-decoration:none}
h1{font-size:clamp(30px,6vw,46px);line-height:1.08;letter-spacing:-.02em;margin:0 0 14px;font-weight:800}
h2{font-size:22px;margin:38px 0 12px;letter-spacing:-.01em}
.lead{font-size:18px;color:var(--muted);margin:0 0 22px}.lead strong{color:var(--text)}
.chams{display:flex;gap:6px;align-items:flex-end;margin:6px 0 18px;flex-wrap:wrap}.chams .cham{display:block}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px}
.big{font-size:44px;font-weight:800;letter-spacing:-.02em;line-height:1;color:var(--green)}
.bars{display:grid;gap:12px;margin-top:16px}.bar{display:grid;grid-template-columns:110px 1fr 56px;gap:12px;align-items:center;font-size:14px}
.bar a{color:var(--text);text-decoration:none}.bar a[aria-current]{color:var(--green);font-weight:700}
.track{height:10px;border-radius:99px;background:#232329;overflow:hidden}.fill{height:10px;border-radius:99px}
.you{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.you .count{font-weight:800;font-size:20px}
.ptrack{height:8px;border-radius:99px;background:#232329;overflow:hidden;flex:1 1 200px}.pfill{height:8px;width:0;background:var(--red);border-radius:99px;transition:width .3s,background .3s}
.jump{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 14px}.jump a{font-size:13px;padding:6px 10px;border-radius:99px;border:1px solid #2A2A30;color:var(--muted);text-decoration:none}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);padding:10px 8px;border-bottom:1px solid var(--line)}
td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}td.r{color:var(--faint);font-size:13px;width:52px}
.w{font-weight:700;font-size:17px;color:var(--red);transition:color .2s}tr.known .w{color:var(--green)}
td.m{color:var(--muted);font-size:15px}td.a{width:120px;text-align:right;white-space:nowrap}
.say,.know{width:38px;height:38px;border-radius:99px;border:1px solid #2A2A30;background:transparent;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;vertical-align:middle}
.know{width:auto;padding:0 12px;font-size:13px;font-weight:600;margin-left:6px}tr.known .know{background:rgba(52,199,89,.14);border-color:rgba(52,199,89,.5);color:var(--green)}
.say:hover,.know:hover{border-color:var(--green);color:var(--text)}
.cta{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin:26px 0}
.cta p{margin:0;font-weight:700;font-size:18px}.cta span{display:block;font-weight:400;font-size:14px;color:var(--muted)}
.langs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.langs a{display:block;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;color:var(--text);text-decoration:none}.langs a:hover{border-color:var(--green)}
.langs b{display:block;font-size:18px;margin-bottom:4px}.langs small{color:var(--muted);font-size:14px}
details{border-bottom:1px solid var(--line);padding:14px 0}summary{cursor:pointer;font-weight:700}details p{color:var(--muted);margin:10px 0 0}
.method{font-size:14px;color:var(--faint)}
.answer{font-size:16px;background:var(--card);border-left:3px solid var(--green);border-radius:12px;padding:14px 16px;margin:0 0 10px}.updated{font-size:13px;color:var(--faint);margin:0 0 18px}
.need{max-width:460px;margin-bottom:8px}.need td strong{color:var(--green)}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.vs td:first-child{color:var(--faint);font-size:14px;width:30%}.vs td{font-size:15px}.vs .yes{color:var(--green);font-weight:700}.vs .meh{color:var(--orange);font-weight:700}
.steps{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:10px}.steps li{counter-increment:s;position:relative;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px 14px 58px;color:var(--muted)}
.steps li::before{content:counter(s);position:absolute;left:14px;top:13px;width:30px;height:30px;border-radius:99px;display:grid;place-items:center;font-weight:800;font-size:14px;background:rgba(52,199,89,.14);color:var(--green)}.steps li b{color:var(--text)}
.toc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.toc a{font-size:13px;padding:6px 12px;border-radius:99px;border:1px solid #2A2A30;color:var(--muted);text-decoration:none}.toc a:hover{border-color:var(--green);color:var(--text)}
.svcs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 18px}.svcs small{color:var(--faint);font-size:13px;margin-right:4px}
.svc{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:99px;background:var(--card);border:1px solid var(--line);font-weight:700;font-size:14px;color:var(--text)}
.svc i{font-style:normal;width:24px;height:24px;border-radius:99px;display:grid;place-items:center;background:var(--svc);color:#fff;font-size:12px;font-weight:800}
.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}.flow div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;font-size:14px;color:var(--muted)}.flow b{display:block;color:var(--text);font-size:15px;margin:8px 0 2px}
.ladder{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}.ladder span{font-size:13px;font-weight:700;padding:6px 12px;border-radius:99px;border:1px solid #2A2A30}
.mist{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.mist.two{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.mist div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;color:var(--muted);font-size:15px}.mist b{display:block;color:var(--text);margin-bottom:4px}
p.body{color:var(--muted)}p.body strong{color:var(--text)}kbd{font:600 13px Inter,system-ui,sans-serif;background:#1C1C21;border:1px solid #2A2A30;border-radius:6px;padding:1px 6px;color:var(--text)}
footer{border-top:1px solid var(--line);margin-top:48px;padding:26px 0 40px;color:var(--faint);font-size:14px}footer a{color:var(--muted)}
@media (max-width:560px){thead{display:none}tr[data-w]{display:grid;grid-template-columns:30px 1fr auto;align-items:center;column-gap:10px;row-gap:2px;padding:10px 0;border-bottom:1px solid var(--line)}tr[data-w] td{border:0;padding:0}td.r{grid-row:1/span 2;width:auto}td.m{grid-column:2;grid-row:2;font-size:14px}td.a{grid-column:3;grid-row:1/span 2;width:auto}.know{padding:0 10px}.bar{grid-template-columns:86px 1fr 50px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const head = ({ title, desc, url, jsonLd }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${url}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${url}"><meta property="og:site_name" content="LinguaScript">
<meta name="twitter:card" content="summary"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="32x32"><meta name="theme-color" content="#0B0B0D">
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("")}
<style>${CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="brand" href="/" aria-label="LinguaScript home">${chameleon("green", 46)}<span>Lingua<b>Script</b></span></a><a class="btn" href="/auth?mode=signup">Start free</a></div></header><main class="wrap">`;

const foot = () => `</main><footer><div class="wrap"><p><a href="/words">Most common words</a> · <a href="${GUIDE_PATH}">Anki &amp; Quizlet guide</a> · <a href="/frequent-words">Why frequent words first</a> · <a href="/english/a1">English A1 guide</a> · <a href="/english/exams">Exams &amp; study abroad</a> · <a href="/privacy">Privacy</a></p><p>Word lists built from OpenSubtitles 2018 via <a href="https://github.com/hermitdave/FrequencyWords" rel="noopener">FrequencyWords</a>, shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener license">CC BY-SA 4.0</a>.</p></div></footer>`;

const tierFor = (pct) => (pct >= 100 ? "blue" : pct >= 90 ? "gold" : pct >= 60 ? "green" : pct >= 25 ? "orange" : "red");

function langPage(l, data, n, cfg) {
  const words = data.words.slice(0, n);
  const cov = data.coverage[n];
  const url = pagePath(l, n);
  const label = l.note || l.name;
  // Titles ≤ 60 and descriptions ≤ 155 characters so Google shows them whole.
  const title = n === 100 ? `100 Most Common ${l.name} Words (Free List + Audio)`
    : n === 1000 ? `1,000 Most Common ${l.name} Words: Free Frequency List`
    : `3,000 Most Common ${l.name} Words: Full Frequency List`;
  const desc = `The ${fmt(n)} most common ${l.name} words cover ${cov}% of real speech. Free list with ${l.code === "en" ? "definitions" : "English meanings"}, audio and a CSV for Anki.`;
  const csvPath = `${pagePath(l, n)}.csv`;
  const top3 = data.words.slice(0, 3);
  const q = (x) => `<strong lang="${l.code}" translate="no">${esc(x.w)}</strong>${x.m ? ` (“${esc(x.m.split(/[;,]/)[0].trim())}”)` : ""}`;
  const need = data.needFor || {};
  const faqs = [
    [`How many ${l.name} words do I need?`, `The top 100 ${l.name} words already make up ${data.coverage[100]}% of what people say in films and TV, the top 1,000 make up ${data.coverage[1000]}%, and the top 3,000 make up ${data.coverage[3000]}%. About ${fmt(need[80] || 0)} words cover 80% and about ${fmt(need[90] || 0)} cover 90%. To follow a film comfortably you need about 95% of the words. That's why learning the most common words first is the fastest start.`],
    ["Are these words or word forms?", `They are word forms exactly as they appear in subtitles, so “${data.words[0].w}” and similar forms are counted separately. That keeps the list true to real speech; your real coverage of dictionary words is a little higher.`],
    ["Where does this list come from?", "From OpenSubtitles 2018 (millions of lines of film and TV subtitles) via the FrequencyWords project, shared under CC BY-SA 4.0. We removed abbreviations and broken fragments, and every percentage on this page is calculated from the word counts."],
  ];
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Most common words", item: `${SITE}/words` },
      { "@type": "ListItem", position: 2, name: `${l.name}`, item: `${SITE}${pagePath(l, 100)}` },
      ...(n !== 100 ? [{ "@type": "ListItem", position: 3, name: `Top ${fmt(n)}`, item: `${SITE}${url}` }] : []),
    ] },
    { "@context": "https://schema.org", "@type": "ItemList", name: `${fmt(n)} most common ${l.name} words`, numberOfItems: n,
      itemListElement: words.slice(0, 100).map((x) => ({ "@type": "ListItem", position: x.r, name: x.w })) },
    { "@context": "https://schema.org", "@type": "Dataset", name: `${fmt(n)} most common ${label} words`,
      description: `Frequency list of the ${fmt(n)} most common ${label} words from film and TV subtitles, with coverage and ${l.code === "en" ? "definitions" : "English meanings"}.`,
      url: `${SITE}${url}`, license: "https://creativecommons.org/licenses/by-sa/4.0/", isAccessibleForFree: true,
      creator: { "@type": "Organization", name: "LinguaScript", url: SITE }, isBasedOn: data.sourceUrl, dateModified: data.builtAt,
      inLanguage: l.code, distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}${csvPath}` }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  const rows = words.map((x) => `<tr id="w${x.r}" data-w="${esc(x.w)}"><td class="r">${x.r}</td><td><span class="w" lang="${l.code}" translate="no">${esc(x.w)}</span></td><td class="m">${esc(x.m || "")}</td><td class="a"></td></tr>${x.r === 20 ? `<tr class="ctarow"><td colspan="4">${cta(l)}</td></tr>` : ""}`).join("");
  const jump = n > 100 ? `<nav class="jump" aria-label="Jump to">${Array.from({ length: n / 100 }, (_, i) => `<a href="#w${i * 100 + 1}">${fmt(i * 100 + 1)}–${fmt((i + 1) * 100)}</a>`).join("")}</nav>` : "";
  const bars = SIZES.map((s) => `<div class="bar"><a href="${pagePath(l, s)}"${s === n ? ' aria-current="page"' : ""}>Top ${fmt(s)}</a><div class="track"><div class="fill" style="width:${data.coverage[s]}%;background:${s === 100 ? C.orange : s === 1000 ? C.green : C.blue}"></div></div><span>${data.coverage[s]}%</span></div>`).join("");
  return head({ title, desc, url, jsonLd }) + `
<p class="crumbs"><a href="/words">Most common words</a> › ${n === 100 ? esc(l.name) : `<a href="${pagePath(l, 100)}">${esc(l.name)}</a> › Top ${fmt(n)}`}</p>
<div class="chams">${chameleon("red", 54, "New word")}${chameleon("orange", 54, "Learning")}${chameleon("green", 54, "Known")}${chameleon("gold", 54, "Review due")}${chameleon("blue", 54, "100% known")}</div>
<h1>The ${fmt(n)} most common ${esc(l.name)} words</h1>
<p class="lead">These ${fmt(n)} words are <strong>${cov}% of everything said in ${esc(l.name)} films and TV</strong>. Learn them first and real ${esc(l.name)} opens up months sooner.${l.note ? ` This list is <strong>${esc(l.note)}</strong>.` : ""}</p>
<p class="answer">The most common ${esc(l.name)} word is ${q(top3[0])}, followed by ${q(top3[1])} and ${q(top3[2])}. Just ${fmt(need[50] || 0)} words make up half of everything people say, and the top ${fmt(n)} cover ${cov}%.</p>
<p class="updated">Updated ${esc(data.builtAt)} · <a href="${csvPath}" download>Download CSV (works with Anki)</a> · <a href="${GUIDE_PATH}#anki">How to import it</a></p>
<section class="card" aria-label="How much these words cover"><div class="big">${cov}%</div><div style="color:var(--muted);font-size:14px">of real ${esc(l.name)} speech, from just ${fmt(n)} words</div><div class="bars">${bars}</div>
<p style="margin:14px 0 0;font-size:14px;color:var(--muted)">Why so few words go so far: <a href="/frequent-words">Zipf's law, explained</a>.</p></section>
<h2>How many ${esc(l.name)} words do you need?</h2>
<table class="need"><caption class="sr">Words needed for each share of real ${esc(l.name)} speech</caption><thead><tr><th>To understand</th><th>You need about</th></tr></thead><tbody>${[50, 75, 80, 90].filter((g) => need[g]).map((g) => `<tr><td>${g}% of words you hear</td><td><strong>${fmt(need[g])}</strong> words</td></tr>`).join("")}</tbody></table>
<p style="color:var(--muted);font-size:15px">After the first few hundred words, each new word adds a little less. That's why the order matters: start at the top of this list.</p>
<h2>Tip for ${esc(l.name)} learners</h2><p style="color:var(--muted)">${esc(TIPS[l.code] || "")}</p>
<h2>Turn the list green</h2>
<div class="card you"><span id="youCham">${chameleon("red", 58)}</span><div><div class="count"><span id="known">0</span> of ${fmt(n)} known</div><div style="font-size:14px;color:var(--muted)">Tap “I know it” on words you know. Red words are new; known words turn green. Saved on this device.</div></div><div class="ptrack" aria-hidden="true"><div class="pfill" id="pfill"></div></div></div>
<h2>The list</h2>${jump}
<table><caption class="sr">The ${fmt(n)} most common ${esc(l.name)} words with ${l.code === "en" ? "meanings" : "English meanings"}</caption><thead><tr><th>#</th><th>Word</th><th>${l.code === "en" ? "Meaning" : "In English"}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
${cta(l)}
<h2>Questions</h2>${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<h2>More word lists</h2><div class="langs">${LANGS.filter((x) => x.code !== l.code).map((x) => `<a href="${pagePath(x, 100)}"><b>${esc(x.name)}</b><small>Top 100 · 1,000 · 3,000</small></a>`).join("")}</div>
<p class="method" style="margin-top:26px">Method: word counts from OpenSubtitles 2018 (FrequencyWords, CC BY-SA 4.0); abbreviations and broken fragments removed; ${l.code === "en" ? "definitions written by LinguaScript" : l.code === "fr" ? "meanings from our French dictionary, the top 100 checked by hand" : "the top 100 meanings written and checked by LinguaScript; more meanings load from our dictionary"}. Built ${data.builtAt}.</p>
` + script(l, n, cfg) + foot() + "</body></html>";
}

const cta = (l) => { const from = `words-${(l.slug || "hub")}`; return `<div class="cta card"><p>Turn these words into flashcards<span>Free. LinguaScript colours every ${esc(l.name)} word you see by how well you know it.</span></p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" data-cta="flashcards" href="/auth?mode=signup&amp;from=${from}&amp;next=%2Fflashcards%2Fcommon">Make my flashcards</a><a class="btn ghost" data-cta="watch" href="/discover?from=${from}">Watch ${esc(l.name)} videos</a></div></div>`; };

function script(l, n, cfg) {
  const tones = Object.fromEntries(Object.keys(TONES).map((t) => [t, chameleon(t, 58)]));
  return `<script>(function(){
var KEY="ls.words.${l.code}",T=${JSON.stringify(tones)},N=${n};
var known={};try{known=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
var rows=document.querySelectorAll("tr[data-w]");
rows.forEach(function(r){r.querySelector(".a").innerHTML='<button class="say" type="button" aria-label="Listen: '+r.dataset.w+'">🔊</button><button class="know" type="button" aria-pressed="false">I know it</button>'});
function tier(p){return p>=100?"blue":p>=90?"gold":p>=60?"green":p>=25?"orange":"red"}
var col={red:"${C.red}",orange:"${C.orange}",green:"${C.green}",gold:"${C.gold}",blue:"${C.blue}"};
function paint(){var k=0;rows.forEach(function(r){var on=!!known[r.dataset.w];r.classList.toggle("known",on);var b=r.querySelector(".know");b.setAttribute("aria-pressed",on);b.textContent=on?"Known ✓":"I know it";if(on)k++});
document.getElementById("known").textContent=k.toLocaleString("en-GB");var p=Math.round(k/N*100),t=tier(p);var f=document.getElementById("pfill");f.style.width=p+"%";f.style.background=col[t];document.getElementById("youCham").innerHTML=T[t]}
rows.forEach(function(r){r.querySelector(".know").addEventListener("click",function(){var w=r.dataset.w;if(known[w])delete known[w];else known[w]=1;try{localStorage.setItem(KEY,JSON.stringify(known))}catch(e){}paint()});
r.querySelector(".say").addEventListener("click",function(){try{var s=window.speechSynthesis;s.cancel();var u=new SpeechSynthesisUtterance(r.dataset.w);u.lang="${l.voice}";u.rate=.9;s.speak(u)}catch(e){}})});
paint();
${l.code === "en" || !cfg.supabaseUrl ? "" : `// Fill missing meanings from the public dictionary (public.word_dictionary).
var miss=[];rows.forEach(function(r){var m=r.querySelector(".m");if(!m.textContent.trim())miss.push(r.dataset.w)});
var byW={};rows.forEach(function(r){byW[r.dataset.w]=r});
for(var i=0;i<miss.length;i+=150){(function(part){var q=part.map(function(w){return '"'+w.replace(/"/g,'')+'"'}).join(",");
fetch(${JSON.stringify(cfg.supabaseUrl)}+"/rest/v1/word_dictionary?select=word,translation&language=eq.${l.code}&target=eq.en&word=in.("+encodeURIComponent(q)+")",{headers:{apikey:${JSON.stringify(cfg.supabaseKey)},Authorization:"Bearer "+${JSON.stringify(cfg.supabaseKey)}}})
.then(function(r){return r.ok?r.json():[]}).then(function(list){(list||[]).forEach(function(x){var r=byW[x.word];if(r&&x.translation&&x.translation.toLowerCase()!==x.word)r.querySelector(".m").textContent=x.translation})}).catch(function(){})})(miss.slice(i,i+150))}`}
})();</script>`;
}

function hubPage(all) {
  const title = "Most Common Words in 6 Languages: Free Frequency Lists";
  const desc = "Free lists of the 100, 1,000 and 3,000 most common Spanish, French, German, Italian, Portuguese and English words, from real films and TV.";
  const jsonLd = [{ "@context": "https://schema.org", "@type": "ItemList", name: "Most common words by language",
    itemListElement: LANGS.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: `${l.name} most common words`, url: `${SITE}${pagePath(l, 100)}` })) }];
  return head({ title, desc, url: "/words", jsonLd }) + `
<p class="crumbs">Most common words</p>
<div class="chams">${["red", "orange", "green", "gold", "blue"].map((t) => chameleon(t, 54)).join("")}</div>
<h1>Learn the most common words first</h1>
<p class="lead">In every language a small group of words does almost all the work. <strong>The top 100 words are about half of everything people say.</strong> Pick a language, see the words, and turn them green.</p>
<div class="langs">${LANGS.map((l) => { const d = all[l.file]; return `<a href="${pagePath(l, 100)}"><b>${esc(l.name)}${l.note ? ` <small>(Brazil)</small>` : ""}</b><small>Top 100 = <strong style="color:${C.green}">${d.coverage[100]}%</strong> · top 1,000 = ${d.coverage[1000]}% · top 3,000 = ${d.coverage[3000]}%</small></a>`; }).join("")}</div>
<p class="body" style="margin-top:18px">Every list downloads as a CSV for Anki or Quizlet. New to flashcards? Read <a href="${GUIDE_PATH}">how to use Anki and Quizlet to learn a language</a>.</p>
<h2>Why this works</h2><p style="color:var(--muted)">Languages follow <a href="/frequent-words">Zipf's law</a>: the most common word appears about twice as often as the second, three times as often as the third, and so on. So a few hundred words cover most of a conversation, and LinguaScript always teaches those first.</p>
${cta({ name: "new", slug: "hub" }).replace("every new word", "every word").replace("Watch new videos", "Watch videos")}
` + foot() + "</body></html>";
}


// Name badges for the services we work with: the name in the brand's colour, never copied logo artwork.
const SERVICES = {
  youtube: { name: "YouTube", color: "#FF0033", icon: "▶" },
  netflix: { name: "Netflix", color: "#E50914" },
  crunchyroll: { name: "Crunchyroll", color: "#F47521" },
  tv5monde: { name: "TV5MONDE", color: "#E6007E" },
  anki: { name: "Anki", color: "#6FA8FF" },
  quizlet: { name: "Quizlet", color: "#4255FF", text: "#A9B2FF" },
};
const badge = (k) => { const b = SERVICES[k]; return `<span class="svc" style="--svc:${b.color}"><i aria-hidden="true">${b.icon || b.name[0]}</i>${esc(b.name)}</span>`; };

function guidePage(all) {
  const url = GUIDE_PATH;
  const title = "How to Use Anki and Quizlet to Learn a Language";
  const desc = "Anki or Quizlet? A simple, honest guide: how each works, step-by-step setup, importing a word list, daily routine and the mistakes that waste time.";
  const faqs = [
    ["Is Anki free?", "Yes on computers (Windows, Mac, Linux), on the web (AnkiWeb) and on Android (AnkiDroid). The official iPhone and iPad app, AnkiMobile, is paid; that money helps fund Anki."],
    ["Is Quizlet free?", "Quizlet has a free plan with ads. Some study modes are limited unless you pay for Quizlet Plus. Making sets and the basic flashcards stay free."],
    ["Which is better for learning a language, Anki or Quizlet?", "For remembering words for months and years, Anki, because it schedules every card with spaced repetition. For getting started in two minutes, studying with friends, or a test next week, Quizlet. Many learners use Quizlet first and move to Anki when their deck grows."],
    ["How many new cards should I add per day?", "Start with 5 to 10 new words a day. Every new card comes back for reviews, so after a few weeks 10 new cards a day means roughly 50 to 100 reviews. Anki's default is 20 new cards a day, which is a lot for most beginners."],
    ["Can I export my LinguaScript words to Anki or Quizlet?", "Yes. Words you save while watching YouTube, Netflix, Crunchyroll or TV5MONDE go into your LinguaScript decks. On the Vocabulary page press Export and choose Anki (a CSV file with the word, its meaning and the sentence you saw it in) or Quizlet (your words are copied, ready to paste into Quizlet's Import)."],
    ["Can I import a word list into Anki or Quizlet?", "Yes. Our free most-common-word lists download as CSV files. In Anki use File, then Import. In Quizlet, open the CSV in a spreadsheet, copy the word and meaning columns and paste them into Import when you create a set."],
  ];
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Article", headline: title, description: desc, url: `${SITE}${url}`,
      author: { "@type": "Organization", name: "LinguaScript", url: SITE }, publisher: { "@type": "Organization", name: "LinguaScript", url: SITE },
      dateModified: all.es.builtAt, inLanguage: "en" },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Most common words", item: `${SITE}/words` },
      { "@type": "ListItem", position: 2, name: "Anki and Quizlet guide", item: `${SITE}${url}` }] },
  ];
  const step = (b, t) => `<li><b>${b}</b> ${t}</li>`;
  const tone = (t, label) => `<span style="color:${C[t]};border-color:${C[t]}55">${label}</span>`;
  const downloads = LANGS.map((l) => `<a href="${pagePath(l, 1000)}.csv" download><b>${esc(l.name)}${l.note ? " <small>(Brazil)</small>" : ""}</b><small>Top 1,000 · CSV · <span style="color:${C.green}">${all[l.file].coverage[1000]}%</span> of real speech</small></a>`).join("");
  return head({ title, desc, url, jsonLd }) + `
<p class="crumbs"><a href="/words">Most common words</a> › Anki &amp; Quizlet guide</p>
<div class="chams">${chameleon("red", 54, "New word")}${chameleon("orange", 54, "Learning")}${chameleon("green", 54, "Known")}${chameleon("gold", 54, "Review due")}${chameleon("blue", 54, "100% known")}</div>
<h1>How to use Anki and Quizlet to learn a language</h1>
<p class="lead">Flashcards are the fastest way to <strong>stop forgetting the words you meet</strong>. Here is how the two most popular apps work, how to set each one up in ten minutes, and the mistakes that make people quit.</p>
<div class="svcs" aria-label="Works with"><small>Save words on</small>${badge("youtube")}${badge("netflix")}${badge("crunchyroll")}${badge("tv5monde")}<small style="margin-left:6px">export to</small>${badge("anki")}${badge("quizlet")}</div>
<p class="answer"><strong>Short answer:</strong> use <strong>Anki</strong> if you want to remember words for years: it decides when you see each card again, so you review just before you'd forget. Use <strong>Quizlet</strong> if you want to start in two minutes, study with a class, or prepare for a test soon. With either app, what you put on the cards matters most: <a href="/words">the most common words first</a>, then words from things you actually watch and read.</p>
<nav class="toc" aria-label="On this page"><a href="#compare">Anki vs Quizlet</a><a href="#why">Why flashcards work</a><a href="#anki">How to use Anki</a><a href="#quizlet">How to use Quizlet</a><a href="#export">Export from LinguaScript</a><a href="#mistakes">Mistakes</a><a href="#cards">What to put on cards</a><a href="#download">Free word lists</a></nav>

<h2 id="compare">Anki vs Quizlet at a glance</h2>
<table class="vs"><caption class="sr">Anki and Quizlet compared</caption><thead><tr><th></th><th>Anki</th><th>Quizlet</th></tr></thead><tbody>
<tr><td>Price</td><td><span class="yes">Free</span> on computer, web and Android; iPhone app is paid</td><td><span class="yes">Free</span> with ads; some modes need Quizlet Plus</td></tr>
<tr><td>Spaced repetition</td><td><span class="yes">Yes, at its core</span>: every card has its own schedule</td><td><span class="meh">Partly</span>: Learn mode adapts, but there's no long-term schedule for every card</td></tr>
<tr><td>Setup</td><td><span class="meh">10–20 minutes</span>, lots of settings</td><td><span class="yes">2 minutes</span>, very simple</td></tr>
<tr><td>Best for</td><td>Big vocabularies, months of daily study</td><td>Classes, short word lists, a test next week</td></tr>
<tr><td>Ready-made decks</td><td>Thousands of shared decks (quality varies)</td><td>Millions of public sets (quality varies)</td></tr>
<tr><td>Games and modes</td><td>Mostly plain cards (add-ons on computer)</td><td>Flashcards, Learn, Test, Match and more</td></tr>
</tbody></table>
<p class="body">Neither is "the best". The best app is the one you open <strong>every day</strong>. A deck you review for 10 minutes daily beats a perfect deck you open once a week.</p>

<h2 id="why">Why flashcards work: the forgetting curve</h2>
<p class="body">In 1885 Hermann Ebbinghaus showed that we forget new things quickly at first, then more slowly, and that <strong>each review at the right moment makes a memory last longer</strong>. That's called <strong>spaced repetition</strong>: see a word again just before you would forget it, and the gap before the next review can grow.</p>
<p class="body">The second trick is <strong>active recall</strong>: trying to remember the answer before you flip the card. Struggling a little is what makes it stick, so always say your answer (out loud or in your head) before you look.</p>
<div class="card"><p style="margin:0 0 4px;font-weight:700">A word's journey (this is how LinguaScript colours it)</p>
<div class="ladder">${tone("red", "New")}${tone("orange", "Learning")}${tone("green", "Known")}${tone("gold", "Review due")}${tone("blue", "100% known")}</div>
<p style="margin:8px 0 0;font-size:14px;color:var(--muted)">Each time you remember a word, the next review comes later: minutes, then a day, then days, then weeks.</p></div>

<h2 id="anki">How to use Anki, step by step</h2>
<ol class="steps">
${step("Install it.", `Get Anki free from <a href="https://apps.ankiweb.net" rel="noopener">apps.ankiweb.net</a> for your computer. On Android, install <b>AnkiDroid</b> (free). On iPhone, <b>AnkiMobile</b> is the official paid app, or use AnkiWeb in the browser.`)}
${step("Make a free AnkiWeb account and sync.", `Click <kbd>Sync</kbd> on the computer and log in on your phone too. Now you can add cards on the computer and review on the bus.`)}
${step("Create a deck.", `Click <kbd>Create Deck</kbd> and name it, for example "Spanish – top 1,000". One deck per language is enough; too many small decks get messy.`)}
${step("Import a word list (or add cards yourself).", `Download a free list below. In Anki choose <kbd>File</kbd> → <kbd>Import</kbd> and pick the CSV. Check that the separator is <b>Comma</b>, choose your deck, and match <b>Word</b> to the Front and <b>Meaning</b> to the Back (you can ignore Rank, Count and Source). Click <kbd>Import</kbd>.`)}
${step("Turn on card reversal (optional).", `The note type <b>Basic (and reversed card)</b> makes two cards per word: Spanish → English and English → Spanish. The second one is harder but trains you to <i>use</i> the word, not just recognise it.`)}
${step("Set a sensible daily limit.", `In the deck's <kbd>Options</kbd>, set <b>New cards/day</b> to 5–10 to start. Leave Maximum reviews/day high so reviews never pile up silently. Newer versions of Anki also offer <b>FSRS</b>, a smarter scheduler; you can switch it on in the same options.`)}
${step("Study every day, and rate honestly.", `Press <kbd>Again</kbd> if you forgot, <kbd>Good</kbd> if you remembered, <kbd>Hard</kbd> or <kbd>Easy</kbd> only when it really was. Be honest: pressing Good on a word you didn't know just hides it until you've forgotten it completely.`)}
${step("Make cards better as you go.", `Add an example sentence, a picture, or audio to words that keep coming back. A word with a sentence you understand is much easier to remember than a word alone.`)}
</ol>

<h2 id="quizlet">How to use Quizlet, step by step</h2>
<ol class="steps">
${step("Sign up.", `Go to <a href="https://quizlet.com" rel="noopener">quizlet.com</a> or get the app, and make a free account.`)}
${step("Create a set.", `Tap <kbd>Create</kbd> → <b>Flashcard set</b>, give it a title like "French – top 100", and set the languages so Quizlet reads the words aloud with the right accent.`)}
${step("Import a list in one paste.", `Open one of our CSV files in Google Sheets or Excel, select the <b>Word</b> and <b>Meaning</b> columns, and copy. In Quizlet press <kbd>Import</kbd>, paste, and choose <b>Tab</b> between term and definition and <b>New line</b> between cards. Check the preview, then import.`)}
${step("Start with Flashcards.", `Flip through once, saying each answer before you turn the card. Sort the ones you don't know into "Still learning".`)}
${step("Use Learn, then Test.", `<b>Learn</b> mixes multiple choice and typing and repeats what you miss. <b>Test</b> shows you what you really know. Typing the answer beats picking it, so choose written questions when you can.`)}
${step("Use Match as a warm-up, not the main thing.", `Games are fun, but quick matching is recognition, not recall. Keep them for a 2-minute warm-up.`)}
${step("Come back tomorrow, and again in a few days.", `Quizlet won't fully schedule every card for you, so plan it yourself: same set tomorrow, then after 3 days, then after a week. Move words you know well into a separate "Known" set.`)}
</ol>

<h2 id="export">Export your words from LinguaScript to Anki or Quizlet</h2>
<p class="body">The best flashcards are words you met in something you enjoyed. LinguaScript catches them while you watch, then sends them to the flashcard app you already use.</p>
<div class="flow">
<div>${badge("netflix")}<b>1. Watch</b>YouTube, Netflix, Crunchyroll or TV5MONDE with the LinguaScript extension. Every word is coloured by how well you know it.</div>
<div><span class="svc" style="--svc:${C.red}"><i aria-hidden="true">+</i>Tap</span><b>2. Tap a word</b>See the meaning instantly and save it. LinguaScript keeps the sentence you heard it in.</div>
<div>${badge("anki")}<b>3. Export</b>On the Vocabulary page press <kbd>Export</kbd> and pick Anki or Quizlet.</div>
<div>${badge("quizlet")}<b>4. Review</b>Import once, then review in the app you like. Or just use LinguaScript's own flashcards.</div>
</div>
<ol class="steps">
${step("To Anki:", `press <kbd>Export</kbd> → <b>Anki</b>. You get a CSV file. In Anki choose <kbd>File</kbd> → <kbd>Import</kbd> and pick it. Each card has the <b>word on the front</b> and the <b>meaning plus the sentence you saw it in</b> on the back, in a deck called <b>LinguaScript::French</b> (or your language), tagged with its colour (red, orange, green, gold or blue). Export again later and Anki updates the cards you already have instead of making copies.`)}
${step("To Quizlet:", `press <kbd>Export</kbd> → <b>Quizlet</b>. Your words are copied. In Quizlet tap <kbd>Create</kbd> → <b>Flashcard set</b> → <kbd>Import</kbd>, paste, and keep <b>Tab</b> and <b>New line</b> selected. Done.`)}
${step("Choose which words:", `the export follows the deck you have selected on the Vocabulary page: <b>red</b> (new), <b>orange</b> (learning), <b>green</b> (known) or all of them. Most people export red and orange.`)}
</ol>
<h3 style="margin:26px 0 10px;font-size:18px">Where LinguaScript works</h3>
<div class="mist two">
<div>${badge("youtube")}<span style="display:block;margin-top:10px">Dual subtitles and tap-to-save in the browser extension, and on Android with the 🦎 bubble.</span></div>
<div>${badge("netflix")}<span style="display:block;margin-top:10px">Dual subtitles and tap-to-save in the browser extension on a computer.</span></div>
<div>${badge("crunchyroll")}<span style="display:block;margin-top:10px">Works when the subtitles are text. Some anime subtitles are drawn as pictures and can't be read; the extension tells you when that happens.</span></div>
<div>${badge("tv5monde")}<span style="display:block;margin-top:10px">French and other shows, with the same colours and tap-to-save.</span></div>
</div>

<h2 id="mistakes">Mistakes that make people quit</h2>
<div class="mist">
<div><b>Too many new cards</b>Adding 50 words on day one feels great and turns into 300 reviews a week later. Start small and grow.</div>
<div><b>Skipping days</b>Reviews pile up while you're away. Ten minutes every day beats an hour on Sunday.</div>
<div><b>Words with no context</b>A word you saw in a show you like sticks far better than one from a random list. Add a sentence.</div>
<div><b>Learning rare words first</b>A word you'll hear once a year isn't worth a card yet. <a href="/words">Common words</a> pay back every single day.</div>
<div><b>Only recognising</b>Seeing "perro → dog" is easier than "dog → ?". Turn on reversed cards once a word feels easy.</div>
<div><b>Flashcards only</b>Cards help you remember. Listening and reading are where you actually meet words and hear how they're used. Do both.</div>
</div>

<h2 id="cards">What should you put on your cards?</h2>
<p class="body">In every language a small group of words does most of the work: in Spanish, the top 100 words are about <strong>${all.es.coverage[100]}%</strong> of everything said in films and TV, and the top 1,000 about <strong>${all.es.coverage[1000]}%</strong>. So:</p>
<ol class="steps">
${step("First, the most common words.", `Start with a top-100 list, then top 1,000. Every one of them shows up again and again.`)}
${step("Then, words from what you watch and read.", `A word you met in a scene you enjoyed already has a memory attached. That's the word to put on a card.`)}
${step("Skip the rest for now.", `Rare words can wait. You'll meet them later, in context, when they matter.`)}
</ol>
<p class="body">That's exactly the idea behind LinguaScript: while you watch videos in the language you're learning, every word is coloured by how well you know it, and one tap turns a new word into a flashcard on the same review ladder. You can keep using Anki or Quizlet as well: <a href="#export">export your words</a> any time, and the free lists below work in both.</p>

<h2 id="download">Free word lists for Anki and Quizlet</h2>
<p class="body">Top 1,000 words for each language, from real film and TV subtitles, with English meanings. Each list also comes as top 100 and top 3,000 on its page.</p>
<div class="langs">${downloads}</div>
${cta({ name: "new", slug: "anki-guide" }).replace("every new word", "every word").replace("Watch new videos", "Watch videos")}
<h2>Questions</h2>${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<p class="method" style="margin-top:26px">Written by LinguaScript. Anki is free, open-source software by Ankitects; Quizlet is a product of Quizlet, Inc. YouTube, Netflix, Crunchyroll and TV5MONDE belong to their owners. We're not connected to, or endorsed by, any of them; names are used only to say what LinguaScript works with. App details change: check each app for current prices and features. Reference: Ebbinghaus, H. (1885), <i>Über das Gedächtnis</i> (Memory: A Contribution to Experimental Psychology).</p>
` + foot() + "</body></html>";
}

/** Writes dist/words/** as static HTML. Returns the paths written. */
export function renderWordPages(distDir, root, cfg = {}) {
  const all = {};
  for (const l of LANGS) all[l.file] = JSON.parse(fs.readFileSync(path.join(root, "src/data/wordlists", `${l.file}.json`), "utf8"));
  // /words/spanish → dist/words/spanish.html: Cloudflare's default html_handling serves it at
  // the clean URL with no redirect (a folder index.html would 307 to a trailing slash).
  const write = (p, html) => { const file = path.join(distDir, `${p}.html`); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, html); };
  write("words", hubPage(all));
  write(GUIDE_PATH.slice(1), guidePage(all));
  for (const l of LANGS) for (const n of SIZES) {
    write(pagePath(l, n).slice(1), langPage(l, all[l.file], n, cfg));
    // CSV next to the page (rank, word, meaning, count): imports straight into Anki. CC BY-SA like the source.
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    // "#" lines are Anki file headers (separator + column names), so Anki imports cleanly;
    // the Source column carries the CC BY-SA credit into every shared deck.
    const src = cell(`FrequencyWords/OpenSubtitles 2018, ${all[l.file].licence} · linguascript.co.uk${pagePath(l, n)}`);
    const csv = ["#separator:comma", "#html:false", "#columns:Rank,Word,Meaning,Count,Source", ...all[l.file].words.slice(0, n).map((x) => [x.r, cell(x.w), cell(x.m || ""), x.c, src].join(","))].join("\n") + "\n";
    fs.writeFileSync(path.join(distDir, `${pagePath(l, n).slice(1)}.csv`), csv);
  }
  return wordPagePaths();
}
