// One bibliography for the English guide pages (/english/a1/sources, /english/exams)
// and docs/plans/english-a1-hub.md. Add every source we use here.
export interface Source { group: string; cite: string; url?: string; note?: string }

export const SOURCES: Source[] = [
  { group: "CEFR (the levels)", cite: "Council of Europe (2020). Common European Framework of Reference for Languages: Learning, Teaching, Assessment. Companion Volume.", url: "https://www.coe.int/en/web/common-european-framework-reference-languages", note: "The official A1 descriptors our syllabus follows." },
  { group: "CEFR (the levels)", cite: "Council of Europe (2009). Relating Language Examinations to the CEFR: A Manual.", url: "https://www.coe.int/en/web/common-european-framework-reference-languages", note: "How a test is aligned to CEFR levels (for a future LinguaScript certificate)." },
  { group: "Word frequency", cite: "Nation, I.S.P. (2006). How large a vocabulary is needed for reading and listening? Canadian Modern Language Review, 63(1), 59–82." },
  { group: "Word frequency", cite: "Milton, J. (2010). The development of vocabulary breadth across the CEFR levels. In I. Bartning, M. Martin & I. Vedder (eds.), Communicative proficiency and linguistic development, EUROSLA Monographs Series 1, 211–232.", note: "Vocabulary size estimates per CEFR level; why A1 word counts vary." },
  { group: "Word frequency", cite: "Webb, S. & Rodgers, M. (2009). The lexical coverage of movies. Applied Linguistics, 30(3), 407–427." },
  { group: "Word frequency", cite: "Oxford English Corpus: frequency ranking of the most common English words (used for our top 100).", note: "Also used on /frequent-words." },
  { group: "Exams (official sites)", cite: "IELTS: British Council, IDP and Cambridge University Press & Assessment.", url: "https://ielts.org" },
  { group: "Exams (official sites)", cite: "TOEFL iBT: ETS.", url: "https://www.ets.org/toefl.html" },
  { group: "Exams (official sites)", cite: "TOEIC: ETS.", url: "https://www.ets.org/toeic.html" },
  { group: "Exams (official sites)", cite: "PTE Academic: Pearson.", url: "https://www.pearsonpte.com" },
  { group: "Exams (official sites)", cite: "Duolingo English Test.", url: "https://englishtest.duolingo.com" },
  { group: "Exams (official sites)", cite: "Cambridge English Qualifications (A1 Movers, A2 Key, B2 First, C1 Advanced): Cambridge University Press & Assessment.", url: "https://www.cambridgeenglish.org" },
  { group: "Exams (official sites)", cite: "Trinity College London: GESE (Graded Examinations in Spoken English).", url: "https://www.trinitycollege.com" },
  { group: "Exams (official sites)", cite: "LanguageCert ESOL qualifications.", url: "https://www.languagecert.org" },
  { group: "Exams (official sites)", cite: "Pearson English International Certificate.", url: "https://www.pearson.com/english" },
  { group: "Reference sites reviewed (topic coverage only, never copied)", cite: "test-english.com: A1 grammar points.", url: "https://test-english.com/grammar-points/a1/contents-a1/" },
  { group: "Reference sites reviewed (topic coverage only, never copied)", cite: "English Radar: English level A1.", url: "https://www.englishradar.com/english-levels/english-level-a1/" },
  { group: "Reference sites reviewed (topic coverage only, never copied)", cite: "Lenguia: A1 English grammar.", url: "https://www.lenguia.com/grammar/english/a1" },
  { group: "Reference sites reviewed (topic coverage only, never copied)", cite: "Perfect English Grammar: A1 grammar course curriculum.", url: "https://www.perfect-english-grammar.com" },
  { group: "Reference sites reviewed (topic coverage only, never copied)", cite: "ESL Lounge: A1 CEFR vocabulary word list.", url: "https://www.esl-lounge.com/student/reference/a1-cefr-vocabulary-word-list.php" },
];

export const SOURCE_GROUPS = [...new Set(SOURCES.map((s) => s.group))];
