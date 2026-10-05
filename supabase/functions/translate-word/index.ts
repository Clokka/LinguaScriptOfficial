import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callAI(apiKey: string, system: string, user: string, model = 'google/gemini-2.5-flash') {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    // A stuck gateway call must not leave the learner staring at "Translating...".
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      model,
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

// The AI gateway runs on workspace credits; when they run out (402), it is
// rate limited (429) or it times out, fall back to a cheaper model and then to
// Google's free translate endpoint so a click always gets *some* meaning.
async function callAIWithFallback(apiKey: string, system: string, user: string) {
  try {
    return await callAI(apiKey, system, user);
  } catch (e) {
    console.warn('Primary model failed, trying flash-lite:', (e as Error).message);
    return await callAI(apiKey, system, user, 'google/gemini-2.5-flash-lite');
  }
}

async function googleTranslate(text: string, from: string, to: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Google translate fallback failed: ${res.status}`);
  const data = await res.json();
  return (data?.[0] ?? []).map((seg: unknown[]) => seg?.[0] ?? '').join('').trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { word, context, fromLanguage, toLanguage, fromCode, toCode } = await req.json();
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

    // Chinese learners need Hanyu Pinyin, not IPA — it is the pronunciation
    // system the whole language is taught with.
    const isChinese = /chinese|mandarin|中文/i.test(String(from));

    const system = `You are a strict bilingual dictionary API for language learners. You ALWAYS return the ${to} meaning of a ${from} word. Never echo the source word back as the translation unless it is a proper noun (person, place, brand). Crucially: a learner who clicks a conjugated verb, a plural noun, or a declined/agreed adjective must be taught the DICTIONARY (citation/lemma) form, not the inflected surface form — that is the entire point of the "lemma" field below. Return only valid JSON — no markdown, no commentary.`;

    const userPrompt = `A language learner clicked the ${from} word "${word}"${context ? ` in this sentence: "${context}"` : ''}.

First, identify its part of speech and its dictionary (citation/lemma) form:
- Verb -> the infinitive.
- Noun -> singular (and, if the source language marks it, the citation gender/case form).
- Adjective -> the base/uninflected form (not agreed for gender/number, not comparative/superlative).
- Anything already in its dictionary form (most nouns clicked in singular, adverbs, etc.) -> lemma equals the word itself, isInflected is false.

Return ONLY valid JSON with these exact fields:
{
  "translation": "the ${to} gloss of \\"${word}\\" exactly as it appears here — never the ${from} word itself",
  "pronunciation": ${isChinese ? `"Hanyu Pinyin with tone marks for \\"${word}\\""` : `"approximate pronunciation guide for ${to} speakers"`},
  "ipa": ${isChinese ? `"Hanyu Pinyin with tone marks for \\"${word}\\" (same as pronunciation)"` : `"IPA phonetic transcription of the ${from} word"`},
  "contextTranslation": "${context ? `the full sentence translated into ${to}` : ''}",
  "lemma": "the ${from} dictionary/citation form — e.g. the infinitive for a verb, singular for a noun",
  "lemmaTranslation": "the ${to} meaning of the LEMMA on its own, the way a dictionary entry would gloss it (e.g. \\"to eat\\" for an infinitive)",
  "pos": "one of: noun, verb, adjective, adverb, pronoun, preposition, conjunction, determiner, other",
  "isInflected": true or false — true only if the clicked word differs from its lemma (a conjugated/declined/agreed form),
  "grammarNote": "if isInflected, a short label a learner would understand, e.g. \\"2nd person singular, present tense\\" or \\"plural\\" or \\"feminine plural\\" — empty string if not inflected"
}`;


    let result;
    try {
      result = await callAIWithFallback(apiKey, system, userPrompt);
    } catch (aiError) {
      console.error('All AI models failed, using Google fallback:', (aiError as Error).message);
      const translation = await googleTranslate(String(word), fromCode || 'auto', toCode || 'en');
      const contextTranslation = context && context !== word
        ? await googleTranslate(String(context), fromCode || 'auto', toCode || 'en').catch(() => '')
        : translation;
      return new Response(JSON.stringify({
        translation, contextTranslation, pronunciation: '', ipa: '',
        lemma: word, lemmaTranslation: translation, pos: 'other', isInflected: false, grammarNote: '',
        fallback: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Retry once if the AI echoed the source word
    if (
      result.translation &&
      typeof result.translation === 'string' &&
      result.translation.trim().toLowerCase() === String(word).trim().toLowerCase()
    ) {
      console.warn('AI echoed source word, retrying with stricter prompt');
      result = await callAIWithFallback(
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
