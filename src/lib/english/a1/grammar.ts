// English A1 grammar: the 20 units of docs/plans/english-a1-hub.md.
// All explanations, examples and questions are written by LinguaScript.
// The TOPIC list follows the CEFR A1 level (Council of Europe); the wording is ours.

export interface CheckQuestion { q: string; options: string[]; answer: number; why: string }
export interface GrammarUnit {
  n: number; slug: string; title: string; canDo: string;
  /** Short paragraphs; `**x**` = bold. Empty for units not written yet. */
  explain: string[];
  table?: { head: string[]; rows: string[][] };
  examples: string[];
  mistakes: { wrong: string; right: string; note: string }[];
  check: CheckQuestion[];
}

export const PASS_SCORE = 6; // of 8

const soon = (n: number, slug: string, title: string, canDo: string): GrammarUnit =>
  ({ n, slug, title, canDo, explain: [], examples: [], mistakes: [], check: [] });

export const UNITS: GrammarUnit[] = [
  {
    n: 1, slug: "be-am-is-are", title: "be: am, is, are",
    canDo: "Say who you are, where you're from and how you feel.",
    explain: [
      "**be** is the most used verb in English. It tells us who or what something is, where it is, or how it feels.",
      "It changes with the person: **I am**, **you are**, **he / she / it is**, **we / they are**. In speaking we almost always use the short form: **I'm, you're, he's, she's, it's, we're, they're**.",
      "To say **no**, add **not**: *I'm not tired. She isn't here. They aren't late.*",
      "To ask a question, put **be** first: *Are you French? Is it cold? Am I late?*",
    ],
    table: {
      head: ["Person", "Yes ✓", "No ✗", "Question ?"],
      rows: [
        ["I", "I'm (I am)", "I'm not", "Am I…?"],
        ["you / we / they", "you're / we're / they're", "aren't", "Are you…?"],
        ["he / she / it", "he's / she's / it's", "isn't", "Is she…?"],
      ],
    },
    examples: [
      "I'm Ana. I'm from Brazil.",
      "She's my sister. She's 15.",
      "We're in the kitchen.",
      "It's very hot today.",
      "Are you hungry? — Yes, I am.",
      "Is he at school? — No, he isn't.",
      "They aren't at home right now.",
      "I'm not sure.",
    ],
    mistakes: [
      { wrong: "I have 15 years.", right: "I'm 15.", note: "Age uses be in English, not have." },
      { wrong: "She is from Spain? ", right: "Is she from Spain?", note: "In questions, be goes before the person." },
      { wrong: "He not is tired.", right: "He isn't tired.", note: "not goes after be." },
      { wrong: "Yes, I'm.", right: "Yes, I am.", note: "Don't use the short form at the end of a short answer." },
    ],
    check: [
      { q: "I ___ from Thailand.", options: ["is", "am", "are"], answer: 1, why: "With I, use am (I'm)." },
      { q: "My parents ___ teachers.", options: ["are", "is", "am"], answer: 0, why: "My parents = they → are." },
      { q: "___ your brother at home?", options: ["Are", "Am", "Is"], answer: 2, why: "Your brother = he → Is." },
      { q: "It ___ cold today. (no)", options: ["isn't", "aren't", "not is"], answer: 0, why: "it + is not → isn't." },
      { q: "How old are you?", options: ["I have 12 years.", "I'm 12.", "I'm 12 years."], answer: 1, why: "Age: I'm 12 (or I'm 12 years old)." },
      { q: "Are you hungry? — Yes, ___", options: ["I'm.", "I am.", "I is."], answer: 1, why: "Short answers end with the full form: Yes, I am." },
      { q: "We ___ late. Let's go!", options: ["is", "are", "am"], answer: 1, why: "we → are (we're)." },
      { q: "Choose the correct question.", options: ["She is happy?", "Is she happy?", "Happy is she?"], answer: 1, why: "Questions start with be: Is she…?" },
    ],
  },
  {
    n: 2, slug: "pronouns-possessives", title: "I, you, he… and my, your, his…",
    canDo: "Talk about people and what belongs to them.",
    explain: [
      "**Subject pronouns** do the action: **I, you, he, she, it, we, they**.",
      "**Possessive adjectives** say who something belongs to. They come **before a noun**: **my, your, his, her, its, our, their**.",
      "**his** = it belongs to a man or boy. **her** = it belongs to a woman or girl. The owner decides, not the thing: *Tom and **his** mother. Anna and **her** father.*",
      "**it's** = it is. **its** = belonging to it. *It's a dog. **Its** name is Max.*",
    ],
    table: {
      head: ["Subject", "Possessive", "Example"],
      rows: [
        ["I", "my", "My name is Leo."],
        ["you", "your", "Is this your bag?"],
        ["he", "his", "His car is red."],
        ["she", "her", "Her phone is new."],
        ["it", "its", "The cat loves its bed."],
        ["we", "our", "Our house is small."],
        ["they", "their", "Their kids are funny."],
      ],
    },
    examples: [
      "This is my friend. Her name is Julie.",
      "He's my teacher. His class is fun.",
      "We love our dog.",
      "They're from Italy. Their city is Rome.",
      "What's your favourite film?",
      "The company changed its name.",
      "Tom is with his sister.",
      "Is that your coat or my coat?",
    ],
    mistakes: [
      { wrong: "Anna and his father.", right: "Anna and her father.", note: "Anna is a woman → her." },
      { wrong: "Its a nice day.", right: "It's a nice day.", note: "it's = it is. its = belonging to it." },
      { wrong: "Me name is Sam.", right: "My name is Sam.", note: "Before a noun, use my." },
      { wrong: "The children and they mother.", right: "The children and their mother.", note: "they → their before a noun." },
    ],
    check: [
      { q: "This is Paul. ___ is my cousin.", options: ["He", "His", "Him"], answer: 0, why: "Subject → He." },
      { q: "Maria loves ___ job.", options: ["his", "her", "their"], answer: 1, why: "Maria is a woman → her." },
      { q: "We're happy with ___ new flat.", options: ["us", "our", "we"], answer: 1, why: "Before a noun: our." },
      { q: "___ raining.", options: ["Its", "It's", "It"], answer: 1, why: "It is raining → It's." },
      { q: "The dog is eating ___ food.", options: ["it's", "its", "his"], answer: 1, why: "Belonging to it → its." },
      { q: "My parents and ___ friends are here.", options: ["their", "there", "they"], answer: 0, why: "Belonging to them → their." },
      { q: "Is this ___ pen?", options: ["you", "your", "you're"], answer: 1, why: "Before a noun: your." },
      { q: "Ben and ___ brother play football.", options: ["her", "his", "its"], answer: 1, why: "Ben is a man → his." },
    ],
  },
  {
    n: 3, slug: "a-an-the", title: "a, an and the",
    canDo: "Name things and talk about one specific thing.",
    explain: [
      "Use **a** or **an** for **one** thing when it's new or not specific: *I have **a** dog.*",
      "**a** before a consonant **sound**: *a book, a car, a university (you-niversity)*. **an** before a vowel **sound**: *an apple, an egg, an hour (our)*.",
      "Use **the** when we both know which one: there's only one, or we said it before. *I have a dog. **The** dog is black. Close **the** door, please.*",
      "No article for things in general with plurals or uncountables: *I like **cats**. **Music** is great.*",
    ],
    table: {
      head: ["Use", "When", "Example"],
      rows: [
        ["a", "one thing, consonant sound", "a pen, a house, a uniform"],
        ["an", "one thing, vowel sound", "an orange, an idea, an hour"],
        ["the", "we know which one", "the sun, the door, the film we saw"],
        ["(nothing)", "things in general", "Dogs are friendly. I love coffee."],
      ],
    },
    examples: [
      "I'm a student.",
      "She eats an apple every day.",
      "There's a park near my house. The park is beautiful.",
      "Can you open the window?",
      "He's an engineer.",
      "It's an hour from here.",
      "I like music.",
      "The moon is very bright tonight.",
    ],
    mistakes: [
      { wrong: "She is teacher.", right: "She is a teacher.", note: "Jobs need a / an." },
      { wrong: "a apple", right: "an apple", note: "Vowel sound → an." },
      { wrong: "an university", right: "a university", note: "University starts with a 'you' sound → a." },
      { wrong: "I like the cats.", right: "I like cats.", note: "Things in general: no article." },
    ],
    check: [
      { q: "I want ___ orange.", options: ["a", "an", "the"], answer: 1, why: "Orange starts with a vowel sound → an." },
      { q: "My mum is ___ doctor.", options: ["a", "an", "—"], answer: 0, why: "Jobs: a doctor." },
      { q: "Please close ___ door.", options: ["a", "an", "the"], answer: 2, why: "We both know which door → the." },
      { q: "It takes ___ hour.", options: ["a", "an", "the"], answer: 1, why: "hour sounds like 'our' → an." },
      { q: "She goes to ___ university in Paris.", options: ["an", "a", "—"], answer: 1, why: "'you-niversity' → a." },
      { q: "I love ___ chocolate.", options: ["the", "a", "—"], answer: 2, why: "In general → no article." },
      { q: "I saw a film. ___ film was great.", options: ["A", "The", "An"], answer: 1, why: "Now we know which film → The." },
      { q: "Look at ___ sun!", options: ["a", "the", "—"], answer: 1, why: "There's only one sun → the." },
    ],
  },
  {
    n: 4, slug: "plural-nouns", title: "Plural nouns",
    canDo: "Talk about more than one thing.",
    explain: [
      "Most nouns add **-s**: *one book → two book**s***.",
      "After **s, ss, sh, ch, x**, add **-es**: *bus → bus**es**, watch → watch**es**, box → box**es***.",
      "Consonant + **y** → **-ies**: *city → cit**ies**, baby → bab**ies***. Vowel + y just adds -s: *day → days, boy → boys*.",
      "Some plurals are **irregular**. Learn them by heart: *man → **men**, woman → **women**, child → **children**, person → **people**, foot → **feet**, tooth → **teeth***.",
    ],
    table: {
      head: ["Rule", "Singular", "Plural"],
      rows: [
        ["+ s", "car, friend", "cars, friends"],
        ["s / sh / ch / x + es", "class, dish, beach, box", "classes, dishes, beaches, boxes"],
        ["consonant + y → ies", "city, party", "cities, parties"],
        ["irregular", "man, child, person", "men, children, people"],
      ],
    },
    examples: [
      "I have two brothers.",
      "There are three buses every hour.",
      "My cousin has two babies.",
      "Those people are my neighbours.",
      "The children are in the garden.",
      "I brush my teeth twice a day.",
      "We visited five cities.",
      "Women and men are welcome.",
    ],
    mistakes: [
      { wrong: "two childs", right: "two children", note: "child is irregular." },
      { wrong: "three peoples", right: "three people", note: "people is already plural." },
      { wrong: "two citys", right: "two cities", note: "consonant + y → ies." },
      { wrong: "many informations", right: "a lot of information", note: "information has no plural." },
    ],
    check: [
      { q: "one box → two ___", options: ["boxs", "boxes", "boxies"], answer: 1, why: "After x → -es." },
      { q: "one city → two ___", options: ["citys", "cityes", "cities"], answer: 2, why: "Consonant + y → -ies." },
      { q: "one child → three ___", options: ["childs", "children", "childrens"], answer: 1, why: "Irregular: children." },
      { q: "one day → two ___", options: ["days", "daies", "dayes"], answer: 0, why: "Vowel + y → just -s." },
      { q: "one woman → two ___", options: ["womans", "women", "womens"], answer: 1, why: "Irregular: women." },
      { q: "one watch → two ___", options: ["watchs", "watches", "watchies"], answer: 1, why: "After ch → -es." },
      { q: "There are ten ___ in the room.", options: ["person", "peoples", "people"], answer: 2, why: "Plural of person = people." },
      { q: "one foot → two ___", options: ["foots", "feet", "feets"], answer: 1, why: "Irregular: feet." },
    ],
  },
  {
    n: 5, slug: "this-that-these-those", title: "this, that, these, those",
    canDo: "Point at things near you and far from you.",
    explain: [
      "Use **this** (one) and **these** (more than one) for things **near** you: *This is my phone. These are my keys.*",
      "Use **that** (one) and **those** (more than one) for things **far** from you: *That's my house over there. Those are my friends.*",
      "To introduce people, use **this**: ***This** is my sister, Emma.*",
      "On the phone: *Hello, **this** is Leo.*",
    ],
    table: {
      head: ["", "Near ✋", "Far 👉"],
      rows: [
        ["One", "this", "that"],
        ["More than one", "these", "those"],
      ],
    },
    examples: [
      "This is my best friend, Tom.",
      "These shoes are new.",
      "Is that your car?",
      "Those mountains are beautiful.",
      "What's this?",
      "Who are those people?",
      "I love this song!",
      "That was a great film.",
    ],
    mistakes: [
      { wrong: "This shoes are nice.", right: "These shoes are nice.", note: "More than one → these." },
      { wrong: "Those is my bag.", right: "That is my bag.", note: "One thing → that." },
      { wrong: "He is my brother, Sam. (introducing)", right: "This is my brother, Sam.", note: "Introduce people with this." },
    ],
    check: [
      { q: "___ is my phone. (in my hand)", options: ["This", "That", "Those"], answer: 0, why: "One, near → this." },
      { q: "___ are my keys. (in my hand)", options: ["This", "These", "Those"], answer: 1, why: "More than one, near → these." },
      { q: "Look at ___ bird in the sky!", options: ["this", "these", "that"], answer: 2, why: "One, far → that." },
      { q: "Who are ___ people over there?", options: ["that", "those", "this"], answer: 1, why: "More than one, far → those." },
      { q: "Mum, ___ is my friend Ana.", options: ["this", "these", "those"], answer: 0, why: "Introducing someone → this." },
      { q: "___ apples are very sweet. (near)", options: ["This", "These", "That"], answer: 1, why: "Plural, near → these." },
      { q: "Hello, ___ is Leo speaking.", options: ["that", "this", "it"], answer: 1, why: "On the phone: this is…" },
      { q: "Is ___ your house? (far away)", options: ["this", "that", "these"], answer: 1, why: "One, far → that." },
    ],
  },
  soon(6, "questions-with-be", "Questions with be + question words", "Ask where, who, what, how old…"),
  soon(7, "there-is-there-are", "there is / there are", "Describe a place."),
  soon(8, "prepositions-of-place", "Prepositions of place", "Say where things are: in, on, under, next to."),
  soon(9, "have-got", "have got / have", "Talk about family and things you own."),
  soon(10, "present-simple", "Present simple", "Talk about routines and facts."),
  soon(11, "present-simple-questions", "Present simple questions", "Ask about habits: Do you…?"),
  soon(12, "adverbs-of-frequency", "Adverbs of frequency", "Say how often: always, usually, never."),
  soon(13, "prepositions-of-time", "Prepositions of time", "Say when: at, on, in."),
  soon(14, "can-cant", "can / can't", "Talk about ability and ask permission."),
  soon(15, "like-love-hate-ing", "like / love / hate + -ing", "Talk about what you enjoy."),
  soon(16, "some-any-countable", "some / any, countable and uncountable", "Shop and order food."),
  soon(17, "imperatives", "Imperatives", "Give simple instructions."),
  soon(18, "present-continuous", "Present continuous", "Say what's happening now."),
  soon(19, "was-were", "Past of be: was / were", "Talk about yesterday."),
  soon(20, "object-pronouns-possessive-s", "me, him, her… and 's", "Talk about people and things they own."),
];

export const unitBySlug = (slug: string) => UNITS.find((u) => u.slug === slug);
export const isReady = (u: GrammarUnit) => u.check.length > 0;

/** Split a unit string into plain and **bold** parts (single * marks are dropped). */
export function richParts(text: string): { t: string; b?: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? { t: part.slice(2, -2), b: true }
      : { t: part.replace(/\*/g, "") });
}
