// Share page opened by a celebration on the video page (background openShare):
// share.html?lang=fr&from=12.3&to=58.1&headline=Top%2050%20complete
const LANG_NAMES = { fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', en: 'English', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', nl: 'Dutch', pl: 'Polish', sv: 'Swedish', th: 'Thai' };
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const lang = q.get('lang') || 'fr';
const name = LANG_NAMES[lang] || lang.toUpperCase();
const from = Math.max(0, Math.min(100, Number(q.get('from')) || 0));
const to = Math.max(0, Math.min(100, Number(q.get('to')) || 0));
const headline = (q.get('headline') || '').slice(0, 60);
const pct = LSShareCard.pct;
const LINK = `https://linguascript.co.uk/?from=share-${encodeURIComponent(lang)}`;
const text = `My ${name} words went from ${pct(from)} to ${pct(to)} of everything said in films & TV${headline ? ` (${headline})` : ''} 🦎📈 Learning with LinguaScript:`;

$('headline').textContent = headline ? `${headline}! 🎉` : 'Share your progress 🎉';
$('sentence').innerHTML = `Your ${name} words went from <b>${pct(from)}</b> to <b>${pct(to)}</b> of everything said in films & TV.`;
$('wa-btn').href = `https://wa.me/?text=${encodeURIComponent(`${text} ${LINK}`)}`;

const cards = {};
function card(format) {
  cards[format] = cards[format] || LSShareCard.draw({
    kicker: headline || `Learning ${name}`, from, to,
    what: `of the words in ${name} films & TV are now in my flashcards`, decks: to, format,
  });
  return cards[format];
}
let format = 'story';
async function showPreview() {
  const blob = await card(format);
  $('preview').src = URL.createObjectURL(blob);
  $('preview').style.aspectRatio = format === 'story' ? '1080 / 1920' : '1080 / 1350';
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  format = t.dataset.format;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
  showPreview();
}));
showPreview();

const note = (m) => { $('note').textContent = m; };
function download(blob, file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function shareFile(fmt) {
  const blob = await card(fmt);
  const file = new File([blob], `linguascript-${fmt}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${text} ${LINK}` }); return true; }
    catch (e) { if (e?.name === 'AbortError') return true; }
  }
  download(blob, file.name);
  return false;
}

$('story-btn').addEventListener('click', async () => {
  const shared = await shareFile('story');
  if (!shared) {
    await navigator.clipboard.writeText(LINK).catch(() => {});
    note('Story picture saved ✓ Open Instagram → Your story → pick it. The link is copied for a link sticker.');
  }
});
$('copy-btn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(`${text} ${LINK}`).then(() => note('Copied ✓ Paste it anywhere.'), () => note('Couldn’t copy. Select the text above instead.'));
});
$('dl-btn').addEventListener('click', async () => { download(await card(format), `linguascript-${format}.png`); note('Picture saved ✓'); });
if (navigator.share) {
  $('native-btn').classList.remove('hidden');
  $('native-btn').addEventListener('click', () => shareFile(format));
}
