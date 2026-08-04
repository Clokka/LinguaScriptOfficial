import "https://deno.land/x/dotenv/load.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Anthropic } from "https://esm.sh/@anthropic-ai/sdk@0.24.2";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

interface SentenceToEvaluate {
  word: string;
  text: string;
}

interface EvaluationResult {
  word: string;
  userText: string;
  score: number; // 50, 30, 15, or 0
  feedback: string;
}

async function evaluateSentences(
  sentences: SentenceToEvaluate[]
): Promise<EvaluationResult[]> {
  const prompt = `You are a language learning evaluator. Evaluate these French sentences using tiered scoring.

Scoring rules:
- 50 XP: Perfect grammar and usage (native-level)
- 30 XP: Good, only minor errors (conjugation, article, accent)
- 15 XP: Understandable meaning, but has grammar/usage errors
- 0 XP: Wrong word used or meaning is unclear

For each sentence, provide:
1. A score (50, 30, 15, or 0)
2. Constructive feedback (encouraging, not harsh)

Sentences to evaluate:
${sentences
  .map(
    (s, i) =>
      `${i + 1}. Word: "${s.word}" | Sentence: "${s.text}"`
  )
  .join("\n")}

Respond with ONLY a JSON array of objects with this structure:
[
  {
    "word": "word_from_sentence",
    "score": 50,
    "feedback": "Perfect! Native speakers..."
  }
]

Do NOT include markdown code blocks. Only the raw JSON array.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extract text from response
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse JSON
  const evaluated = JSON.parse(responseText);

  // Map back to user's original text
  return sentences.map((s, i) => ({
    word: s.word,
    userText: s.text,
    score: evaluated[i].score,
    feedback: evaluated[i].feedback,
  }));
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { sentences } = await req.json();

    if (!sentences || !Array.isArray(sentences)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: sentences array required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const results = await evaluateSentences(sentences);

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Evaluation failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
