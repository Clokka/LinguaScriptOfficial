import type { LearnLang } from "@/lib/landingSegment";

/**
 * Free starter courses we recommend to learners below A1, by language.
 * Every link was checked (Oct 2026). We recommend them; we are not partners,
 * so copy must never say "in partnership with" until a partner agrees.
 */
export interface Course {
  name: string;
  by: string;
  url: string;
  note: string; // level + format, plain
}

const COFFEE_BREAK: Course = {
  name: "Coffee Break",
  by: "Coffee Break Languages",
  url: "https://coffeebreaklanguages.com/",
  note: "Beginner lessons you can listen to, free podcast",
};

export const COURSES: Partial<Record<LearnLang, Course[]>> = {
  fr: [
    { name: "Getting started with French", by: "The Open University (OpenLearn)", url: "https://www.open.edu/openlearn/education-development/university-ready/free-online-french-courses", note: "Free beginner course from a UK university" },
    COFFEE_BREAK,
  ],
  zh: [
    { name: "Introduction to Chinese", by: "Chinese Zero to Hero", url: "https://www.chinesezerotohero.com/introduction-to-chinese-free-course/", note: "Free Pre-HSK 1 course, learned through a real TV show" },
  ],
  ja: [
    { name: "Japanese courses (A1 and up)", by: "The Japan Foundation (Minato)", url: "https://minato-jf.jp/", note: "Mostly free self-study courses from Japan's culture foundation" },
  ],
  es: [
    { name: "Diploma in Spanish, A1 level", by: "Alison", url: "https://alison.com/course/diploma-in-spanish-a1-level", note: "Free A1 video course (certificate optional, paid)" },
    COFFEE_BREAK,
  ],
  de: [COFFEE_BREAK],
  it: [COFFEE_BREAK],
  en: [COFFEE_BREAK],
};
