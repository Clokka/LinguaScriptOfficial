import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface GenerateRequest {
  word: string;
  translation: string;
  interests: string[];
  cefLevel: string;
  language: string;
  wordState: "red" | "orange" | "green";
  nativeLanguage: string;
  /** Optional sentence structure the generated sentence must follow. */
  pattern?: {
    template: string;
    explanation?: string | null;
    example?: string | null;
  } | null;
}

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
      pattern,
    } = body;

    if (!word || !translation || !language) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const NAMES: Record<string, string> = { en: "English", hi: "Hindi", fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic", ru: "Russian", th: "Thai" };
    const nativeName = NAMES[(nativeLanguage || "en").toLowerCase()] || nativeLanguage || "English";
    const targetName = NAMES[language.toLowerCase()] || language;
    const interestsList = (interests || []).join(", ") || "general topics";
    // The structure is a hard constraint, not a hint: the point of pairing a
    // frequent word with a graded pattern is that the learner meets the same
    // sentence shape repeatedly until it is automatic.
    const patternBlock = pattern?.template
      ? `
Sentence structure to follow EXACTLY (fill the blanks, keep the fixed words): ${pattern.template}
${pattern.explanation ? `Structure is used to: ${pattern.explanation}` : ""}
${pattern.example ? `Example of this structure: ${pattern.example}` : ""}
`
      : "";

    const userPrompt = `Generate a contextual sentence in ${targetName} for a learner whose first language is ${nativeName}.

Word: "${word}" (means: "${translation}")
User interests: ${interestsList}
CEFR Level: ${cefLevel}
Word state: ${wordState} (${wordState === "green" ? "review" : wordState === "orange" ? "reinforcement" : "new"})
${patternBlock}
Create one natural, self-contained sentence using "${word}" exactly as written.
Rules: 5-10 words; vocabulary a ${cefLevel} learner already knows apart from "${word}"; no character or person names; no fragments; the sentence must make the meaning of "${word}" guessable from context. If "${word}" belongs to a fixed pair or chunk (e.g. French "ne ... pas", "il y a"), use the full chunk.
Return ONLY valid JSON:
{
  "sentence": "sentence in ${targetName}",
  "nativeTranslation": "natural ${nativeName} translation of the sentence"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("API error:", response.status, err);
      throw new Error(`API failed: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(content);
    parsed.englishTranslation = parsed.nativeTranslation; // backwards compat
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
