import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Link } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { AIConnectionCards } from "@/components/premium/BrandExperience";

/** The LinguaScript MCP server (src/lib/mcp → supabase/functions/mcp). See docs/MCP.md. */
export const MCP_URL = "https://ffephracinqeylfhqkiz.supabase.co/functions/v1/mcp";

// Neither app has a link that adds a connector for you, so the fastest path is:
// one tap copies the link AND opens the right settings screen; the learner pastes.
const APPS = {
  claude: {
    name: "Claude",
    settings: "https://claude.ai/settings/connectors",
    steps: [
      "Tap “Add custom connector”. Name: LinguaScript — paste the link.",
      "Claude then shows sign-in settings. Don't change anything — it has already picked the right ones. Scroll down and tap Add.",
      "Tap Connect and sign in with your normal LinguaScript email and password. Done!",
    ],
  },
  chatgpt: {
    name: "ChatGPT",
    settings: "https://chatgpt.com/#settings/Connectors",
    steps: [
      "Open “Advanced” and switch on Developer mode (needed for custom connectors).",
      "Tap “Create”. Name: LinguaScript — paste the link as the server URL, Authentication: OAuth.",
      "Leave any other settings as they are. Tick “I trust this application”, tap Create, and sign in with your normal LinguaScript email and password.",
    ],
  },
} as const;
type AppKey = keyof typeof APPS;

// One tap opens the AI with today's lesson already typed in (claude.ai/new?q=
// and chatgpt.com/?q= prefill the message). The MCP server instructions do the
// rest, so the learner never writes a prompt.
const LESSON_PROMPT =
  "Use LinguaScript to give me today's language lesson: check my progress, quiz my due words one at a time, then teach me a few new frequent words in a short story about my hobby.";
const LESSON_LINKS: Record<AppKey, string> = {
  claude: `https://claude.ai/new?q=${encodeURIComponent(LESSON_PROMPT)}`,
  chatgpt: `https://chatgpt.com/?q=${encodeURIComponent(LESSON_PROMPT)}`,
};

const PROMPTS = [
  LESSON_PROMPT,
  "Teach me the 5 most common words in my language that I don't know yet, then save them to LinguaScript.",
  "Quiz me on my due LinguaScript reviews, one word at a time.",
  "Write a short story about my hobby using my red LinguaScript words.",
];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        if (await copy(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
      {done ? "Copied" : label}
    </Button>
  );
}

export default function ConnectAI() {
  const { isPro, loading } = useSubscription();
  const [app, setApp] = useState<AppKey>(() => new URLSearchParams(window.location.search).get("app") === "chatgpt" ? "chatgpt" : "claude");
  const a = APPS[app];

  const copyAndOpen = async () => {
    if (!isPro || loading) return;
    // Start the copy and open the tab in the same tap — opening after an
    // await gets the new tab blocked on phones.
    const copied = copy(MCP_URL);
    window.open(a.settings, "_blank", "noopener");
    track("mcp_connect_clicked", { app });
    if (await copied) toast.success("Link copied — paste it in " + a.name);
    else toast("Copy the link below, then paste it in " + a.name);
  };

  return (
    <>
      <Seo
        title="Use LinguaScript in ChatGPT and Claude"
        description="Connect your LinguaScript flashcards to ChatGPT or Claude in under a minute. The AI teaches the most frequent words first, quizzes your due reviews and saves new words to your deck."
        path="/ai"
      />
      <MarketingLayout
        eyebrow="ChatGPT & Claude"
        heading="Your LinguaScript words, inside ChatGPT and Claude"
        intro={
          <>
            Already learning with an AI? Connect LinguaScript and it knows your words: it teaches the
            most frequent ones first, quizzes you on the ones due today, and every word you save
            lands in your flashcards — red, orange, green, the same deck as everywhere else.
          </>
        }
        cta={null}
      >
        <p>Available with <strong>LinguaScript Pro</strong>. MCP is a secure connection between your LinguaScript account and your chosen AI: it uses your own words and progress, not a separate deck.</p>
        {!isPro && !loading && (
          <div className="not-prose my-6 rounded-2xl border border-primary/40 bg-primary/10 p-5 text-foreground">
            <p className="text-lg font-bold">Level up: practise with your AI every day</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The yearly pass unlocks ChatGPT and Claude practice with your own words, plus unlimited
              languages, flashcards and reviews.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="font-bold">
                <Link
                  to="/pricing?plan=yearly"
                  onClick={() => track("cta_clicked", { where: "ai_page", cta: "yearly_pass" })}
                >
                  Get the yearly pass
                </Link>
              </Button>
              <Link to="/pricing" className="text-sm text-muted-foreground underline underline-offset-4">
                See all plans
              </Link>
            </div>
          </div>
        )}
        {!isPro && <><AIConnectionCards /><p>Already have Pro? <Link to="/auth" className="text-primary underline">Sign in</Link> to open the connection guide. Your ChatGPT or Claude account may also need an eligible plan.</p></>}
        {isPro && <>
        <div className="not-prose my-6 rounded-2xl border border-primary/40 bg-primary/10 p-5 text-foreground">
          <p className="text-lg font-bold">Already connected? Start today's lesson</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Opens your AI with the lesson already typed in. It checks your words, quizzes what's due
            and teaches you new ones at your level. No prompt writing needed.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(Object.keys(APPS) as AppKey[]).map((k) => (
              <Button key={k} asChild size="lg" variant={k === app ? "default" : "outline"} className="font-bold">
                <a
                  href={LESSON_LINKS[k]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("cta_clicked", { where: "ai_page", cta: "start_lesson", app: k })}
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> Start my lesson in {APPS[k].name}
                </a>
              </Button>
            ))}
          </div>
        </div>

        <H2>Connect in 3 steps</H2>

        <div className="not-prose rounded-2xl border border-border bg-card p-5 space-y-5 text-foreground">
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Which AI">
            {(Object.keys(APPS) as AppKey[]).map((k) => (
              <Button variant={app === k ? "secondary" : "outline"}
                key={k}
                role="tab"
                aria-selected={app === k}
                onClick={() => setApp(k)}
                className={`h-11 rounded-xl border font-semibold ${app === k ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {APPS[k].name}
              </Button>
            ))}
          </div>

          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="font-black text-primary">1</span>
              <div className="flex-1 space-y-2">
                <p className="font-semibold">Copy the link and open {a.name}</p>
                <Button size="lg" className="w-full sm:w-auto" onClick={copyAndOpen}>
                  <ExternalLink className="w-4 h-4 mr-2" /> Copy link &amp; open {a.name}
                </Button>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-black text-primary">2</span>
              <div className="flex-1">
                <p className="font-semibold">Paste it</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {a.steps.map((s) => <li key={s}>• {s}</li>)}
                </ul>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-black text-primary">3</span>
              <div className="flex-1 space-y-2">
                <p className="font-semibold">Ask it to teach you</p>
                {PROMPTS.map((p) => (
                  <div key={p} className="flex items-center gap-2 rounded-xl bg-muted/50 p-2 text-sm">
                    <span className="flex-1">“{p}”</span>
                    <CopyButton text={p} />
                  </div>
                ))}
              </div>
            </li>
          </ol>
        </div>

        <p>
          <strong>Why does Claude or ChatGPT show technical settings?</strong> That screen is part of
          their app, for any connector that isn't in their directory yet. It's safe: you always sign in
          on LinguaScript's own page with your usual account, and the AI never sees your password.
        </p>

        <H2>Or copy the link yourself</H2>
        <div className="not-prose flex items-center gap-2 rounded-xl border border-border bg-card p-3">
          <code className="flex-1 break-all text-sm text-foreground">{MCP_URL}</code>
          <CopyButton text={MCP_URL} />
        </div>
        <p>
          In Claude: Settings → Connectors → Add custom connector. In ChatGPT: Settings → Apps &amp;
          Connectors → Advanced → Developer mode, then Create. Paste the link and sign in. ChatGPT only
          offers custom connectors only on eligible plans; availability in either service depends on its current account settings.
        </p>
        <p>
          Using Claude Code? Run{" "}
          <code className="break-all text-foreground">claude mcp add --transport http linguascript {MCP_URL}</code>
        </p>
        </>}

        <H2>What the AI can do with LinguaScript</H2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>See your progress</strong> — your language, streak and how many words are red, orange and green.</li>
          <li><strong>Teach the most frequent words first</strong> — the words you'll hear most, skipping ones you already know.</li>
          <li><strong>Quiz your reviews</strong> — gold words first; right answers move them up the same ladder as your flashcards.</li>
          <li><strong>Save words</strong> — straight into your red deck, with the sentence it came from.</li>
        </ul>
        <p>
          It only sees your LinguaScript words and progress — never your password — and you can
          disconnect it any time in the AI's connector settings.
        </p>
      </MarketingLayout>
    </>
  );
}
