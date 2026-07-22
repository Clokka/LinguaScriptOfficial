import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('AI API error:', response.status, err);
    throw new Error(`Generation API failed: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '{}';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(content);
}

interface GenerateRequest {
  targetWord: string;
  language: string;
  interests: string[];
}

interface GeneratedContent {
  sentence: string;
  translation: string;
  interest: string;
  gapPosition: number;
  gapOptions: {
    correct: string;
    distractors: string[];
  };
  mcqOptions: {
    correct: number;
    options: string[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetWord, language, interests } = await req.json() as GenerateRequest;

    if (!targetWord || !language) {
      return new Response(JSON.stringify({ error: 'targetWord and language are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get language name for prompts
    const langMap: Record<string, string> = {
      'fr': 'French',
      'es': 'Spanish',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'en': 'English',
    };
    const langName = langMap[language] || language;

    // Select a random interest or use first available
    const interest = interests && interests.length > 0
      ? interests[Math.floor(Math.random() * interests.length)]
      : 'daily conversation';

    const system = `You are a world-class language teacher creating engaging, contextual sentences for vocabulary learning.
Your sentences should:
- Be natural and useful (real-world usage)
- Relate to the learner's interests when possible
- Use the target word in a clear, memorable way
- Include one blank (_____) for the target word position
- Have 6-12 words total

You MUST return valid JSON with exactly these fields:
{
  "sentence": "complete sentence with _____ for the blank",
  "translation": "English translation of the full sentence",
  "gapPosition": 0,
  "gapOptions": {
    "correct": "the correct word to fill the blank",
    "distractors": ["wrong answer 1", "wrong answer 2", "wrong answer 3"]
  },
  "mcqOptions": {
    "correct": 0,
    "options": ["English translation of correct word", "translation of distractor 1", "translation of distractor 2", "translation of distractor 3"]
  }
}

The distractors should:
- Be real words from the same word class
- Have similar length/complexity to the correct answer
- NOT be obviously wrong

The MCQ options should be the English translations in a randomized order (with correct at position indicated by "correct" field).`;

    const userPrompt = `Create a ${langName} learning sentence for the word: "${targetWord}"
Interest/context: ${interest}

Requirements:
- The sentence must contain the word "${targetWord}" as content
- Replace that word with a single blank (_____) in the sentence
- Make it interesting and related to "${interest}"
- Provide 3 good distractor words (wrong answers)
- Provide English translations for MCQ (correct answer at index indicated)

Return ONLY valid JSON in the exact schema specified.`;

    const result = await callAI(apiKey, system, userPrompt) as GeneratedContent;

    // Validate required fields
    if (!result.sentence || !result.translation || result.gapOptions?.distractors?.length !== 3) {
      throw new Error('Invalid AI response format');
    }

    return new Response(JSON.stringify({
      ...result,
      interest,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generation error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
