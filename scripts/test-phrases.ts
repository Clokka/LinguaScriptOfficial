// npm run test:phrases: every essential phrase is well-formed and its keys
// really appear in the phrase, so "you unlocked a phrase" is never a lie.
import { phrasesFor, newlyUnlocked, nextPhrases, PHRASE_LEVELS } from '../packages/core/src/phrases';

let bad = 0;
const fail = (m: string) => { bad++; console.error('✗ ' + m); };
const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'");
const tokens = (s: string) => new Set(norm(s).split(/[\s¿?¡!.,;:«»"]+/).flatMap((t) => [t, ...t.split(/['-]/)]).filter(Boolean));
for (const lang of ['es', 'fr']) {
  const book = phrasesFor(lang);
  const ids = new Set<string>();
  for (const level of PHRASE_LEVELS) if (book.filter((p) => p.level === level).length < 10) fail(`${lang} ${level}: fewer than 10 phrases`);
  for (const p of book) {
    if (ids.has(p.id)) fail(`${p.id}: duplicate id`); ids.add(p.id);
    if (!p.text || !p.en || !p.fn || !p.keys.length || !p.parts.length) fail(`${p.id}: missing field`);
    const t = tokens(p.text);
    for (const k of p.keys) if (!k.split('|').some((f) => t.has(norm(f)))) fail(`${p.id}: key "${k}" not in "${p.text}"`);
    if (p.swap && !p.parts.some(([, role]) => role === p.swap!.role)) fail(`${p.id}: swap role "${p.swap.role}" not in parts`);
  }
  console.log(`✓ ${lang}: ${book.length} phrases`);
}
// The founder's example: saving "mucho" after "gusta" unlocks "Me gusta mucho…".
const got = newlyUnlocked('es', ['me', 'gusta', 'mucho'], 'mucho').map((p) => p.id);
if (!got.includes('es-a1-05')) fail(`gusta + mucho should unlock es-a1-05, got ${got}`);
if (nextPhrases('es', ['gusta'], 1)[0]?.missing.length !== 1) fail('nextPhrases should find a phrase one word away');
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
console.log('✓ phrase unlock rules OK');
