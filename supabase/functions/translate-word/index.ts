import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const prompt = `Translate the ${from} word "${word}" to ${to}.
${context ? `Context sentence: "${context}"` : ''}

Return ONLY valid JSON with these exact fields:
{
  "translation": "the ${to} translation",
  "pronunciation": "approximate pronunciation guide for English speakers",
  "ipa": "IPA phonetic transcription",
  "contextTranslation": "${context ? `translate the full context sentence "${context}" to ${to}` : ''}"
}

No markdown, no explanation, just the JSON object.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: `You are a language translation API. Return only valid JSON. No markdown.` },
          { role: 'user', content: prompt },
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
    
    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
