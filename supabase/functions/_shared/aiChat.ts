// One place for every chat-completion call. Tries the Lovable AI gateway
// first; when it is out of credits (402), rate-limited (429), down (5xx) or
// not configured, retries the same request on Google Gemini directly using
// the project's own GEMINI_API_KEY (free tier at aistudio.google.com/apikey).
// Both speak the OpenAI chat format, so callers read the Response as before.

const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export function hasAIKey(): boolean {
  return !!(Deno.env.get('LOVABLE_API_KEY') || Deno.env.get('GEMINI_API_KEY'));
}

const shouldFallBack = (status: number) => status === 402 || status === 429 || status >= 500;

export async function aiChat(payload: { model: string; [key: string]: unknown }): Promise<Response> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  let lovableRes: Response | null = null;
  if (lovableKey) {
    try {
      lovableRes = await fetch(LOVABLE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (lovableRes.ok || !geminiKey || !shouldFallBack(lovableRes.status)) return lovableRes;
      console.warn(`Lovable AI returned ${lovableRes.status} — switching to Gemini backup key`);
    } catch (e) {
      if (!geminiKey) throw e;
      console.warn('Lovable AI unreachable — switching to Gemini backup key:', (e as Error).message);
    }
  }

  if (!geminiKey) {
    return lovableRes ?? new Response(JSON.stringify({ error: 'No AI key configured' }), { status: 500 });
  }

  return fetch(GEMINI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${geminiKey}`, 'Content-Type': 'application/json' },
    // Lovable names models "google/gemini-2.5-flash"; Google wants "gemini-2.5-flash".
    body: JSON.stringify({ ...payload, model: payload.model.replace(/^google\//, '') }),
  });
}
