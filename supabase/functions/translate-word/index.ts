import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callAI(apiKey: string, system: string, user: string) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error('AI API error:', response.status, err);
    throw new Error(`Translation API failed: ${response.status}`);
  }
  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '{}';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(content);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { word, context, fromLanguage, toLanguage } = await req.json();
    if (!word) {
      return new Response(JSON.stringify({ error: 'word is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const from = fromLanguage || 'French';
    const to = toLanguage || 'English';

    const system = `You are a strict bilingual dictionary API. You ALWAYS return the ${to} meaning of a ${from} word. Never echo the source word back as the translation unless it is a proper noun (person, place, brand). Return only valid JSON — no markdown, no commentary.`;

    const userPrompt = `Translate the ${from} word "${word}" into ${to}.
${context ? `It appears in this sentence: "${context}"` : ''}

Return ONLY valid JSON with these exact fields:
{
  "translation": "the ${to} word/phrase that means \\"${word}\\" — never the ${from} word itself",
  "pronunciation": "approximate pronunciation guide for ${to} speakers",
  "ipa": "IPA phonetic transcription of the ${from} word",
  "contextTranslation": "${context ? `the full sentence translated into ${to}` : ''}"
}`;

    let result = await callAI(apiKey, system, userPrompt);

    // Retry once if the AI echoed the source word
    if (
      result.translation &&
      typeof result.translation === 'string' &&
      result.translation.trim().toLowerCase() === String(word).trim().toLowerCase()
    ) {
      console.warn('AI echoed source word, retrying with stricter prompt');
      result = await callAI(
        apiKey,
        system,
        `Give ONLY the ${to} meaning of the ${from} word "${word}". The "translation" field MUST be a ${to} word, never "${word}". ${context ? `Sentence: "${context}".` : ''} Return the same JSON schema as before.`
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
