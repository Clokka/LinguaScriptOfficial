// 📷 Scan a page — photo of a book/magazine page → the words the reader MARKED.
//
//   circled / boxed / underlined in pen  → red deck (new word)
//   highlighter: red or pink             → red
//                orange or yellow        → orange (learning)
//                green                   → green (known — comes back gold in 5 min)
//
// Body: { image: "data:image/jpeg;base64,…", language?: "fr", nativeLanguage?: "en" }
// Returns: { language, words: [{ word, lemma, translation, context, mark, colour, deck }] }
// Nothing is saved here: the app shows the list first so the learner can
// untick a misread word, then saves (same saved_words row as every other save).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, hasAIKey } from "../_shared/aiChat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function langName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
}

type Deck = "red" | "orange" | "green";
const MARKS = ["circle", "underline", "highlight"] as const;

/** Highlighter colour → deck. Pen marks (circle/underline) are always red. */
function deckFor(mark: string, colour: string): Deck {
  if (mark !== "highlight") return "red";
  const c = colour.toLowerCase();
  if (/green|lime|mint/.test(c)) return "green";
  if (/orange|yellow|amber/.test(c)) return "orange";
  return "red";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!hasAIKey()) return json({ error: "No AI key configured" }, 500);

  try {
    const body = await req.json();
    const image = String(body.image || "");
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return json({ error: "image must be a jpeg/png/webp data URL" }, 400);
    if (image.length > 8_000_000) return json({ error: "Photo too large — resize to about 1600px first" }, 413);
    const language = String(body.language || "").toLowerCase().slice(0, 8);
    const native = String(body.nativeLanguage || "en").toLowerCase().slice(0, 8);
    const L = language ? langName(language) : "the language printed on the page";
    const N = langName(native);

    const prompt = `This is a photo of a printed page (a book, magazine or worksheet) in ${L}.
A language learner MARKED some words or phrases by hand. Find ONLY the marked ones:
- "circle": a pen/pencil loop, oval or box drawn around the word (even if the loop is messy or slightly misses the word)
- "underline": a pen line drawn under the word
- "highlight": coloured highlighter ink over the word — say its colour (red, pink, orange, yellow, green, blue…)
Ignore every unmarked word, printed headers, page numbers and printed underlining/italics.

For each mark return the text EXACTLY as printed inside the mark:
- keep articles/particles only if they are inside the mark ("une prolepse" stays "une prolepse")
- join words hyphenated across a line break ("dé-ployer" → "déployer")
- if one loop covers a whole phrase or clause, return that phrase as one item
- read carefully: pen ink can cover letters, use the sentence to read the word correctly
Also give:
- lemma: the dictionary form in ${L} (infinitive for verbs, masculine singular for adjectives); for a phrase, the phrase itself
- translation: short meaning in ${N}, as used in this sentence
- context: the printed sentence it sits in, max 20 words, unchanged
Return JSON only:
{"language":"<ISO 639-1 code of the page>","words":[{"word":"…","lemma":"…","translation":"…","context":"…","mark":"circle|underline|highlight","colour":"<ink colour, for highlight>"}]}
If nothing is marked, return {"language":"…","words":[]}. List them in reading order.`;

    const res = await aiChat({
      model: "google/gemini-2.5-flash",
      temperature: 0.1,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } },
        ],
      }],
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error("scan-page AI error", res.status, detail);
      return json({ error: `Couldn't read the photo (AI ${res.status})` }, 502);
    }
    const data = await res.json();
    const raw = String(data.choices?.[0]?.message?.content || "{}").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const out = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);

    const seen = new Set<string>();
    const words = (Array.isArray(out.words) ? out.words : [])
      .map((w: any) => {
        const mark = MARKS.includes(w?.mark) ? w.mark : "circle";
        const colour = String(w?.colour || w?.color || "").slice(0, 20);
        return {
          word: String(w?.word || "").replace(/\s+/g, " ").trim().slice(0, 120),
          lemma: String(w?.lemma || "").trim().slice(0, 120),
          translation: String(w?.translation || "").trim().slice(0, 200),
          context: String(w?.context || "").trim().slice(0, 300),
          mark,
          colour,
          deck: deckFor(mark, colour),
        };
      })
      .filter((w: { word: string }) => {
        const k = w.word.toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 60);

    return json({ language: String(out.language || language || "").toLowerCase().slice(0, 8), words });
  } catch (e) {
    console.error("scan-page", e);
    return json({ error: (e as Error).message || "Scan failed" }, 500);
  }
});
