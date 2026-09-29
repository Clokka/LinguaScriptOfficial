// Generates the LaunchReel's narration with ElevenLabs' text-to-speech API
// and writes one mp3 per scene into public/audio/launch-reel/, where
// src/remotion/LaunchReel.tsx's <NarrationTrack> already expects them
// (via Remotion's staticFile()) — nothing else needs to change once these
// files exist.
//
// Usage:
//   ELEVENLABS_API_KEY=... [ELEVENLABS_VOICE_ID=...] npm run voiceover
//
// Voice defaults to "Rachel" (21m00Tcm4TlvDq8ikWAM), a standard ElevenLabs
// pre-made voice — pass ELEVENLABS_VOICE_ID to use a different one.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { VO_LINES } from "../src/remotion/LaunchReel";

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const OUT_DIR = path.join(process.cwd(), "public", "audio", "launch-reel");

async function synthesize(text: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": API_KEY!,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.8 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body}`);
  }
  return res.arrayBuffer();
}

async function main() {
  if (!API_KEY) {
    console.error("Set ELEVENLABS_API_KEY before running `npm run voiceover`.");
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  for (const line of VO_LINES) {
    process.stdout.write(`Generating ${line.id}... `);
    const audio = await synthesize(line.text);
    const outPath = path.join(OUT_DIR, `${line.id}.mp3`);
    await writeFile(outPath, Buffer.from(audio));
    console.log(`done (${outPath})`);
  }
  console.log(`\nAll ${VO_LINES.length} narration clips written to ${OUT_DIR}`);
  console.log("They'll be picked up automatically by LaunchReel's <NarrationTrack>.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
