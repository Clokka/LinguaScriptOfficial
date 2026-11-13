// A1 "I can…" checklist, grouped like the CEFR skills. Written in our own words,
// based on the Council of Europe's A1 descriptors. Ticks are saved in ls.a1.v1.
import { UNITS, isReady } from "./grammar";

export interface Practice { to: string; label: string; ready: boolean }
export interface CheckItem { id: string; text: string; practice?: Practice }
export interface CheckGroup { id: string; title: string; items: CheckItem[] }

const unit = (slug: string): Practice => {
  const u = UNITS.find((x) => x.slug === slug)!;
  return { to: `/english/a1/grammar/${slug}`, label: `Grammar: ${u.title}`, ready: isReady(u) };
};
const TEST: Practice = { to: "/english/a1/test", label: "Practice test", ready: true };
const WORDS: Practice = { to: "/english/a1/words", label: "A1 words", ready: true };
const SOON = (label: string): Practice => ({ to: "", label, ready: false });

export const CHECKLIST: CheckGroup[] = [
  { id: "basics", title: "Everyday basics", items: [
    { id: "alphabet", text: "I can say the alphabet and spell my name.", practice: SOON("Everyday basics lesson") },
    { id: "numbers", text: "I can count to 100 and say a phone number.", practice: SOON("Everyday basics lesson") },
    { id: "time", text: "I can tell the time.", practice: TEST },
    { id: "dates", text: "I know the days, months and seasons, and can say a date.", practice: SOON("Everyday basics lesson") },
    { id: "prices", text: "I can say and understand prices.", practice: TEST },
    { id: "greetings", text: "I can greet people, say goodbye, thank and say sorry.", practice: SOON("Everyday basics lesson") },
  ] },
  { id: "listening", title: "Listening", items: [
    { id: "l-numbers", text: "I can understand numbers, prices and times when people speak slowly.", practice: TEST },
    { id: "l-directions", text: "I can follow simple directions: left, right, straight on.", practice: TEST },
    { id: "l-questions", text: "I can understand slow, clear questions about me: my name, age and where I live.", practice: TEST },
    { id: "l-instructions", text: "I can understand short, simple instructions.", practice: unit("imperatives") },
  ] },
  { id: "reading", title: "Reading", items: [
    { id: "r-signs", text: "I can read signs and notices: open, closed, exit, no entry.", practice: TEST },
    { id: "r-messages", text: "I can understand a short, simple message or postcard.", practice: TEST },
    { id: "r-forms", text: "I can find a name, date or price in a simple form or advert.", practice: TEST },
    { id: "r-words", text: "I can read and understand my A1 words.", practice: WORDS },
  ] },
  { id: "speaking", title: "Speaking (on my own)", items: [
    { id: "s-intro", text: "I can introduce myself: name, age, country, school or job.", practice: unit("be-am-is-are") },
    { id: "s-family", text: "I can describe my family and where I live in simple sentences.", practice: unit("pronouns-possessives") },
    { id: "s-likes", text: "I can say what I like and don't like.", practice: unit("like-love-hate-ing") },
    { id: "s-can", text: "I can say what I can and can't do.", practice: unit("can-cant") },
    { id: "s-routine", text: "I can describe my day in simple sentences.", practice: unit("present-simple") },
  ] },
  { id: "conversation", title: "Conversation", items: [
    { id: "c-personal", text: "I can ask and answer simple questions: Where are you from? How old are you?", practice: unit("questions-with-be") },
    { id: "c-order", text: "I can order food or a drink and ask how much it is.", practice: unit("some-any-countable") },
    { id: "c-repeat", text: "I can ask someone to repeat or speak more slowly.", practice: SOON("Conversation lesson") },
    { id: "c-arrange", text: "I can agree a day and time to meet.", practice: unit("prepositions-of-time") },
    { id: "c-polite", text: "I can ask for things politely: Can I have…? I'd like…", practice: unit("can-cant") },
  ] },
  { id: "writing", title: "Writing", items: [
    { id: "w-form", text: "I can fill in a form with my name, address and date of birth.", practice: SOON("Writing lesson") },
    { id: "w-message", text: "I can write a short message or postcard (25–35 words).", practice: SOON("Writing lesson") },
    { id: "w-about", text: "I can write simple sentences about me and my family.", practice: unit("be-am-is-are") },
  ] },
];

export const CHECK_IDS = CHECKLIST.flatMap((g) => g.items.map((i) => i.id));
