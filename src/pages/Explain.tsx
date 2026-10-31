import Seo from "@/components/Seo";
import { InfoPageShell, InfoSection } from "@/components/InfoPageShell";

const Explain = () => (
  <>
    <Seo title="How LinguaScript works" description="LinguaScript turns the YouTube videos you love into language lessons: tap words, save them, and watch them change colour as you learn." path="/explain" />
    <InfoPageShell title="How LinguaScript works" intro="Learn a language from videos you actually enjoy. Every word you meet gets a colour, and the colours change as you learn.">
      <InfoSection title="1. Watch what you love">
        <p>Pick one hobby — travel, anime, football, business — and LinguaScript finds popular videos in the language you're learning. It recommends videos where you already know about 98% of the words, so they're challenging but understandable.</p>
      </InfoSection>
      <InfoSection title="2. Tap words you don't know">
        <p>Dual subtitles show the video's language with your own underneath. Tap any word to see its meaning and hear it, then save it to your flashcards.</p>
      </InfoSection>
      <InfoSection title="3. Watch the colours change">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Red</strong> — new word, just saved.</li>
          <li><strong className="text-foreground">Orange</strong> — you're getting it.</li>
          <li><strong className="text-foreground">Green</strong> — you know it.</li>
          <li><strong className="text-foreground">Gold</strong> — time to review it so it sticks.</li>
        </ul>
      </InfoSection>
      <InfoSection title="4. Review with flashcards">
        <p>Short flashcard reviews come back at the right moment: 5 minutes, then 1, 3, 7, 14 and 30 days. Words follow the same schedule on the website, the Chrome extension and the Android app.</p>
      </InfoSection>
      <InfoSection title="5. Climb the most common words">
        <p>Words are grouped in steps of 50 — Top 50, Top 100, all the way to Top 3,000. Finish a step and the next one unlocks. Knowing the most common 3,000 words covers most everyday speech.</p>
      </InfoSection>
      <InfoSection title="The Chameleon Method">
        <p>Inspired by polyglot Kató Lomb: read and watch real content, then use your new words. Your chameleon changes colour with you as your words go from red to green.</p>
      </InfoSection>
    </InfoPageShell>
  </>
);

export default Explain;
