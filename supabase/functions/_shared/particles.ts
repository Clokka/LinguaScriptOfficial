// Grammar and politeness particles have no word-for-word translation. A plain
// translator gives them the meaning they have when used ALONE as a reply
// (Thai ครับ → "yes" / "Sí"), which teaches the wrong thing. These notes tell
// the learner what the word does; translate-word puts them in the learner's
// language.
const PARTICLES: Record<string, Record<string, string>> = {
  th: {
    'ครับ': 'polite ending used by male speakers (alone it can mean "yes")',
    'ค่ะ': 'polite ending used by female speakers in statements (alone it can mean "yes")',
    'คะ': 'polite ending used by female speakers in questions',
    'นะ': 'softening particle at the end of a sentence ("okay?", "you know")',
    'จ้ะ': 'friendly, affectionate ending particle',
    'จ้า': 'friendly, casual ending particle',
    'ไหม': 'question particle that turns a sentence into a yes/no question',
    'มั้ย': 'question particle that turns a sentence into a yes/no question (casual)',
    'หรอ': 'question particle showing surprise ("really?")',
  },
  zh: {
    '吗': 'question particle that turns a sentence into a yes/no question',
    '呢': 'particle for follow-up questions ("and what about…?") or ongoing actions',
    '吧': 'particle for suggestions or guesses ("let\'s…", "…right?")',
    '了': 'particle marking a completed action or a change of state',
    '啊': 'particle adding emotion or emphasis to a sentence',
  },
  ja: {
    'ね': 'sentence-ending particle seeking agreement ("…isn\'t it?", "right?")',
    'よ': 'sentence-ending particle adding emphasis or new information ("you know")',
    'か': 'sentence-ending particle that makes a question',
    'です': 'polite copula ("is / am / are", polite)',
    'ます': 'polite verb ending',
  },
  ko: {
    '요': 'polite ending added to sentences',
  },
};

const CODE_BY_NAME: Record<string, string> = {
  thai: 'th', chinese: 'zh', mandarin: 'zh', japanese: 'ja', korean: 'ko',
};

/** English note for a known particle, or null. `from` is a language name or code. */
export function particleNote(word: string, from: string): string | null {
  const f = String(from || '').trim().toLowerCase();
  const code = CODE_BY_NAME[f] || f.slice(0, 2);
  return PARTICLES[code]?.[String(word || '').trim()] ?? null;
}
