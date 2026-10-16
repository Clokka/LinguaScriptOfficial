// Server text-to-speech (speak-word edge function). Used when the device has
// no voice for a language, and in Android's WebView (the LinguaScript app),
// which has no speechSynthesis at all.
const cloudAudioCache = new Map<string, string>();

export async function speakViaCloud(text: string) {
  try {
    let url = cloudAudioCache.get(text);
    if (!url) {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speak-word`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) { console.warn("[speak] cloud voice failed", res.status); return; }
      url = URL.createObjectURL(await res.blob());
      cloudAudioCache.set(text, url);
    }
    await new Audio(url).play();
  } catch (e) {
    console.warn("[speak] cloud voice error", e);
  }
}

export const hasSpeechSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;
