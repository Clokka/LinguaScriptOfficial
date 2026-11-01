/**
 * 🎬 Video Studio helpers — burn LinguaScript dual subtitles into the
 * learner's own video, all in the browser (no upload size limit: the video
 * never leaves the device; only small audio clips go to `transcribe-audio`).
 *
 * The same `drawCaption` paints the live camera preview, the editor preview
 * and the final video, so what you see is exactly what gets posted.
 */
import { supabase } from "@/integrations/supabase/client";
import { browserTranslateLines } from "@/lib/browserTranslate";
import { getLanguageLabel } from "@/lib/languages";
import { COLOUR_HEX, colourOf, tokenize, type PillarDeck } from "@/lib/pillars";

export interface CaptionLine {
  start: number;
  end: number;
  text: string;
  translation: string;
}

/** The line showing at time `t` (seconds), if any. */
export function lineAt(lines: CaptionLine[], t: number): CaptionLine | null {
  return lines.find((l) => t >= l.start && t < l.end) ?? null;
}

/** Long phrases become several shorter lines, sharing the time out by length. */
export function splitLongLines(lines: CaptionLine[], maxWords = 9): CaptionLine[] {
  const out: CaptionLine[] = [];
  for (const l of lines) {
    const words = l.text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) { out.push(l); continue; }
    const parts = Math.ceil(words.length / maxWords);
    const per = Math.ceil(words.length / parts);
    const span = l.end - l.start;
    for (let i = 0; i < parts; i++) {
      const chunk = words.slice(i * per, (i + 1) * per);
      if (!chunk.length) continue;
      out.push({
        start: l.start + (span * i * per) / words.length,
        end: l.start + (span * Math.min(words.length, (i + 1) * per)) / words.length,
        text: chunk.join(" "),
        // One translation can't be split word-for-word; keep it on the first part.
        translation: i === 0 ? l.translation : "",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawing

let logo: HTMLImageElement | null = null;
function getLogo(): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (!logo) {
    logo = new Image();
    logo.src = "/logo.svg";
  }
  return logo.complete && logo.naturalWidth ? logo : null;
}

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

interface Piece { text: string; colour: string; width: number }

function wrap(ctx: CanvasRenderingContext2D, pieces: Piece[], maxWidth: number): Piece[][] {
  const rows: Piece[][] = [[]];
  let w = 0;
  for (const p of pieces) {
    const row = rows[rows.length - 1];
    if (row.length && w + p.width > maxWidth && p.text.trim()) {
      rows.push([p]);
      w = p.width;
    } else {
      row.push(p);
      w += p.width;
    }
  }
  return rows;
}

function rowWidth(row: Piece[]): number {
  // Trailing spaces shouldn't push a centred row to the left.
  let w = row.reduce((s, p) => s + p.width, 0);
  const last = row[row.length - 1];
  if (last && !last.text.trim()) w -= last.width;
  return w;
}

/** Paints one dual-subtitle line: deck-coloured words on top, translation below. */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  line: { text: string; translation?: string } | null,
  deck: PillarDeck | null,
  opts: { showLogo?: boolean } = {},
) {
  const size = Math.round(Math.min(W, H * 0.6) * 0.062);
  const small = Math.round(size * 0.72);
  const gap = Math.round(size * 0.25);
  const maxWidth = W * 0.88;

  ctx.save();
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";

  let topRows: Piece[][] = [];
  let bottomRows: Piece[][] = [];
  if (line?.text.trim()) {
    ctx.font = `800 ${size}px ${FONT}`;
    const pieces: Piece[] = tokenize(line.text).map((p) => {
      const c = p.word ? colourOf(deck, p.text) : null;
      return { text: p.text, colour: c ? COLOUR_HEX[c] : "#FFFFFF", width: ctx.measureText(p.text).width };
    });
    topRows = wrap(ctx, pieces, maxWidth);
    if (line.translation?.trim()) {
      ctx.font = `600 ${small}px ${FONT}`;
      const tp: Piece[] = line.translation.split(/(\s+)/).filter(Boolean).map((t) => ({
        text: t, colour: "rgba(255,255,255,0.95)", width: ctx.measureText(t).width,
      }));
      bottomRows = wrap(ctx, tp, maxWidth);
    }
  }

  const lh = size * 1.22;
  const slh = small * 1.25;
  const blockH = topRows.length * lh + (bottomRows.length ? gap + bottomRows.length * slh : 0);
  // Sit above Instagram's caption / buttons area at the bottom of a Reel.
  const bottom = H * 0.8;
  let y = bottom - blockH;

  const paintRows = (rows: Piece[][], px: number, weight: number, rowH: number) => {
    ctx.font = `${weight} ${px}px ${FONT}`;
    for (const row of rows) {
      let x = (W - rowWidth(row)) / 2;
      for (const p of row) {
        if (p.text.trim()) {
          // Dark outline + soft shadow, like the player's subtitle text-shadow.
          ctx.shadowColor = "rgba(0,0,0,0.9)";
          ctx.shadowBlur = px * 0.3;
          ctx.lineWidth = px * 0.14;
          ctx.strokeStyle = "rgba(0,0,0,0.75)";
          ctx.strokeText(p.text, x, y);
          ctx.shadowBlur = 0;
          ctx.fillStyle = p.colour;
          ctx.fillText(p.text, x, y);
        }
        x += p.width;
      }
      y += rowH;
    }
  };
  paintRows(topRows, size, 800, lh);
  if (bottomRows.length) {
    y += gap;
    paintRows(bottomRows, small, 600, slh);
  }

  if (opts.showLogo) {
    const img = getLogo();
    const s = Math.round(size * 1.1);
    const x = Math.round(W * 0.05);
    const ly = Math.round(H * 0.05);
    ctx.globalAlpha = 0.9;
    if (img) ctx.drawImage(img, x, ly, s, s);
    ctx.font = `800 ${Math.round(size * 0.6)}px ${FONT}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = size * 0.2;
    ctx.textBaseline = "middle";
    ctx.fillText("LinguaScript", x + (img ? s + size * 0.25 : 0), ly + s / 2);
  }
  ctx.restore();
}

/** Draws a video frame scaled to cover the canvas (optionally mirrored, for selfie preview). */
export function drawCover(ctx: CanvasRenderingContext2D, src: HTMLVideoElement, W: number, H: number, mirror = false) {
  const vw = src.videoWidth;
  const vh = src.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.save();
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.restore();
}

/** Output size for a video: same shape, longest side at most 1920, even numbers. */
export function outputSize(vw: number, vh: number): { w: number; h: number } {
  const scale = Math.min(1, 1920 / Math.max(vw, vh));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { w: even(vw), h: even(vh) };
}

// ---------------------------------------------------------------------------
// Recording

/** MP4 when the browser can record it (Instagram prefers it), else WebM. */
export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const options = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export const extensionFor = (mime: string) => (mime.includes("mp4") ? "mp4" : "webm");

/**
 * Plays the video once (in real time) onto a canvas with the subtitles burned
 * in and records the result, keeping the original sound.
 */
export async function renderCaptionedVideo(
  src: string,
  lines: CaptionLine[],
  deck: PillarDeck | null,
  opts: { showLogo: boolean; onProgress?: (fraction: number) => void },
): Promise<Blob> {
  const video = document.createElement("video");
  video.src = src;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("This video can't be opened in the browser."));
  });

  const { w, h } = outputSize(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Route the sound into the recording (and not out of the speakers).
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(video);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);

  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mimeType = pickRecorderMime();
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 160_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  let running = true;
  const paint = () => {
    if (!running) return;
    drawCover(ctx, video, w, h);
    drawCaption(ctx, w, h, lineAt(lines, video.currentTime), deck, { showLogo: opts.showLogo });
    if (video.duration) opts.onProgress?.(Math.min(1, video.currentTime / video.duration));
    requestAnimationFrame(paint);
  };

  await audioCtx.resume();
  paint();
  recorder.start(1000);
  await video.play();
  await new Promise<void>((resolve) => { video.onended = () => resolve(); });
  running = false;
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  await audioCtx.close();
  opts.onProgress?.(1);
  return new Blob(chunks, { type: (mimeType || "video/webm").split(";")[0] });
}

// ---------------------------------------------------------------------------
// Transcribing an uploaded / recorded video

const RATE = 16000;
const CHUNK_SECONDS = 30;

/** Pulls the sound out of a video as 16 kHz mono, cut into ~30 s pieces at quiet moments. */
async function audioChunks(file: Blob): Promise<{ offset: number; samples: Float32Array }[]> {
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("I couldn't read the sound in this video 😕 Try a shorter video, or open this page in Chrome.");
  } finally {
    void ctx.close();
  }
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const node = off.createBufferSource();
  node.buffer = decoded;
  node.connect(off.destination);
  node.start();
  const mono = (await off.startRendering()).getChannelData(0);

  const out: { offset: number; samples: Float32Array }[] = [];
  const frame = RATE / 10; // 100 ms
  let start = 0;
  while (start < mono.length) {
    let end = Math.min(mono.length, start + CHUNK_SECONDS * RATE);
    if (end < mono.length) {
      // Cut in the quietest 100 ms of the last 5 seconds, so words aren't split.
      let best = end;
      let bestEnergy = Infinity;
      for (let f = end - 5 * RATE; f + frame <= end; f += frame) {
        let e = 0;
        for (let i = f; i < f + frame; i++) e += mono[i] * mono[i];
        if (e < bestEnergy) { bestEnergy = e; best = f + frame / 2; }
      }
      end = Math.round(best);
    }
    out.push({ offset: start / RATE, samples: mono.subarray(start, end) });
    start = end;
  }
  return out;
}

function wavBase64(samples: Float32Array): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Speech in the video → timed subtitle lines with translations. */
export async function transcribeVideo(
  file: Blob,
  language: string,
  nativeLanguage: string,
  onProgress?: (fraction: number) => void,
): Promise<CaptionLine[]> {
  const chunks = await audioChunks(file);
  const all: CaptionLine[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i / chunks.length);
    const { offset, samples } = chunks[i];
    const body = {
      audio: wavBase64(samples),
      language: getLanguageLabel(language),
      nativeLanguage: getLanguageLabel(nativeLanguage),
    };
    // One retry: phones on bus/train wifi drop requests a lot.
    let { data, error } = await supabase.functions.invoke("transcribe-audio", { body });
    if (error) {
      await new Promise((r) => setTimeout(r, 2000));
      ({ data, error } = await supabase.functions.invoke("transcribe-audio", { body }));
    }
    if (error) {
      let why = "";
      try { why = (await (error as { context?: Response }).context?.json())?.error || ""; } catch { /* no body */ }
      console.error("transcribe-audio failed:", why || error.message);
      throw new Error("The subtitle helper is busy — try again in a minute.");
    }
    const clipEnd = samples.length / RATE;
    for (const l of (data?.lines || []) as CaptionLine[]) {
      all.push({
        start: offset + Math.min(l.start, clipEnd),
        end: offset + Math.min(l.end, clipEnd),
        text: l.text,
        translation: l.translation || "",
      });
    }
  }
  onProgress?.(1);
  return splitLongLines(all).sort((a, b) => a.start - b.start);
}

/** Fills in any missing translations (server first, then the browser). */
export async function translateMissing(lines: CaptionLine[], from: string, to: string): Promise<CaptionLine[]> {
  const todo = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.text.trim() && !l.translation.trim());
  if (!todo.length || from === to) return lines;
  let got: string[] = [];
  try {
    const { data, error } = await supabase.functions.invoke("translate-subtitles", {
      body: {
        subtitles: todo.map(({ l }) => ({ text: l.text })),
        fromLanguage: getLanguageLabel(from),
        toLanguage: getLanguageLabel(to),
      },
    });
    if (!error) got = todo.map((_, k) => data?.translations?.[k]?.translation || "");
  } catch { /* fall back below */ }
  if (!got.some((t) => t.trim())) {
    try { got = await browserTranslateLines(todo.map(({ l }) => l.text), from, to); } catch { return lines; }
  }
  const next = lines.slice();
  todo.forEach(({ i }, k) => { next[i] = { ...next[i], translation: got[k] || "" }; });
  return next;
}
