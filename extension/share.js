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

const cards = {};
function card(format) {
  cards[format] = cards[format] || LSShareCard.draw({
    kicker: headline || `Learning ${name}`, from, to,
    what: `of the words in ${name} films & TV are now in my flashcards`, decks: to, format,
  });
  return cards[format];
}
// One picture (story size, also fine for posts) and ONE Share button:
// phones open the share sheet (Instagram story, WhatsApp…); computers save the
// picture and copy the caption.
async function showPreview() { $('preview').src = URL.createObjectURL(await card('story')); }
showPreview();

const note = (m) => { $('note').textContent = m; };
$('share-btn').addEventListener('click', async () => {
  const blob = await card('story');
  const file = new File([blob], 'linguascript-progress.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${text} ${LINK}` }); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  await navigator.clipboard.writeText(`${text} ${LINK}`).catch(() => {});
  note('Picture saved and caption copied ✓ Post it anywhere, or add it to your story.');
});
