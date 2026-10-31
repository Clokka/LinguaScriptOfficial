import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { PhoneBubbleSetting } from "@/components/PhoneBubbleSetting";

/**
 * The Android 🦎 overlay (mobile/plugins/word-bubble) and the
 * "Save to LinguaScript" text menu (mobile/plugins/withProcessText.js),
 * explained — with the on/off switch right here when opened in the app.
 */
export default function PhoneOverlay() {
  return (
    <>
      <Seo
        title="LinguaScript overlay — tap any word on YouTube to translate it"
        description="The LinguaScript Android overlay: tap the 🦎 over YouTube or any app, tap a word in the subtitles for its meaning, and save it to your flashcards. Plus “Save to LinguaScript” in the copy and paste menu."
        path="/overlay"
      />
      <MarketingLayout
        eyebrow="Android overlay"
        heading="Tap any word on your phone. Get its meaning. Save it."
        intro={
          <>
            A little 🦎 floats over your other apps. Watching YouTube with subtitles? Tap the 🦎,
            then tap any word — you get its translation straight away, and one more tap saves it
            to your flashcards.
          </>
        }
        cta={{ label: "Start learning free", to: "/auth" }}
      >
        <div className="not-prose">
          <PhoneBubbleSetting />
        </div>

        <H2>How it works on YouTube</H2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Open a video in the YouTube app and turn on subtitles (CC).</li>
          <li>Tap the 🦎. Android asks to see the screen once — tap <strong>Start now</strong>.</li>
          <li>Your words light up in your deck colours: red (new), orange (learning), green (known), gold (review due).</li>
          <li><strong>Tap any word</strong> — even one you've never saved — for its meaning.</li>
          <li>Tap <strong>Save</strong> and it's a red flashcard. Tap anywhere else to go back to the video.</li>
        </ol>
        <p>
          The words are read on your phone by Google's on-device text reader. Your screen is never
          uploaded — only the word you tap is looked up.
        </p>

        <H2>Highlight → “Save to LinguaScript”</H2>
        <p>
          In any app where you can select text — Chrome, WhatsApp, Instagram, a news app — press on
          a word, and next to Copy and Paste you'll see <strong>Save to LinguaScript</strong>{" "}
          (sometimes behind the ⋮). You get the translation and a Save button. This one is always
          on and doesn't need the overlay.
        </p>

        <H2>Turn it on</H2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Install the LinguaScript Android app and sign in.</li>
          <li>Go to <Link to="/profile" className="text-primary underline">Profile</Link> → <strong>Colour words on my phone</strong> and switch it on.</li>
          <li>Allow <strong>Display over other apps</strong> when Android asks. Switch it off the same way any time.</li>
        </ol>

        <H2>Good to know</H2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Android only for now — iPhone doesn't let apps float over other apps.</li>
          <li>
            <strong>Netflix:</strong> the Netflix app hides its screen from every other app (it shows
            up black), so the overlay can't read it there yet. On a computer, the{" "}
            <Link to="/chrome-extension" className="text-primary underline">Chrome extension</Link> gives
            you dual subtitles on Netflix.
          </li>
          <li>Words are read from what's on screen, so pause on a subtitle if it moves too quickly.</li>
        </ul>
      </MarketingLayout>
    </>
  );
}
