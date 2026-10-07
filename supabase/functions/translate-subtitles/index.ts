import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, hasAIKey } from "../_shared/aiChat.ts";
import { freeTranslateLines } from "../_shared/freeTranslate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subtitles, fromLanguage, toLanguage } = await req.json();

    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      return new Response(JSON.stringify({ error: 'subtitles array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const from = fromLanguage || 'French';
    const to = toLanguage || 'English';

    let allTranslations: string[] = [];
    try {
      if (!hasAIKey()) throw new Error('No AI key configured');
      // Batch subtitles into chunks to avoid token limits
      const BATCH_SIZE = 50;

      for (let i = 0; i < subtitles.length; i += BATCH_SIZE) {
        const batch = subtitles.slice(i, i + BATCH_SIZE);
        const numberedLines = batch.map((s: any, idx: number) => `${idx + 1}. ${s.text}`).join('\n');

        const prompt = `Translate these ${from} subtitle lines to ${to}. Return ONLY the translations, one per line, numbered exactly like the input. Keep the same numbering. Be natural and conversational, not overly literal.\n\n${numberedLines}`;

        const response = await aiChat({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: `You are a professional subtitle translator. Translate from ${from} to ${to}. Return only numbered translations matching the input format. No explanations.` },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('AI API error:', response.status, err);
          throw new Error(`Translation API failed: ${response.status}`);
        }

        const data = await response.json();
        const translationText = data.choices?.[0]?.message?.content || '';

        // Parse numbered translations
        const lines = translationText.split('\n').filter((l: string) => l.trim());
        for (const line of lines) {
          const cleaned = line.replace(/^\d+\.\s*/, '').trim();
          if (cleaned) {
            allTranslations.push(cleaned);
          }
        }
      }

    } catch (aiError) {
      // AI gateway out of credits (402), rate-limited (429) or down — use the
      // free translator so the second subtitle line still appears.
      console.warn('AI subtitle translation unavailable, using free fallback:', (aiError as Error).message);
      allTranslations = await freeTranslateLines(subtitles.map((s: any) => String(s.text || '')), from, to);
    }

    // Map translations back to subtitles
    const translated = subtitles.map((s: any, i: number) => ({
      ...s,
      translation: allTranslations[i] || '',
    }));

    return new Response(JSON.stringify({ translations: translated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
