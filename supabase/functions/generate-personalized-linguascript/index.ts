import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface GenerateRequest {
  word: string;
  translation: string;
  interests: string[];
  cefLevel: string;
  language: string;
  wordState: "red" | "orange" | "green";
  nativeLanguage: string;
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

    const interestsList = (interests || []).join(", ") || "general topics";
    const userPrompt = `Generate a contextual sentence in ${language} for language learners.

Word: "${word}" (means: "${translation}")
User interests: ${interestsList}
CEFR Level: ${cefLevel}
Word state: ${wordState} (${wordState === "green" ? "review" : wordState === "orange" ? "reinforcement" : "new"})

Create one natural sentence using "${word}". Return ONLY valid JSON:
{
  "sentence": "sentence in ${language}",
  "englishTranslation": "English translation"
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
