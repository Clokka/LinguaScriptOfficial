// Pillar 2 — WRITING. One function, two jobs:
//
//   mode "compose": pair 1–2 RED words (just saved) with GREEN words (known /
//     high-frequency) inside the learner's hobby, and return
//       • prompt      — a short question in the learner's own language that
//                       makes them want to write (the "incentive")
//       • linguascript — a model, high-leverage sentence using the red words
//       • translation — that sentence in the learner's own language
//
//   mode "check": mark what the learner wrote, return a score (0/15/30/50),
//     one line of feedback, and the corrected sentence — their LinguaScript.
//
// The sentence a learner writes with their own new words, about their own
// life, is a LinguaScript.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, hasAIKey } from "../_shared/aiChat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function langName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
}

interface WordIn { word: string; translation?: string | null }

async function ask(prompt: string, temperature: number) {
  const res = await aiChat({
    model: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: prompt }],
    temperature,
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = String(data.choices?.[0]?.message?.content || "{}").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!hasAIKey()) return json({ error: "No AI key configured" }, 500);

  try {
    const body = await req.json();
    const language = String(body.language || "").toLowerCase();
    const native = String(body.nativeLanguage || "en").toLowerCase();
    const red: WordIn[] = (body.redWords || []).slice(0, 2);
    const green: WordIn[] = (body.greenWords || []).slice(0, 30);
    const interest = String(body.interest || "everyday life").slice(0, 60);
    const about = String(body.about || "").slice(0, 120);
    const level = String(body.level || "A2").slice(0, 4);
    if (!language || red.length === 0) return json({ error: "language and redWords are required" }, 400);

    const L = langName(language);
    const N = langName(native);
    const redList = red.map((w) => `"${w.word}"${w.translation ? ` (= ${w.translation})` : ""}`).join(", ");
    const greenList = green.map((w) => w.word).join(", ");

    if (body.mode === "check") {
      const text = String(body.text || "").slice(0, 600);
      if (!text.trim()) return json({ error: "text is required" }, 400);
      const out = await ask(
        `You mark a ${L} learner's writing. Their first language is ${N}. Level: ${level}.
They were asked to write about: ${interest}${about ? ` (${about})` : ""}.
They had to use these NEW words: ${redList}.
What they wrote (judge it ONLY as ${L}, never translate it into another language):
"""${text}"""

Score:
- 50: correct and natural, uses the new word(s) correctly
- 30: good, small slips (agreement, accent, article)
- 15: understandable but with real grammar/usage errors
- 0: new word missing or misused, or meaning unclear

Return ONLY JSON:
{
  "score": 50,
  "usedWords": ["each NEW word they used correctly, exactly as listed"],
  "feedback": "ONE short, warm sentence in ${N}. Quote ${L} words when correcting.",
  "corrected": "their sentence, corrected and natural in ${L} (keep their idea and their new words)",
  "translation": "the corrected sentence in ${N}"
}`,
        0.2,
      );
      return json({
        score: [0, 15, 30, 50].includes(Number(out.score)) ? Number(out.score) : 15,
        usedWords: Array.isArray(out.usedWords) ? out.usedWords : [],
        feedback: String(out.feedback || ""),
        corrected: String(out.corrected || text),
        translation: String(out.translation || ""),
      });
    }

    // compose
    const out = await ask(
      `You write "LinguaScripts": short, high-leverage ${L} sentences a ${level} learner (first language ${N}) will actually say in real life.

Topic (their hobby / goal): ${interest}${about ? ` — about them: ${about}` : ""}
NEW words that MUST appear (1–2): ${redList}
Words they already know well (build the rest of the sentence mostly from these): ${greenList || "very common everyday words"}

Rules:
- One sentence, 6–14 words, natural spoken ${L}, useful again and again (a "chunk" natives really say).
- Use every NEW word exactly once (conjugate/agree only if grammar requires).
- Everything else simple and high-frequency. No names of people.
- Make it about THEM and the topic (e.g. travel → their trip${about ? ` to ${about}` : ""}).

Also write "prompt": ONE short, personal question in ${N} (max 12 words) that makes them want to write their own sentence with the new word(s) about the topic. No word lists in it.

Return ONLY JSON:
{ "prompt": "...", "linguascript": "...", "translation": "the sentence in ${N}" }`,
      0.8,
    );
    return json({
      prompt: String(out.prompt || ""),
      linguascript: String(out.linguascript || ""),
      translation: String(out.translation || ""),
    });
  } catch (e) {
    console.error("linguascript-write", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
