// Welcome page demo: tapping the ringed word shows its meaning, like the real
// word card on YouTube.
const word = document.getElementById('demo-word');
const card = document.getElementById('demo-card');
word.addEventListener('click', () => {
  card.hidden = !card.hidden;
});
