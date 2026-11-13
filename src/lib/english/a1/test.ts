// Free 20-question English A1 practice test. Questions written by LinguaScript.
// It is a practice test for learning, NOT an official CEFR exam (plan §6).
export type Skill = "Grammar" | "Vocabulary" | "Reading" | "Listening";
export interface TestQuestion {
  skill: Skill; q: string; options: string[]; answer: number;
  /** Listening items: text spoken aloud by the browser. */
  say?: string;
  /** Reading items: a short text shown above the question. */
  text?: string;
  /** Grammar unit slug to study if this is wrong. */
  study?: string;
}

export const A1_TEST: TestQuestion[] = [
  { skill: "Grammar", q: "My sister ___ 16 years old.", options: ["have", "is", "are"], answer: 1, study: "be-am-is-are" },
  { skill: "Grammar", q: "___ you from Italy?", options: ["Is", "Do", "Are"], answer: 2, study: "be-am-is-are" },
  { skill: "Grammar", q: "Sara and ___ brother live in London.", options: ["his", "her", "their"], answer: 1, study: "pronouns-possessives" },
  { skill: "Grammar", q: "He's ___ engineer.", options: ["a", "an", "the"], answer: 1, study: "a-an-the" },
  { skill: "Grammar", q: "There are three ___ in the class.", options: ["childs", "children", "childrens"], answer: 1, study: "plural-nouns" },
  { skill: "Grammar", q: "___ are my shoes. (in my hand)", options: ["This", "That", "These"], answer: 2, study: "this-that-these-those" },
  { skill: "Grammar", q: "She ___ coffee every morning.", options: ["drink", "drinks", "drinking"], answer: 1, study: "present-simple" },
  { skill: "Grammar", q: "I ___ swim, but I can ride a bike.", options: ["can't", "don't", "isn't"], answer: 0, study: "can-cant" },
  { skill: "Vocabulary", q: "The opposite of 'hot' is…", options: ["warm", "cold", "big"], answer: 1 },
  { skill: "Vocabulary", q: "Your mother's mother is your…", options: ["aunt", "sister", "grandmother"], answer: 2 },
  { skill: "Vocabulary", q: "You sleep in a…", options: ["bed", "kitchen", "fridge"], answer: 0 },
  { skill: "Vocabulary", q: "Monday, Tuesday, ___, Thursday", options: ["Saturday", "Wednesday", "Sunday"], answer: 1 },
  { skill: "Reading", text: "Hi Tom! I'm at the café next to the station. Can you meet me at 4? — Lucy", q: "Where is Lucy?", options: ["At the station", "At a café", "At home"], answer: 1 },
  { skill: "Reading", text: "Hi Tom! I'm at the café next to the station. Can you meet me at 4? — Lucy", q: "What time does Lucy want to meet?", options: ["2 o'clock", "4 o'clock", "14 o'clock"], answer: 1 },
  { skill: "Reading", text: "CLOSED ON SUNDAYS. Open Monday–Saturday, 9:00–18:00.", q: "Can you visit the shop on Sunday?", options: ["Yes", "No", "Only in the morning"], answer: 1 },
  { skill: "Reading", text: "My name is Ken. I'm from Japan. I live in Paris with my wife and our two cats. I work in a bank.", q: "What is Ken's job?", options: ["He's a teacher.", "He works in a bank.", "He has two cats."], answer: 1 },
  { skill: "Listening", say: "The train leaves at half past seven.", q: "When does the train leave?", options: ["7:00", "7:30", "6:30"], answer: 1 },
  { skill: "Listening", say: "That's twelve euros fifty, please.", q: "How much is it?", options: ["€2.50", "€12.50", "€20.50"], answer: 1 },
  { skill: "Listening", say: "Go straight on, then turn left. The bank is next to the supermarket.", q: "Where is the bank?", options: ["Next to the supermarket", "Opposite the station", "On the right"], answer: 0 },
  { skill: "Listening", say: "Hi, I'm Maria. I'm twenty-three and I'm a student.", q: "How old is Maria?", options: ["13", "23", "33"], answer: 1 },
];

export function scoreBand(score: number): { label: string; advice: string } {
  if (score >= 17) return { label: "Ready for A1 🎉", advice: "You know most of A1. Start A2 soon, and keep watching real English videos." };
  if (score >= 12) return { label: "Almost A1", advice: "A few gaps. Study the units below, then take the test again." };
  return { label: "Building up to A1", advice: "Great start! Work through the grammar units one by one and learn the 100 most common words." };
}
