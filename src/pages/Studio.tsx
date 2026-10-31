import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Download, Loader2, Plus, Share2, Sparkles, Square, Trash2, Upload, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { track } from "@/lib/analytics";
import { COLOUR_HEX, loadMe, loadPillarDeck, type PillarDeck } from "@/lib/pillars";
import {
  drawCaption,
  drawCover,
  extensionFor,
  lineAt,
  pickRecorderMime,
  renderCaptionedVideo,
  splitLongLines,
  transcribeVideo,
  translateMissing,
  type CaptionLine,
} from "@/lib/videoStudio";

const LANG_MAP: Record<string, string> = {
  fr: "fr-FR", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT",
  zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ar: "ar-SA", hi: "hi-IN",
  ru: "ru-RU", tr: "tr-TR", nl: "nl-NL", pl: "pl-PL", sv: "sv-SE",
  th: "th-TH", en: "en-GB",
};
const getSR = (): any =>
  typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Phase = "pick" | "camera" | "edit" | "rendering" | "done";

/**
 * 🎬 Video Studio — your own videos with LinguaScript dual subtitles.
 * Record with the camera (words colour in live as you speak) or pick a video
 * from your phone; fix the lines; then "Make my video" burns the coloured
 * subtitles + translation in, ready for Instagram. Everything happens in the
 * browser, so there's no upload size limit.
 */
export default function Studio() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { learningLanguage } = useLanguage();
  const lang = learningLanguage || "fr";

  const [deck, setDeck] = useState<PillarDeck | null>(null);
  const [native, setNative] = useState("en");
  const [phase, setPhase] = useState<Phase>("pick");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    loadPillarDeck(user.id, lang).then(setDeck);
    loadMe(user.id).then((me) => setNative(me.nativeLanguage));
  }, [user, lang]);

  const openVideo = (blob: Blob, prefilled: CaptionLine[] = []) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoBlob(blob);
    setVideoUrl(URL.createObjectURL(blob));
    setLines(prefilled);
    setResult(null);
    setError(null);
    setPhase("edit");
  };

  const autoSubtitle = async () => {
    if (!videoBlob) return;
    setError(null);
    setBusy("Listening to your video…");
    setProgress(0);
    try {
      const got = await transcribeVideo(videoBlob, lang, native, setProgress);
      if (!got.length) setError("I couldn't hear any speech in this video 🤔");
      setLines(got);
    } catch (e) {
      setError((e as Error).message || "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  };

  const makeVideo = async () => {
    if (!videoUrl) return;
    setError(null);
    setBusy("Adding the missing translations…");
    let ready = lines;
    try { ready = await translateMissing(lines, lang, native); setLines(ready); } catch { /* keep going */ }
    setBusy(null);
    setPhase("rendering");
    setProgress(0);
    try {
      const blob = await renderCaptionedVideo(videoUrl, ready, deck, { showLogo, onProgress: setProgress });
      setResult({ blob, url: URL.createObjectURL(blob) });
      setPhase("done");
      track("studio_video_made", { lines: ready.length, language: lang, seconds: Math.round(ready[ready.length - 1]?.end || 0) });
    } catch (e) {
      setError((e as Error).message || "The video couldn't be made in this browser.");
      setPhase("edit");
    }
  };

  const fileName = () => `linguascript-${Date.now()}.${extensionFor(result?.blob.type || "")}`;

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = fileName();
    a.click();
  };

  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], fileName(), { type: result.blob.type });
    try {
      await (navigator as any).share({ files: [file], title: "My LinguaScript video" });
    } catch { /* closed the share sheet */ }
  };
  const canShare = typeof navigator !== "undefined" && !!(navigator as any).canShare
    && (() => { try { return (navigator as any).canShare({ files: [new File([""], "a.mp4", { type: "video/mp4" })] }); } catch { return false; } })();

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo title="Video Studio · LinguaScript" description="Add LinguaScript dual subtitles to your own videos." path="/studio" />
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-3xl font-black">🎬 Video Studio</h1>
          <p className="text-muted-foreground">Your videos + LinguaScript coloured subtitles, ready for Instagram.</p>
        </header>

        <Legend />

        {phase === "pick" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => setPhase("camera")}
              className="rounded-3xl border border-border bg-card p-6 text-left hover:border-primary transition-colors"
            >
              <Camera className="w-8 h-8 mb-3 text-primary" />
              <div className="text-lg font-bold">Record with my camera</div>
              <p className="text-sm text-muted-foreground">Speak, and your words appear in red, orange and green as you say them.</p>
            </button>
            <label className="rounded-3xl border border-border bg-card p-6 text-left hover:border-primary transition-colors cursor-pointer">
              <Upload className="w-8 h-8 mb-3 text-primary" />
              <div className="text-lg font-bold">Use a video I already made</div>
              <p className="text-sm text-muted-foreground">Any size — it stays on your device, nothing gets uploaded.</p>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) openVideo(f); e.target.value = ""; }}
              />
            </label>
          </div>
        )}

        {phase === "camera" && (
          <CameraRecorder
            lang={lang}
            deck={deck}
            showLogo={showLogo}
            onCancel={() => setPhase("pick")}
            onDone={(blob, heard) => openVideo(blob, heard)}
          />
        )}

        {(phase === "edit" || phase === "rendering") && videoUrl && (
          <Editor
            url={videoUrl}
            lines={lines}
            setLines={setLines}
            deck={deck}
            showLogo={showLogo}
          />
        )}

        {phase === "edit" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" onClick={autoSubtitle} disabled={!!busy}>
                <Sparkles className="w-4 h-4 mr-2" />
                {lines.length ? "Make the subtitles again" : "✨ Make subtitles for me"}
              </Button>
              <Button onClick={makeVideo} disabled={!!busy || !lines.length}>
                <Video className="w-4 h-4 mr-2" /> Make my video
              </Button>
            </div>
            <label className="flex items-center justify-center gap-2 text-sm">
              <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
              Show the LinguaScript logo
            </label>
            <div className="text-center">
              <button className="text-sm text-muted-foreground underline" onClick={() => setPhase("pick")}>
                ← Pick a different video
              </button>
            </div>
          </div>
        )}

        {busy && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {busy} {progress > 0 && `${Math.round(progress * 100)}%`}
          </div>
        )}

        {phase === "rendering" && (
          <div className="space-y-2 text-center">
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Making your video… {Math.round(progress * 100)}% — keep this tab open (it takes as long as the video).
            </p>
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-4">
            <video src={result.url} controls playsInline className="w-full max-h-[70vh] rounded-2xl bg-black" />
            <div className="flex flex-wrap gap-2 justify-center">
              {canShare && (
                <Button onClick={share}><Share2 className="w-4 h-4 mr-2" /> Share to Instagram</Button>
              )}
              <Button variant={canShare ? "outline" : "default"} onClick={download}>
                <Download className="w-4 h-4 mr-2" /> Save video
              </Button>
              <Button variant="ghost" onClick={() => setPhase("edit")}>Change the subtitles</Button>
            </div>
            {!result.blob.type.includes("mp4") && (
              <p className="text-xs text-muted-foreground text-center">
                This browser saved a .webm file. For Instagram, open this page in Chrome on your phone or Safari to get an .mp4.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </main>
    </div>
  );
}

function Legend() {
  const items: [keyof typeof COLOUR_HEX, string][] = [["red", "new"], ["orange", "learning"], ["green", "known"], ["gold", "review"]];
  return (
    <div className="flex flex-wrap justify-center gap-3 text-sm">
      {items.map(([c, label]) => (
        <span key={c} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ background: COLOUR_HEX[c] }} /> {label}
        </span>
      ))}
    </div>
  );
}

/** The video with the subtitles drawn on top, plus a list of lines to fix. */
function Editor({
  url, lines, setLines, deck, showLogo,
}: {
  url: string;
  lines: CaptionLine[];
  setLines: (l: CaptionLine[]) => void;
  deck: PillarDeck | null;
  showLogo: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState(9 / 16);
  const [now, setNow] = useState(0);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const optsRef = useRef({ deck, showLogo });
  optsRef.current = { deck, showLogo };

  useEffect(() => {
    let raf = 0;
    const paint = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c) {
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        drawCaption(ctx, c.width, c.height, lineAt(linesRef.current, v.currentTime), optsRef.current.deck, { showLogo: optsRef.current.showLogo });
        const t = Math.floor(v.currentTime * 4) / 4;
        setNow((prev) => (prev === t ? prev : t));
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMeta = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    setAspect(v.videoWidth / v.videoHeight);
    const scale = 1080 / Math.min(v.videoWidth, v.videoHeight);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
  };

  const update = (i: number, patch: Partial<CaptionLine>) => {
    const next = lines.slice();
    next[i] = { ...next[i], ...patch };
    setLines(next);
  };
  const addLineHere = () => {
    const t = videoRef.current?.currentTime ?? 0;
    const next = [...lines, { start: t, end: t + 2.5, text: "", translation: "" }].sort((a, b) => a.start - b.start);
    setLines(next);
  };
  const current = lineAt(lines, now);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: String(aspect), maxHeight: "70vh" }}>
        <video ref={videoRef} src={url} controls playsInline onLoadedMetadata={onMeta} className="absolute inset-0 w-full h-full" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>

      {lines.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">Tap a line to fix a word. The line playing now is highlighted.</p>
          {lines.map((l, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-3 flex gap-2 items-start ${l === current ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <button
                className="text-xs tabular-nums text-muted-foreground pt-2 w-10 shrink-0 underline"
                onClick={() => { if (videoRef.current) videoRef.current.currentTime = l.start; }}
                title="Jump here"
              >
                {fmt(l.start)}
              </button>
              <div className="flex-1 space-y-1">
                <input
                  translate="no"
                  value={l.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  className="w-full bg-transparent font-semibold outline-none border-b border-transparent focus:border-primary"
                  placeholder="What you said"
                />
                <input
                  value={l.translation}
                  onChange={(e) => update(i, { translation: e.target.value })}
                  className="w-full bg-transparent text-sm text-muted-foreground outline-none border-b border-transparent focus:border-primary"
                  placeholder="Translation (filled in for you)"
                />
              </div>
              <button className="p-2 text-muted-foreground hover:text-destructive" onClick={() => setLines(lines.filter((_, k) => k !== i))} aria-label="Delete line">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={addLineHere}><Plus className="w-4 h-4 mr-1" /> Add a line here</Button>
      </div>
    </div>
  );
}

/**
 * Camera + mic recording. While you talk, the browser's speech recognition
 * writes what you say on the preview in your deck colours; those timed lines
 * become the starting subtitles. (Some phones won't let speech recognition
 * share the mic with the camera — then "Make subtitles for me" does it after.)
 */
function CameraRecorder({
  lang, deck, showLogo, onCancel, onDone,
}: {
  lang: string;
  deck: PillarDeck | null;
  showLogo: boolean;
  onCancel: () => void;
  onDone: (blob: Blob, heard: CaptionLine[]) => void;
}) {
  const camRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const heardRef = useRef<CaptionLine[]>([]);
  const liveRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const recRef = useRef<any>(null);
  const listening = useRef(false);
  const optsRef = useRef({ deck, showLogo });
  optsRef.current = { deck, showLogo };

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [liveOff, setLiveOff] = useState(!getSR() || !LANG_MAP[lang]);

  // Open the front camera and keep painting the preview.
  useEffect(() => {
    let raf = 0;
    let stopped = false;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      .then((stream) => {
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (camRef.current) {
          camRef.current.srcObject = stream;
          void camRef.current.play();
        }
      })
      .catch(() => setCamError("I need the camera and microphone — allow them in your browser and try again."));
    if (!navigator.mediaDevices) setCamError("This browser can't use the camera.");

    const paint = () => {
      const v = camRef.current;
      const c = canvasRef.current;
      if (v && c && v.videoWidth) {
        const ctx = c.getContext("2d")!;
        drawCover(ctx, v, c.width, c.height, true);
        const live = liveRef.current;
        const fresh = live.text && performance.now() - live.at < 2500;
        drawCaption(ctx, c.width, c.height, fresh ? { text: live.text } : null, optsRef.current.deck, { showLogo: optsRef.current.showLogo });
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stopListening();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((Date.now() - startedAt.current) / 1000), 250);
    return () => window.clearInterval(id);
  }, [recording]);

  const stopListening = () => {
    listening.current = false;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    recRef.current = null;
  };

  const startListening = useCallback(() => {
    const SR = getSR();
    if (!SR || !LANG_MAP[lang]) return;
    listening.current = true;
    const open = () => {
      const rec = new SR();
      rec.lang = LANG_MAP[lang];
      // Android repeats earlier words in continuous mode — one phrase at a time there.
      rec.continuous = !/Android/i.test(navigator.userAgent);
      rec.interimResults = true;
      let saved = 0;
      let phraseStart: number | null = null;
      rec.onresult = (e: any) => {
        const t = (Date.now() - startedAt.current) / 1000;
        if (phraseStart === null) phraseStart = Math.max(0, t - 0.5);
        let latest = "";
        for (let i = 0; i < e.results.length; i++) {
          const text = String(e.results[i][0].transcript || "").trim();
          if (!text) continue;
          latest = text;
          if (e.results[i].isFinal && i >= saved) {
            heardRef.current.push({ start: phraseStart ?? Math.max(0, t - 2), end: t + 0.3, text, translation: "" });
            saved = i + 1;
            phraseStart = null;
          }
        }
        // Show the last few words of what's being said right now.
        if (latest) liveRef.current = { text: latest.split(/\s+/).slice(-10).join(" "), at: performance.now() };
      };
      rec.onerror = (e: any) => {
        if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error)) {
          listening.current = false;
          setLiveOff(true);
        }
      };
      rec.onend = () => { if (listening.current) { try { open(); } catch { setLiveOff(true); } } };
      recRef.current = rec;
      rec.start();
    };
    try { open(); } catch { setLiveOff(true); }
  }, [lang]);

  const start = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickRecorderMime();
    const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 8_000_000 });
    chunksRef.current = [];
    heardRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: (mimeType || "video/webm").split(";")[0] });
      onDone(blob, splitLongLines(heardRef.current));
    };
    recorderRef.current = rec;
    startedAt.current = Date.now();
    setSeconds(0);
    rec.start(1000);
    setRecording(true);
    if (!liveOff) startListening();
  };

  const stop = () => {
    stopListening();
    setRecording(false);
    recorderRef.current?.stop();
  };

  return (
    <div className="space-y-4">
      <video ref={camRef} muted playsInline className="hidden" />
      <div className="relative mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "9 / 16", maxHeight: "70vh" }}>
        <canvas ref={canvasRef} width={1080} height={1920} className="absolute inset-0 w-full h-full" />
        {recording && (
          <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-white text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> {fmt(seconds)}
          </div>
        )}
      </div>
      {camError && <p className="text-sm text-destructive text-center">{camError}</p>}
      {liveOff && (
        <p className="text-xs text-muted-foreground text-center">
          Live words don't work in this browser — no problem! After recording, tap “Make subtitles for me”.
        </p>
      )}
      <div className="flex justify-center gap-3">
        {recording ? (
          <Button size="lg" variant="destructive" className="rounded-full w-16 h-16 p-0" onClick={stop} aria-label="Stop recording">
            <Square className="w-6 h-6" />
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onCancel}>Back</Button>
            <Button size="lg" className="rounded-full w-16 h-16 p-0 bg-red-500 hover:bg-red-600" onClick={start} disabled={!!camError} aria-label="Start recording">
              <span className="w-6 h-6 rounded-full bg-white" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
