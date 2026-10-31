import Seo from "@/components/Seo";
import { InfoPageShell, InfoSection } from "@/components/InfoPageShell";

const Manual = () => (
  <>
    <Seo title="LinguaScript manual" description="Step-by-step guide to LinguaScript: setup, watching videos, saving words, flashcards, the Chrome extension and the Android app." path="/manual" />
    <InfoPageShell title="LinguaScript manual" intro="Everything you need to get set up and learning, step by step.">
      <InfoSection title="Getting started">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Create a free account with Google or email.</li>
          <li>Choose your native language and the language you want to learn.</li>
          <li>Pick your level — from absolute beginner to C2. LinguaScript marks the words you probably already know.</li>
          <li>Choose one hobby so your recommendations match what you enjoy.</li>
        </ol>
      </InfoSection>
      <InfoSection title="Watching a video">
        <ul className="list-disc pl-5 space-y-1">
          <li>Open a recommended video on Home, or paste any YouTube link.</li>
          <li>Each video shows its vocabulary coverage — the share of its words you already know.</li>
          <li>Tap a word in the subtitles to see the meaning, hear it and save it.</li>
          <li>The counter under the video shows words saved (for example 3/8). Tap it any time to review.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Flashcards">
        <ul className="list-disc pl-5 space-y-1">
          <li>Open Flashcards from the menu. Due cards appear first.</li>
          <li>Flip the card, then mark whether you knew it.</li>
          <li>Too hard? Tap the red button to move a card back down a deck.</li>
          <li>Each day, 10 new words from your current Top-50 step are added for you.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Chrome extension">
        <ul className="list-disc pl-5 space-y-1">
          <li>Install LinguaScript from the Chrome Web Store and sign in.</li>
          <li>On YouTube, your words are coloured inside the subtitles.</li>
          <li>On any website, press Alt+L to open the reader.</li>
          <li>In the pop-up, choose Colour or Rings for how words are shown.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Android app">
        <ul className="list-disc pl-5 space-y-1">
          <li>Allow LinguaScript to appear over other apps when asked.</li>
          <li>Tap the 🦎 bubble in any app to colour the words on screen.</li>
          <li>Select text in any app and choose LinguaScript to translate and save it.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Settings">
        <ul className="list-disc pl-5 space-y-1">
          <li>Profile → change your daily word goal (1–40), level, native language and word style.</li>
          <li>Free plan: one learning language. Pro: unlimited languages.</li>
        </ul>
      </InfoSection>
    </InfoPageShell>
  </>
);

export default Manual;
