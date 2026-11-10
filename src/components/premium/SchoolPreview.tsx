import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CountUp } from "@/components/premium";
import { PronunciationJudge } from "@/components/PronunciationJudge";
import { PlatformLinks } from "./BrandExperience";

const WORDS = [
  { word: "On", meaning: "We / one", tone: "text-primary" },
  { word: "se", meaning: "Reflexive pronoun", tone: "text-primary" },
  { word: "retrouve", meaning: "meet up", tone: "text-accent" },
  { word: "à", meaning: "at", tone: "text-primary" },
  { word: "la", meaning: "the", tone: "text-primary" },
  { word: "gare", meaning: "station", tone: "text-destructive" },
  { word: "demain", meaning: "tomorrow", tone: "text-warning" },
];
export function Waveform({ moving = false }: { moving?: boolean }) {
  return <div className={`ls-waveform ${moving ? "ls-waveform-moving" : ""}`} aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <span key={i} />)}</div>;
}

export function CaptionPreview() {
  const [selected, setSelected] = useState(5);
  const [saved, setSaved] = useState(false);
  return <div className="space-y-4">
    <div className="ls-scene" role="img" aria-label="Illustrated train station with a French subtitle">
      <svg viewBox="0 0 800 380" className="ls-station-art" aria-hidden="true"><path d="M0 265H800M60 265V150Q200 30 350 140V265M450 265V140Q620 30 760 150V265M350 140H450M400 140V265" /><path d="M0 290H800M0 320H800" /><rect x="315" y="175" width="170" height="50" rx="3" /><text x="400" y="208" textAnchor="middle">GARE</text><circle cx="550" cy="205" r="12" /><path d="M550 218V262M550 235L533 255M550 235L567 255" /></svg>
      <div className="ls-scene-captions"><p className="flex flex-wrap justify-center gap-1" translate="no">{WORDS.map((w, i) => <Button variant="ghost" key={w.word} onClick={() => { setSelected(i); setSaved(false); }} className={`h-auto px-1 py-1 text-lg font-bold sm:text-2xl ${w.tone}`} aria-label={`Translate ${w.word}`}>{w.word}</Button>)}</p><p className="mt-2 text-center text-sm text-muted-foreground" translate="no">We'll meet at the station tomorrow.</p></div>
    </div>
    <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-5" accent="green"><div><p className={`text-2xl font-bold ${WORDS[selected].tone}`} translate="no">{WORDS[selected].word}</p><p className="mt-1 text-muted-foreground" translate="no">{WORDS[selected].meaning}</p></div><Button onClick={() => setSaved(true)} disabled={saved}><BookOpen className="mr-2 h-4 w-4" />{saved ? "Saved in this preview" : "Save word in preview"}</Button></GlassCard>
    {saved && <p role="status" className="text-sm text-primary">Preview word saved. Your own vocabulary lives in your account.</p>}
  </div>;
}

export function PronunciationPreview() {
  const [speaking, setSpeaking] = useState(false);
  const [audioError, setAudioError] = useState("");
  const listen = () => {
    if (!("speechSynthesis" in window)) { setAudioError("Audio playback is unavailable in this browser."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("On se retrouve à la gare demain.");
    utterance.lang = "fr-FR";
    utterance.rate = .85;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("fr"));
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setAudioError("Audio couldn't play. Try again or use a browser with a French voice."); };
    setAudioError(""); setSpeaking(true); window.speechSynthesis.speak(utterance);
  };
  const recognitionSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  return <GlassCard className="p-6 sm:p-10" accent="green"><p className="text-xs font-semibold text-warning">FRENCH · PHRASE PRACTICE</p><p className="mt-6 text-2xl font-bold text-primary sm:text-3xl" translate="no">On se retrouve à la gare demain.</p><p className="mt-3 text-muted-foreground" translate="no">We'll meet at the station tomorrow.</p><div className="my-8"><Waveform moving={speaking} /></div><div className="flex flex-wrap items-center gap-4"><Button onClick={listen} disabled={speaking}><Volume2 className="mr-2 h-4 w-4" />{speaking ? "Playing…" : "Listen to French"}</Button>{recognitionSupported && <PronunciationJudge text="On se retrouve à la gare demain." language="fr" awardProgress={false} />}</div>{audioError && <p role="alert" className="mt-4 text-sm text-destructive">{audioError}</p>}<p className="mt-5 text-xs text-muted-foreground">{recognitionSupported ? "Microphone permission is requested only when you choose to speak. Feedback compares recognised words, not a clinical pronunciation assessment." : "Speaking recognition isn't available in this browser. You can still listen and practise aloud."}</p></GlassCard>;
}

export function DashboardPreview({ teacher = false }: { teacher?: boolean }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const values = period === "week" ? [12, 18, 22, 16, 30, 24, 36] : [32, 46, 54, 70, 84, 92, 110];
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-warning">ILLUSTRATIVE DATA · NOT REAL STUDENTS</p><h2 className="mt-2 text-xl font-bold">{teacher ? "French class overview" : "Your language, turning green"}</h2></div><div className="flex gap-1" aria-label="Preview period"><Button size="sm" variant={period === "week" ? "secondary" : "ghost"} onClick={() => setPeriod("week")}>Week</Button><Button size="sm" variant={period === "month" ? "secondary" : "ghost"} onClick={() => setPeriod("month")}>Month</Button></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(teacher ? [["Students", 24, "text-primary"], ["Video tasks", period === "week" ? 3 : 11, "text-primary"], ["Tasks started", period === "week" ? 66 : 241, "text-accent"], ["Tasks finished", period === "week" ? 58 : 220, "text-warning"]] : [["New words", 36, "text-destructive"], ["Learning", 405, "text-accent"], ["Known", 1236, "text-primary"], ["Due for review", 12, "text-warning"]]).map(([label, value, tone]) => <GlassCard key={String(label)} className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-3 text-3xl font-bold ${tone}`}><CountUp value={Number(value)} /></p></GlassCard>)}</div><div className="grid gap-6 md:grid-cols-2"><div className="border-t border-border pt-5"><h3 className="text-sm font-semibold">Words learned · {period === "week" ? "daily" : "weekly"}</h3><div className="ls-school-bars" aria-label={`Illustrative words learned: ${values.join(", ")}`}>{values.map((value, i) => <div key={`${period}-${i}`}><span style={{ height: `${value / Math.max(...values) * 100}%` }} title={`${value} words`} /><small>{period === "week" ? ["M", "T", "W", "T", "F", "S", "S"][i] : `W${i + 1}`}</small></div>)}</div></div><div className="border-t border-border pt-5"><h3 className="mb-3 text-sm font-semibold">{teacher ? "Recent class activity" : "Recent learning"}</h3>{(teacher ? ["Finished task: café scene", "Rewatched task: café scene · 72% green", "Started task: at the market", "Finished task: at the market"] : ["Watched a film scene", "Saved new vocabulary", "Reviewed flashcards", "Practised a French phrase"]).map((text, i) => <div key={text} className="flex items-center gap-3 border-b border-border py-3 text-sm"><span className="ls-activity-dot" /><span>{teacher ? `Student ${String.fromCharCode(65 + i)} · ` : ""}{text}</span></div>)}</div></div><Button asChild variant="outline"><Link to={teacher ? "/teacher" : "/progress"}>{teacher ? "Open your teacher dashboard" : "See your own progress"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>;
}

export function VocabularyPreview() {
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const cards = [WORDS[5], WORDS[2], WORDS[6]];
  const card = cards[index];
  return <div className="space-y-6"><div className="flex flex-wrap gap-4 text-sm"><span className="text-destructive">New</span><span className="text-accent">Learning</span><span className="text-primary">Known</span><span className="text-warning">Due for review</span></div><GlassCard className="flex min-h-72 flex-col items-center justify-center gap-5 p-8 text-center" accent="green"><p className="text-xs text-muted-foreground">FRENCH · PREVIEW CARD {index + 1}/3</p><h2 className={`text-5xl font-bold ${card.tone}`} translate="no">{card.word}</h2>{revealed ? <p className="text-2xl" translate="no">{card.meaning}</p> : <Button variant="outline" onClick={() => setRevealed(true)}>Show meaning</Button>}{revealed && <Button onClick={() => { setIndex((index + 1) % cards.length); setRevealed(false); }}>Next card<ArrowRight className="ml-2 h-4 w-4" /></Button>}</GlassCard><p className="text-sm text-muted-foreground">This preview doesn't change your decks or award learning progress.</p><Button asChild><Link to="/flashcards">Open your flashcards<BookOpen className="ml-2 h-4 w-4" /></Link></Button></div>;
}

export function WatchPlatformsPreview() {
  return <div className="space-y-6"><CaptionPreview /><PlatformLinks /><p className="text-xs text-muted-foreground">External streaming uses the Chrome extension. Support varies by title and player. Streaming subscriptions are separate.</p><Button asChild><Link to="/discover"><Play className="mr-2 h-4 w-4" />Watch your own video</Link></Button></div>;
}