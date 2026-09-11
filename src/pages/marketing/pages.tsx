import { Link } from "react-router-dom";
import { Seo, SITE_URL } from "@/components/Seo";
import { MarketingLayout, H2, H3 } from "@/components/marketing/MarketingLayout";

/**
 * Public, indexable landing pages. Each targets one search intent, owns its
 * own title/description/canonical and links across to its siblings so the
 * cluster reinforces itself.
 */
interface PageDef {
  path: string;
  title: string;
  description: string;
  eyebrow?: string;
  heading: string;
  intro: React.ReactNode;
  body: React.ReactNode;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LinguaScript",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web, iOS, Android, Chrome",
  url: SITE_URL,
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
};

const make = (def: PageDef) => {
  const Page = () => (
    <>
      <Seo
        title={def.title}
        description={def.description}
        path={def.path}
        jsonLd={def.jsonLd}
      />
      <MarketingLayout eyebrow={def.eyebrow} heading={def.heading} intro={def.intro}>
        {def.body}
      </MarketingLayout>
    </>
  );
  Page.displayName = def.path;
  return Page;
};

export const ChameleonMethodPage = make({
  path: "/the-chameleon-method",
  title: "The Chameleon Method — learn a language by turning it green",
  description:
    "The Chameleon Method is LinguaScript's approach to language learning: watch real video, colour every word by what you actually know, and turn the language green word by word.",
  eyebrow: "The Chameleon Method",
  heading: "The Chameleon Method",
  intro: (
    <>
      A chameleon doesn't study its surroundings. It becomes them. The Chameleon Method is the
      same idea for a language: you take in real video you already enjoy, and every word you meet
      is coloured by how well you know it — red, orange, then green.
    </>
  ),
  jsonLd: softwareJsonLd,
  body: (
    <>
      <H2>The three colours</H2>
      <p>
        Every word in every subtitle you see carries a state that belongs to you, not to a generic
        difficulty list.
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong className="text-foreground">Red</strong> — new. You met it, you saved it, you
          don't own it yet.
        </li>
        <li>
          <strong className="text-foreground">Orange</strong> — learning. It's in review and
          coming back on a schedule.
        </li>
        <li>
          <strong className="text-foreground">Green</strong> — known. It fades into the background
          of the subtitle, because you no longer need to read it.
        </li>
      </ul>
      <p>
        As green spreads across a line, the line stops being a translation exercise and starts
        being a story. That is the whole method: make the language disappear into meaning.
      </p>

      <H2>Why it works</H2>
      <H3>Comprehensible input</H3>
      <p>
        Language is acquired when you understand messages slightly above your current level.
        Subtitle colouring makes "slightly above" visible in real time, so you can pick video that
        stretches you without drowning you.
      </p>
      <H3>Spaced repetition</H3>
      <p>
        Saved words come back at widening intervals, so review time is spent where forgetting is
        about to happen — not on words you already own. See{" "}
        <Link to="/anki-alternative" className="text-primary underline">
          spaced repetition built into the player
        </Link>
        .
      </p>
      <H3>Chunking</H3>
      <p>
        You can save whole phrases, not only single words. Chunks are how fluent speakers actually
        store language: as ready-made pieces rather than grammar assembled from scratch.
      </p>

      <H2>Is it "lingoscript" or "language script"?</H2>
      <p>
        People search for us as lingoscript, linguoscript and language script. It's LinguaScript —
        lingua (language) plus script (the subtitles you learn from). Same app, same chameleon.
      </p>

      <H2>Start with a video you'd have watched anyway</H2>
      <p>
        Paste a YouTube link, or use the{" "}
        <Link to="/chrome-extension" className="text-primary underline">
          browser extension
        </Link>{" "}
        on Netflix and YouTube. The method needs no textbook and no timetable.
      </p>
    </>
  ),
});

export const DualSubtitlesPage = make({
  path: "/dual-subtitles",
  title: "Dual subtitles for language learning",
  description:
    "Watch anything with dual subtitles: your target language and your own, side by side, with clickable words, instant translations and saved vocabulary that turns green as you learn.",
  eyebrow: "Dual subtitles",
  heading: "Dual subtitles that actually teach you something",
  intro: (
    <>
      Two subtitle tracks at once — the language you're learning above, your own language below.
      Every word is clickable, every translation is one tap, and every word you save follows you
      into review.
    </>
  ),
  jsonLd: softwareJsonLd,
  body: (
    <>
      <H2>What you get</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Target-language and native-language subtitles rendered together, in sync.</li>
        <li>Click any word for a translation, pronunciation and an example in context.</li>
        <li>Save a word or a whole phrase to your deck without pausing your flow.</li>
        <li>Known words dim; unknown words stay bright, so your eye goes where the value is.</li>
        <li>Download the dual-language subtitles as an SRT file if you want them offline.</li>
      </ul>

      <H2>Where it works</H2>
      <p>
        <Link to="/dual-subtitles/youtube" className="text-primary underline">
          YouTube
        </Link>{" "}
        and{" "}
        <Link to="/dual-subtitles/netflix" className="text-primary underline">
          Netflix
        </Link>{" "}
        through the extension, plus any YouTube link pasted straight into the web app. If a video
        has no caption track in your language, LinguaScript generates a translated one.
      </p>

      <H2>Dual subtitles alone aren't enough</H2>
      <p>
        Reading two lines of text feels productive, but comprehension without recall fades. That's
        why LinguaScript pairs the subtitles with{" "}
        <Link to="/anki-alternative" className="text-primary underline">
          spaced repetition
        </Link>{" "}
        and a running comprehension score, under{" "}
        <Link to="/the-chameleon-method" className="text-primary underline">
          the Chameleon Method
        </Link>
        .
      </p>
    </>
  ),
});

export const NetflixSubtitlesPage = make({
  path: "/dual-subtitles/netflix",
  title: "Netflix dual subtitles — learn from what you're already watching",
  description:
    "Add dual subtitles to Netflix: target language and native language together, clickable words, instant translations and a vocabulary deck that remembers everything you save.",
  eyebrow: "Netflix",
  heading: "Dual subtitles for Netflix",
  intro: (
    <>
      Netflix shows one subtitle track at a time. The LinguaScript extension overlays both, colours
      each word by what you know, and turns an evening's viewing into vocabulary you keep.
    </>
  ),
  jsonLd: softwareJsonLd,
  body: (
    <>
      <H2>How to set it up</H2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>Install the LinguaScript browser extension and sign in.</li>
        <li>Pick your learning language and your own language.</li>
        <li>Play anything on Netflix — the dual overlay appears over the player.</li>
        <li>Click a word to translate it, or save it to your deck for review.</li>
      </ol>
      <H2>Choosing a show</H2>
      <p>
        Aim for something you can follow at roughly 85–95% comprehension. Too easy and nothing new
        sticks; too hard and you read instead of watch. LinguaScript estimates your comprehension
        per video so you can tell the difference before committing 50 minutes.
      </p>
      <p>
        Also available for{" "}
        <Link to="/dual-subtitles/youtube" className="text-primary underline">
          YouTube
        </Link>
        .
      </p>
    </>
  ),
});

export const YouTubeSubtitlesPage = make({
  path: "/dual-subtitles/youtube",
  title: "YouTube dual subtitles — paste a link and start learning",
  description:
    "Turn any YouTube video into a language lesson with dual subtitles, clickable translations, saved vocabulary and spaced-repetition review. No extension required in the web app.",
  eyebrow: "YouTube",
  heading: "Dual subtitles for YouTube",
  intro: (
    <>
      Paste a YouTube link into LinguaScript and the video comes back with two subtitle tracks,
      clickable words and a deck waiting for whatever you save.
    </>
  ),
  jsonLd: softwareJsonLd,
  body: (
    <>
      <H2>No captions in your language? Still fine.</H2>
      <p>
        LinguaScript uses the video's own caption track when there is one, and generates a
        translated track when there isn't — including for YouTube Shorts.
      </p>
      <H2>What happens to the words you save</H2>
      <p>
        They land in your deck as red, move to orange as you review them and turn green when you
        own them. The next video you watch reflects that immediately: known words dim, and your
        comprehension estimate goes up.
      </p>
      <p>
        Prefer to stay on the site you're already on? Use the{" "}
        <Link to="/chrome-extension" className="text-primary underline">
          Chrome extension
        </Link>
        , which also covers{" "}
        <Link to="/dual-subtitles/netflix" className="text-primary underline">
          Netflix
        </Link>
        .
      </p>
    </>
  ),
});

export const SpacedRepetitionPage = make({
  path: "/anki-alternative",
  title: "Spaced repetition built into the video — an Anki alternative",
  description:
    "Save words while you watch and review them with spaced repetition in the same app. No deck building, no exporting, no separate flashcard workflow.",
  eyebrow: "Spaced repetition",
  heading: "Spaced repetition, without the deck-building homework",
  intro: (
    <>
      Anki works. Maintaining Anki is the problem. LinguaScript captures the word, the sentence it
      came from and the moment in the video, then schedules the review for you.
    </>
  ),
  jsonLd: softwareJsonLd,
  body: (
    <>
      <H2>How the scheduling works</H2>
      <p>
        Each saved word carries a state and an interval. Get it right and the gap widens; get it
        wrong and it comes back sooner. Reviews are short and daily, tied to a word goal you pick
        (1, 5 or 8 words a day) rather than an intimidating queue.
      </p>
      <H2>Why in-context beats a bare word list</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Cards keep the sentence the word appeared in, so meaning has an anchor.</li>
        <li>Pronunciation plays in the language of the content, not your interface language.</li>
        <li>Phrases can be saved whole, which is how fluent speakers store language.</li>
      </ul>
      <H2>Coming from Anki or Language Reactor?</H2>
      <p>
        See{" "}
        <Link to="/vs/language-reactor" className="text-primary underline">
          how LinguaScript compares
        </Link>
        , or start with{" "}
        <Link to="/dual-subtitles" className="text-primary underline">
          dual subtitles
        </Link>
        .
      </p>
    </>
  ),
});

export const VsLanguageReactorPage = make({
  path: "/vs/language-reactor",
  title: "LinguaScript vs Language Reactor — an honest comparison",
  description:
    "How LinguaScript compares to Language Reactor for dual subtitles on Netflix and YouTube: personal word colouring, built-in spaced repetition, progress tracking and a full companion app.",
  eyebrow: "Comparison",
  heading: "LinguaScript vs Language Reactor",
  intro: (
    <>
      Language Reactor popularised dual subtitles. LinguaScript takes the same starting point and
      adds the part that makes learning stick: your own word states, review scheduling and a
      comprehension score that moves.
    </>
  ),
  body: (
    <>
      <H2>Side by side</H2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border/60 px-3 py-2 text-left text-foreground">Feature</th>
              <th className="border border-border/60 px-3 py-2 text-left text-foreground">LinguaScript</th>
              <th className="border border-border/60 px-3 py-2 text-left text-foreground">Language Reactor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-border/60 px-3 py-2">Dual subtitles on Netflix and YouTube</td>
              <td className="border border-border/60 px-3 py-2">Yes</td>
              <td className="border border-border/60 px-3 py-2">Yes</td>
            </tr>
            <tr>
              <td className="border border-border/60 px-3 py-2">Words coloured by your own knowledge</td>
              <td className="border border-border/60 px-3 py-2">Yes — red, orange, green</td>
              <td className="border border-border/60 px-3 py-2">Frequency bands</td>
            </tr>
            <tr>
              <td className="border border-border/60 px-3 py-2">Spaced repetition without exporting</td>
              <td className="border border-border/60 px-3 py-2">Yes</td>
              <td className="border border-border/60 px-3 py-2">Anki export</td>
            </tr>
            <tr>
              <td className="border border-border/60 px-3 py-2">Comprehension tracking per video</td>
              <td className="border border-border/60 px-3 py-2">Yes</td>
              <td className="border border-border/60 px-3 py-2">No</td>
            </tr>
            <tr>
              <td className="border border-border/60 px-3 py-2">Companion web and mobile app</td>
              <td className="border border-border/60 px-3 py-2">Yes</td>
              <td className="border border-border/60 px-3 py-2">Extension-first</td>
            </tr>
          </tbody>
        </table>
      </div>
      <H2>Which should you use?</H2>
      <p>
        If you want a subtitle reader and you already run an Anki habit, Language Reactor is a
        capable tool. If you want the watching, the reviewing and the progress in one place — and
        you'd like the language to visibly turn green — that's{" "}
        <Link to="/the-chameleon-method" className="text-primary underline">
          the Chameleon Method
        </Link>
        .
      </p>
    </>
  ),
});

export const ChromeExtensionPage = make({
  path: "/chrome-extension",
  title: "LinguaScript Chrome extension — dual subtitles anywhere you watch",
  description:
    "Install the LinguaScript browser extension for dual subtitles on Netflix and YouTube, with clickable translations and vocabulary that syncs with your LinguaScript account.",
  eyebrow: "Browser extension",
  heading: "Try the LinguaScript Chrome extension",
  intro: (
    <>
      The extension puts the whole method over the player you already use: two subtitle tracks,
      clickable words, and a deck that syncs with your account on the web and mobile apps.
    </>
  ),
  jsonLd: softwareJsonLd,
  body: (
    <>
      <H2>What it does</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Dual subtitles on Netflix and YouTube.</li>
        <li>Word colouring from the same deck as the app — save on Netflix, review on your phone.</li>
        <li>Click-to-translate with pronunciation in the content's language.</li>
        <li>Native subtitles are restored automatically if anything fails, so you're never left blank.</li>
      </ul>
      <H2>Getting started</H2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          <Link to="/auth" className="text-primary underline">
            Create a free account
          </Link>
          .
        </li>
        <li>Install the extension and sign in with the same account.</li>
        <li>Play something. The overlay appears once the subtitles are ready.</li>
      </ol>
    </>
  ),
});

export const ForSchoolsPage = make({
  path: "/for-schools",
  title: "LinguaScript for schools — teacher dashboard and school sign-in",
  description:
    "Give a whole class immersion that you can see. School sign-in, a teacher dashboard with per-student vocabulary and comprehension, and content aligned to A-Level and GCSE study.",
  eyebrow: "For schools",
  heading: "School sign-in and the teacher dashboard",
  intro: (
    <>
      Language departments already use video. LinguaScript turns that watching into measurable
      vocabulary growth you can see per student, per week.
    </>
  ),
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "LinguaScript for Schools",
    description: "Classroom language immersion with a teacher dashboard.",
    brand: { "@type": "Brand", name: "LinguaScript" },
  },
  body: (
    <>
      <H2>What teachers get</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Invite students by link — no personal email addresses required to get started.</li>
        <li>Per-student words saved, words mastered and estimated comprehension.</li>
        <li>Exam-track mode that advances students through CEFR levels A1 to C2.</li>
        <li>Fluency mode for trips and enrichment, focused on the highest-frequency vocabulary.</li>
      </ul>
      <H2>Built with A-Level French in mind</H2>
      <p>
        LinguaScript started as a tool for A-Level French students and grew from there. Content is
        chosen by the teacher or by the student, so it stays relevant to the syllabus you're
        actually teaching.
      </p>
      <p>
        Already have an account?{" "}
        <Link to="/teacher" className="text-primary underline">
          Open the teacher dashboard
        </Link>
        .
      </p>
    </>
  ),
});

export const PolyglotPage = make({
  path: "/polyglot",
  title: "Polyglot plan — learn multiple languages at once",
  description:
    "Run up to five languages side by side in LinguaScript, each with its own deck, comprehension score and level. Built for people learning more than one language at a time.",
  eyebrow: "Polyglot",
  heading: "Learn multiple languages at once",
  intro: (
    <>
      Most apps assume one language per account. LinguaScript gives each language its own profile:
      its own deck, its own level, its own comprehension score — and one tap to switch.
    </>
  ),
  body: (
    <>
      <H2>Separate profiles, one account</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Up to five learning languages, each with independent progress.</li>
        <li>Switching language switches your deck, your stats and your recommendations.</li>
        <li>Per-language learning mode: fluency fast-track or exam / CEFR track.</li>
      </ul>
      <H2>How to juggle two languages without losing both</H2>
      <p>
        Keep them at different stages, not the same one. One language in heavy input, the other in
        maintenance review, works far better than splitting attention evenly. LinguaScript's daily
        word goal is per language, so maintenance can genuinely be five words a day.
      </p>
      <p>
        Learning as a household instead?{" "}
        <Link to="/family" className="text-primary underline">
          See the family plan
        </Link>
        .
      </p>
    </>
  ),
});

export const FamilyPage = make({
  path: "/family",
  title: "LinguaScript family plan — learn a language together",
  description:
    "One household, several learners: separate profiles, separate progress and a shared streak. See how families use LinguaScript to learn a language together.",
  eyebrow: "Family",
  heading: "The LinguaScript family plan",
  intro: (
    <>
      Language learning survives when it's social. A family plan puts everyone on their own profile
      with their own deck, while streaks and leaderboards keep the household honest.
    </>
  ),
  body: (
    <>
      <H2>How it works</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Each member has their own account, deck and comprehension score.</li>
        <li>Friends and leaderboards make the daily goal a shared thing rather than a chore.</li>
        <li>Children and parents can learn different languages, or the same one at different levels.</li>
      </ul>
      <H2>Interested?</H2>
      <p>
        Family pricing is rolling out. In the meantime, everything above works today on free
        accounts —{" "}
        <Link to="/pricing" className="text-primary underline">
          see current pricing
        </Link>
        .
      </p>
    </>
  ),
});

export const LearningSciencePage = make({
  path: "/language-learning-psychology",
  title: "The psychology behind learning a language faster",
  description:
    "Comprehensible input, the language acquisition device, chunking and spaced repetition — the educational psychology LinguaScript is built on, explained in plain English.",
  eyebrow: "Learning science",
  heading: "Language learning, and the psychology that makes it faster",
  intro: (
    <>
      There is no trick that installs a language overnight. There are, however, well-evidenced
      principles that decide whether ten hours of study leaves a trace or evaporates. These are the
      ones LinguaScript is built on.
    </>
  ),
  body: (
    <>
      <H2>1. Comprehensible input</H2>
      <p>
        You acquire language by understanding messages a little beyond your current level. Not by
        memorising rules first. Video with dual subtitles is one of the easiest ways to sit in that
        zone for an hour at a time.
      </p>
      <H2>2. The language acquisition device</H2>
      <p>
        The idea that humans arrive with machinery for extracting grammar from examples. Whatever
        you believe about its innateness, the practical implication is the same: feed the system
        enough real examples and the patterns come free. Explicit grammar becomes a shortcut, not
        the foundation.
      </p>
      <H2>3. Chunking</H2>
      <p>
        Working memory holds only a few items — unless those items are chunks. Fluent speakers
        store phrases whole. That's why LinguaScript lets you save phrases, not just words.
      </p>
      <H2>4. Spaced retrieval</H2>
      <p>
        Recalling something just before you'd forget it is what strengthens the memory. Rereading
        does almost nothing by comparison. See{" "}
        <Link to="/anki-alternative" className="text-primary underline">
          how the review scheduling works
        </Link>
        .
      </p>
      <H2>5. Visible progress</H2>
      <p>
        Motivation is a mechanism, not a mood. A number that moves — words green, comprehension
        percentage, a streak — keeps people in the input long enough for the other four principles
        to matter. That's the point of{" "}
        <Link to="/the-chameleon-method" className="text-primary underline">
          the Chameleon Method
        </Link>
        .
      </p>
      <p>
        More writing like this on the{" "}
        <Link to="/blog" className="text-primary underline">
          blog
        </Link>
        .
      </p>
    </>
  ),
});
