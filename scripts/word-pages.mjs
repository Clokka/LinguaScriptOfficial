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
const SIZES = [100, 1000, 3000];
export const wordPagePaths = () => ["/words", ...LANGS.flatMap((l) => SIZES.map((n) => pagePath(l, n)))];
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

const foot = () => `</main><footer><div class="wrap"><p><a href="/words">Most common words</a> · <a href="/frequent-words">Why frequent words first</a> · <a href="/english/a1">English A1 guide</a> · <a href="/english/exams">Exams &amp; study abroad</a> · <a href="/privacy">Privacy</a></p><p>Word lists built from OpenSubtitles 2018 via <a href="https://github.com/hermitdave/FrequencyWords" rel="noopener">FrequencyWords</a>, shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener license">CC BY-SA 4.0</a>.</p></div></footer>`;

const tierFor = (pct) => (pct >= 100 ? "blue" : pct >= 90 ? "gold" : pct >= 60 ? "green" : pct >= 25 ? "orange" : "red");

function langPage(l, data, n, cfg) {
  const words = data.words.slice(0, n);
  const cov = data.coverage[n];
  const url = pagePath(l, n);
  const label = l.note || l.name;
  const title = `The ${fmt(n)} Most Common ${l.name} Words (${cov}% of real speech) | LinguaScript`;
  const desc = `Learn the ${fmt(n)} most common ${label} words first: together they are ${cov}% of everything said in ${l.name} films and TV. Free list with ${l.code === "en" ? "simple definitions" : "English meanings"}, audio and progress.`;
  const faqs = [
    [`How many ${l.name} words do I need?`, `The top 100 ${l.name} words already make up ${data.coverage[100]}% of what people say in films and TV, the top 1,000 make up ${data.coverage[1000]}%, and the top 3,000 make up ${data.coverage[3000]}%. To follow a film comfortably you need about 95% of the words, which takes a few thousand. That's why learning the most common words first is the fastest start.`],
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
<section class="card" aria-label="How much these words cover"><div class="big">${cov}%</div><div style="color:var(--muted);font-size:14px">of real ${esc(l.name)} speech, from just ${fmt(n)} words</div><div class="bars">${bars}</div>
<p style="margin:14px 0 0;font-size:14px;color:var(--muted)">Why so few words go so far: <a href="/frequent-words">Zipf's law, explained</a>.</p></section>
<h2>Turn the list green</h2>
<div class="card you"><span id="youCham">${chameleon("red", 58)}</span><div><div class="count"><span id="known">0</span> of ${fmt(n)} known</div><div style="font-size:14px;color:var(--muted)">Tap “I know it” on words you know. Red words are new; known words turn green. Saved on this device.</div></div><div class="ptrack" aria-hidden="true"><div class="pfill" id="pfill"></div></div></div>
<h2>The list</h2>${jump}
<table><thead><tr><th>#</th><th>Word</th><th>${l.code === "en" ? "Meaning" : "In English"}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
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
  const title = "The Most Common Words in 6 Languages (free lists) | LinguaScript";
  const desc = "Free lists of the 100, 1,000 and 3,000 most common words in Spanish, French, German, Italian, Portuguese and English, measured from real films and TV. With meanings, audio and progress.";
  const jsonLd = [{ "@context": "https://schema.org", "@type": "ItemList", name: "Most common words by language",
    itemListElement: LANGS.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: `${l.name} most common words`, url: `${SITE}${pagePath(l, 100)}` })) }];
  return head({ title, desc, url: "/words", jsonLd }) + `
<p class="crumbs">Most common words</p>
<div class="chams">${["red", "orange", "green", "gold", "blue"].map((t) => chameleon(t, 54)).join("")}</div>
<h1>Learn the most common words first</h1>
<p class="lead">In every language a small group of words does almost all the work. <strong>The top 100 words are about half of everything people say.</strong> Pick a language, see the words, and turn them green.</p>
<div class="langs">${LANGS.map((l) => { const d = all[l.file]; return `<a href="${pagePath(l, 100)}"><b>${esc(l.name)}${l.note ? ` <small>(Brazil)</small>` : ""}</b><small>Top 100 = <strong style="color:${C.green}">${d.coverage[100]}%</strong> · top 1,000 = ${d.coverage[1000]}% · top 3,000 = ${d.coverage[3000]}%</small></a>`; }).join("")}</div>
<h2>Why this works</h2><p style="color:var(--muted)">Languages follow <a href="/frequent-words">Zipf's law</a>: the most common word appears about twice as often as the second, three times as often as the third, and so on. So a few hundred words cover most of a conversation, and LinguaScript always teaches those first.</p>
${cta({ name: "new", slug: "hub" }).replace("every new word", "every word").replace("Watch new videos", "Watch videos")}
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
  for (const l of LANGS) for (const n of SIZES) write(pagePath(l, n).slice(1), langPage(l, all[l.file], n, cfg));
  return wordPagePaths();
}
