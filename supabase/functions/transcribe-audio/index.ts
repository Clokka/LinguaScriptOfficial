// 🎬 Video Studio: turns a short piece of audio (16 kHz mono WAV, ~30 s,
// cut from the learner's own video in the browser) into timed subtitle lines
// with a translation each. The video itself never leaves the device — only
// this small audio clip does.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, hasAIKey } from "../_shared/aiChat.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { audio, language, languages, nativeLanguage } = await req.json();
    if (!audio || typeof audio !== 'string') return json({ error: 'audio (base64 wav) required' }, 400);
    // ~45 s of 16 kHz mono WAV is ~1.9 MB; anything far bigger is a mistake.
    if (audio.length > 6_000_000) return json({ error: 'audio clip too long' }, 413);
    if (!hasAIKey()) return json({ error: 'No AI key configured' }, 500);

    // The learner can speak more than one language in the same video (e.g.
    // English + Thai). Old clients send only `language`.
    const spoken: string[] = (Array.isArray(languages) && languages.length ? languages : [language || 'French'])
      .map((l: unknown) => String(l || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    const anyLanguage = spoken.some((l) => /^any/i.test(l));
    const named = spoken.filter((l) => !/^any/i.test(l));
    const to = nativeLanguage || 'English';

    const who = anyLanguage
      ? `The speaker may use ANY language, and may switch languages mid-sentence${named.length ? ` (most likely ${named.join(' and ')})` : ''}. Work out the language of every word from the sound.`
      : named.length > 1
        ? `The speaker mixes ${named.join(' and ')}, sometimes in the same sentence. Work out the language of every word from the sound.`
        : `The speaker is mostly speaking ${named[0]}, but may say some words in another language.`;

    const prompt = `Transcribe the speech in this audio clip exactly as it is spoken. ${who}
Write every word in the language it is actually spoken in, using that language's OWN writing system: Thai in Thai script (e.g. ยินดีที่ได้รู้จัก, never "yindi tee dai roo jak"), Japanese in Japanese, Chinese in Chinese characters, Russian in Cyrillic, Arabic in Arabic script, Hindi in Devanagari. Never romanise and never translate inside "text".
Split it into short subtitle lines (at most about 8 words or 3 seconds each), in order.
For each line give:
- "start" and "end": seconds from the start of THIS clip (decimals allowed)
- "text": the words spoken
- "translation": a natural ${to} translation of the whole line (parts already in ${to} stay as they are)
Reply with JSON only, like {"lines":[{"start":0.4,"end":2.1,"text":"...","translation":"..."}]}.
If nobody speaks, reply {"lines":[]}.`;

    const res = await aiChat({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'input_audio', input_audio: { data: audio, format: 'wav' } },
          ],
        },
      ],
      temperature: 0.1,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('transcribe-audio AI error:', res.status, err);
      return json({ error: `Transcription failed (${res.status})` }, 502);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    let lines: unknown[] = [];
    try {
      lines = match ? (JSON.parse(match[0]).lines ?? []) : [];
    } catch {
      console.error('transcribe-audio: could not parse', content.slice(0, 300));
    }

    const clean = (lines as any[])
      .map((l) => ({
        start: Math.max(0, Number(l?.start) || 0),
        end: Math.max(0, Number(l?.end) || 0),
        text: String(l?.text || '').trim(),
        translation: String(l?.translation || '').trim(),
      }))
      .filter((l) => l.text)
      .map((l) => ({ ...l, end: l.end > l.start ? l.end : l.start + 2 }));

    return json({ lines: clean });
  } catch (error) {
    console.error('transcribe-audio error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
