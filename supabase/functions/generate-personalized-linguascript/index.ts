import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GenerateRequest {
  word: string;
  translation: string;
  interests: string[];
  cefLevel: string;
  language: string;
  wordState: "red" | "orange" | "green";
  nativeLanguage: string;
}

const systemPrompt = `You are a language learning expert creating engaging, personalized LinguaScript sentences.

Your task is to generate a contextual sentence in the target language that:
1. Incorporates the given word naturally
2. Is relevant to the user's interests
3. Matches their CEFR level (challenging but not impossible)
4. Is suitable for spaced repetition practice

Return ONLY valid JSON with these exact fields:
{
  "sentence": "sentence in target language with the word",
  "englishTranslation": "English translation of the sentence"
}

Do not include markdown, explanations, or any text outside the JSON object.`;

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: GenerateRequest = await req.json();
    const {
      word,
      translation,
      interests,
      cefLevel,
      language,
      wordState,
      nativeLanguage,
    } = body;

    // Validate required fields
    if (!word || !translation || !language) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const interestsList = (interests || []).join(", ") || "general topics";
    const levelChallenge = wordState === "green" ? "easy and confidence-building" : "challenging and encouraging deeper understanding";

    const userPrompt = `Generate a contextual sentence in ${language} for language learners.

Word: "${word}" (means: "${translation}")
User interests: ${interestsList}
CEFR Level: ${cefLevel}
Sentence difficulty: ${levelChallenge}
User's native language: ${nativeLanguage}
Word state in SRS: ${wordState} (${wordState === "green" ? "already known, for review" : wordState === "orange" ? "learning, for reinforcement" : "new, for acquisition"})

Create a natural, interesting sentence that incorporates "${word}". The sentence should:
- Be suitable for a ${cefLevel} learner
- Reference one of their interests if possible: ${interestsList}
- Feel natural and use the word in context
- ${wordState === "green" ? "Build confidence by using the word they already know" : "Help them learn or reinforce the word"}

Remember: Return ONLY valid JSON, no other text.`;

    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      throw new Error("CLAUDE_API_KEY not configured");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
