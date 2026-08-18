import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { WordPopup } from "./WordPopup";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { getLanguageLabel } from "@/lib/languages";
import {
  DeckState,
  SavedWordLite,
  loadDeckIndex,
  normalizeToken,
} from "@/lib/vocab";
import { greenScoreForLine } from "@/lib/understanding";
import { ChameleonReaction, ReactionMode } from "./ChameleonReaction";
import { useXp } from "@/contexts/XpContext";
import {
  isPendingGreen,
  revealGreenWord,
  touchGoldWord,
  MAX_GOLD_PER_LINE,
  GOLD,
  type GoldCandidate,
} from "@/lib/goldenReveal";
import { playClaimChime } from "@/lib/chime";
import { GoldenDust, type DustAnchor } from "./GoldenDust";
import {
  COMBO_CAP,
  PRAISE,
  prefersReducedMotion,
  floatXpText,
  goldSweep,
  scatterClones,
} from "@/lib/lineBlast";

interface Word {
  id: string;
  text: string;
  translation: string;
  pronunciation: string;
  ipa: string;
}

interface SubtitleOverlayProps {
  primaryText: string;
  secondaryText?: string;
  words: Word[];
  className?: string;
  mode: "single" | "dual";
  onSaveWord?: (word: Word) => void;
  onSavePhrase?: (phrase: string) => void;
  onMarkKnown?: (word: Word) => void;
  nativeLanguage?: string;
  contentLanguage?: string;
}

// Canonical LinguaScript deck palette. These hexes MUST stay identical to
// DECK_CONFIG in src/pages/Flashcards.tsx and to .ls-red/.ls-orange/.ls-green
// in the Chrome extension, so a word's colour in the script is exactly its
// flashcard deck colour across every surface (website, Netflix, YouTube).
// Brand voice 🦎: red (unknown) → orange (learning) → green (known).
const DECK_COLORS: Record<DeckState, string> = {
  red: "#FF3B30",
  orange: "#FF8A00",
  green: "#34C759",
};

export const SubtitleOverlay = ({
  primaryText,
  secondaryText,
  words,
  className,
  mode,
  onSaveWord,
  onSavePhrase,
  onMarkKnown,
  nativeLanguage,
  contentLanguage,
}: SubtitleOverlayProps) => {
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [translating, setTranslating] = useState(false);
  const { languageContext } = useLanguage();
  // The deck — and every word interaction below — is scoped to the
  // language actually on screen. Prefer the explicit `contentLanguage`
  // prop from the player; only fall back to languageContext when the
  // caller hasn't tagged the content yet.
  const effectiveLang = contentLanguage || languageContext;
  const { user } = useAuth();
  const { award } = useXp();
  const [deck, setDeck] = useState<Map<string, SavedWordLite>>(new Map());

  useEffect(() => {
    let alive = true;
    loadDeckIndex(user?.id ?? null, effectiveLang).then((m) => {
      if (alive) setDeck(m);
    });
    return () => { alive = false; };
  }, [user, effectiveLang]);

  const stateForToken = (text: string): DeckState | undefined => {
    return deck.get(normalizeToken(text))?.state;
  };

  // ── Golden Reveal ────────────────────────────────────────────────────────
  // A word promoted to green renders GOLD until the learner witnesses it and
  // claims it. See src/lib/goldenReveal.ts for the state rule.

  /** Words claimed during this line, so they flip to green without a refetch. */
  const [justClaimed, setJustClaimed] = useState<Set<string>>(new Set());
  const [dustAnchors, setDustAnchors] = useState<DustAnchor[]>([]);
  const wordElsRef = useRef<Map<string, HTMLElement>>(new Map());
  /**
   * Lines already counted toward the decay threshold. Without this, every
   * React re-render would call touch_gold_word again and push a word past
   * GOLD_DECAY_APPEARANCES within a second — auto-claiming it before it was
   * ever seen.
   */
  const seenLineKeysRef = useRef<Set<string>>(new Set());

  /**
   * Which tokens on this line are gold, capped at MAX_GOLD_PER_LINE.
   *
   * The cap is what keeps gold feeling rare: a learner returning after a few
   * days of reviews could otherwise face a whole line of it at once. Words
   * over the cap render plain green.
   */
  const goldTokens = useMemo(() => {
    const out = new Set<string>();
    for (const raw of primaryText.split(" ")) {
      const token = normalizeToken(raw);
      if (!token || out.has(token) || justClaimed.has(token)) continue;
      if (isPendingGreen(deck.get(token) as GoldCandidate | undefined)) {
        out.add(token);
        if (out.size >= MAX_GOLD_PER_LINE) break;
      }
    }
    return out;
  }, [primaryText, deck, justClaimed]);

  // Count one appearance per line, once, and let the RPC auto-claim past the
  // threshold so an ignored word stops glittering forever.
  useEffect(() => {
    if (!user || goldTokens.size === 0) return;
    for (const token of goldTokens) {
      const key = `${primaryText}::${token}`;
      if (seenLineKeysRef.current.has(key)) continue;
      seenLineKeysRef.current.add(key);
      const word = deck.get(token);
      if (word?.id) void touchGoldWord(word.id);
    }
  }, [goldTokens, primaryText, deck, user]);

  // Feed the shared dust canvas the on-screen position of each gold word.
  useEffect(() => {
    if (goldTokens.size === 0) {
      setDustAnchors([]);
      return;
    }
    const measure = () => {
      const next: DustAnchor[] = [];
      for (const token of goldTokens) {
        const el = wordElsRef.current.get(token);
        if (el) next.push({ key: token, rect: el.getBoundingClientRect() });
      }
      setDustAnchors(next);
    };
    measure();
    // Subtitles move with the player chrome; re-measure rather than drift.
    const id = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [goldTokens, primaryText]);

  // ── Line Blast ───────────────────────────────────────────────────────────
  // Identical to /landingpage4 by construction: every constant, timing and
  // string comes from src/lib/lineBlast.ts, which the demo also imports.

  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef(0);
  /** Lines already blasted, so a re-render can't fire the same one twice. */
  const blastedLinesRef = useRef<Set<string>>(new Set());

  const [praise, setPraise] = useState<{ big: string; sub: string; size: number; key: number } | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const [floatXp, setFloatXp] = useState<{ text: string; key: number } | null>(null);

  const maybeBlastLine = () => {
    if (blastedLinesRef.current.has(primaryText)) return;
    blastedLinesRef.current.add(primaryText);

    const reduced = prefersReducedMotion();
    comboRef.current = Math.min(comboRef.current + 1, COMBO_CAP);
    const combo = comboRef.current;

    if (!reduced) goldSweep(lineRef.current);

    window.setTimeout(() => {
      if (!reduced) scatterClones(stageRef.current, lineRef.current, fxRef.current);

      const [big, sub] = PRAISE[combo];
      setPraise({ big, sub, size: combo, key: Date.now() });
      setFloatXp({ text: floatXpText(combo), key: Date.now() });

      // Real XP, unlike the demo: one session_end grant per completed line,
      // scaled by the combo the same way the demo displays it.
      for (let i = 0; i < combo; i++) award("session_end", { cards: 10 });

      if (combo >= 2 && !reduced) {
        setGlowKey(Date.now());
      }
    }, reduced ? 0 : 220);

    window.setTimeout(() => {
      setPraise(null);
      setFloatXp(null);
    }, reduced ? 1500 : 2100);
  };

  // A new line breaks the combo unless it completes too — same rule as the demo.
  useEffect(() => {
    if (!blastedLinesRef.current.has(primaryText)) comboRef.current = 0;
  }, [primaryText]);

  /** Claim a gold word: chime, settle to green, award XP, maybe blast. */
  const claimGoldWord = async (token: string) => {
    const word = deck.get(token);
    if (!word?.id) return;

    // Optimistic — the gold should die under the finger, not after a round trip.
    setJustClaimed((prev) => new Set(prev).add(token));

    const { revealed, awardedXp } = await revealGreenWord(word.id);
    // `revealed: false` means it was already claimed elsewhere; staying silent
    // is what stops a double-tap paying twice.
    if (!revealed) return;

    playClaimChime();
    if (awardedXp > 0) award("reinforcement");

    // A claim can be the thing that completes the line. Recompute against the
    // whole line rather than just the gold set — the line only blasts when
    // every word is green, not merely when the gold is gone.
    const remainingGold = [...goldTokens].filter((t) => t !== token);
    if (remainingGold.length === 0) {
      const score = greenScoreForLine(primaryText, effectiveLang, deck);
      if (score.pct >= 100) maybeBlastLine();
    }
  };

  const handleWordClick = async (word: Word, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });

    if (word.translation) {
      setSelectedWord(word);
      return;
    }

    setSelectedWord({ ...word, translation: "Translating...", pronunciation: "", ipa: "" });
    setTranslating(true);

    try {
      const fromLang = getLanguageLabel(effectiveLang);
      const toLang = getLanguageLabel(nativeLanguage || "en");

      const { data, error } = await supabase.functions.invoke("translate-word", {
        body: { word: word.text, context: primaryText, fromLanguage: fromLang, toLanguage: toLang },
      });

      if (!error && data) {
        const translated = {
          ...word,
          translation: data.translation || "",
          pronunciation: data.pronunciation || "",
          ipa: data.ipa || "",
        };
        setSelectedWord(translated);
        word.translation = translated.translation;
        word.pronunciation = translated.pronunciation;
        word.ipa = translated.ipa;
      }
    } catch (e) {
      console.error("Word translation failed:", e);
    } finally {
      setTranslating(false);
    }
  };

  // Per-line green % using the weighted understanding model.
  const greenScore = useMemo(
    () => greenScoreForLine(primaryText, effectiveLang, deck),
    [primaryText, effectiveLang, deck],
  );

  const [reaction, setReaction] = useState<ReactionMode | null>(null);

  // Is every word in the line green EXCEPT the given one, which is in `expect`?
  // ("expect: undefined" = the word is unsaved/white.)
  const isLastNonGreen = (target: string, expect: DeckState | undefined): boolean => {
    const targetKey = normalizeToken(target);
    const tokens = primaryText.split(/\s+/).map(normalizeToken).filter(Boolean);
    if (tokens.length < 2) return false;
    let sawTarget = false;
    for (const tk of tokens) {
      const state = deck.get(tk)?.state;
      if (tk === targetKey) {
        if (state !== expect) return false;
        sawTarget = true;
      } else if (state !== "green") {
        return false;
      }
    }
    return sawTarget;
  };

  // The line-blast reward: saving the LAST unreviewed (white) word on an
  // otherwise all-green line "completes" it. Returns true only when every other
  // word in the line is already green and the word being saved is still white.
  const wouldCompleteLine = (savedText: string): boolean => isLastNonGreen(savedText, undefined);

  // The former local gold sweep lived here. It only did the shimmer — no
  // scatter, praise, XP label or confetti — so completing a line in the player
  // felt like a fraction of the same moment on /landingpage4. Both call sites
  // now run maybeBlastLine(), which is the landing page effect exactly.

  const renderWords = () => {
    const textWords = primaryText.split(" ");
    return textWords.map((text, index) => {
      const wordData = words.find(
        (w) => w.text.toLowerCase() === text.toLowerCase().replace(/[.,!?]/g, "")
      );
      const deckState = stateForToken(text);
      const token = normalizeToken(text);
      // A green word the learner hasn't witnessed yet renders GOLD, not green
      // — the promotion is a reward to be claimed, not a status to be shown.
      const isGold = goldTokens.has(token);
      // Saved words render in their exact deck colour (red/orange/green);
      // unknown words stay bright white to draw the eye.
      const deckColor = isGold
        ? GOLD.core
        : deckState
          ? DECK_COLORS[deckState]
          : undefined;
      return (
        <span
          key={index}
          ref={(el) => {
            if (isGold && el) wordElsRef.current.set(token, el);
            else if (!isGold) wordElsRef.current.delete(token);
          }}
          data-tour={wordData ? "subtitle-word" : undefined}
          className={cn(
            "subtitle-word inline-flex items-baseline transition-colors duration-500",
            // Only real words are interactive; everything else stays
            // click-through so the video controls underneath remain reachable.
            (wordData || isGold) && "cursor-pointer pointer-events-auto rounded hover:bg-white/10",
            deckColor ? "font-semibold" : "text-white font-medium",
          )}
          style={
            deckColor
              ? {
                  color: deckColor,
                  // The glow is what sells "claimable" before the dust loads.
                  textShadow: isGold ? `0 0 14px ${GOLD.glow}` : undefined,
                }
              : undefined
          }
          onClick={(e) => {
            // Claiming takes precedence over the translation popup: on a gold
            // word the tap means "this one's mine", not "what does it mean".
            if (isGold) {
              void claimGoldWord(token);
              return;
            }
            if (wordData) handleWordClick(wordData, e);
          }}
        >
          {text}
          {index < textWords.length - 1 && " "}
        </span>
      );
    });
  };

  return (
    <>
      <style>{`
        @keyframes lb-praise-in {
          0%   { opacity: 0; transform: scale(0.4); }
          12%  { opacity: 1; transform: scale(1.12); }
          20%  { transform: scale(1); }
          78%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04) translateY(-14px); }
        }
        @keyframes lb-xp-rise {
          0%   { opacity: 0; transform: translate(-50%, 10px); }
          18%  { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -48px); }
        }
        @keyframes lb-glow {
          0%   { opacity: 0; }
          22%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* No box: the layer is click-through (pointer-events-none) so the video
          controls underneath stay reachable — only the words re-enable clicks.
          Legibility comes from a strong text shadow, Netflix / Language Reactor
          style, instead of a solid panel that blocks the seek bar. */}
      <div
        ref={stageRef}
        className={cn(
          "px-6 py-2 text-center max-w-4xl mx-auto relative pointer-events-none",
          className
        )}
      >
        {reaction && (
          <ChameleonReaction mode={reaction} onDone={() => setReaction(null)} />
        )}
        {greenScore.totalCount > 0 && (
          <div className="pointer-events-auto absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 backdrop-blur">
            {greenScore.pct}% green
          </div>
        )}
        {onSavePhrase && primaryText.trim() && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSavePhrase(primaryText.trim());
            }}
            className="pointer-events-auto absolute -top-3 left-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-200 border border-purple-400/40 backdrop-blur hover:bg-purple-500/40 transition-colors"
            title="Save this whole line as a phrase flashcard"
          >
            + Save phrase
          </button>
        )}
        <p
          ref={lineRef}
          className="subtitle-text leading-relaxed"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)" }}
        >
          {renderWords()}
        </p>
        {mode === "dual" && secondaryText && (
          <p className="text-lg text-muted-foreground mt-2 font-light" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.95)" }}>
            {secondaryText}
          </p>
        )}

        {/* Blast layers — the FX div holds scattering word clones. */}
        <div ref={fxRef} className="pointer-events-none absolute inset-0 overflow-visible" />

        {/* Edge glow on combos ≥2, matching the demo. */}
        {glowKey > 0 && (
          <div
            key={`glow-${glowKey}`}
            className="pointer-events-none absolute inset-0 z-[35] rounded-2xl opacity-0 [box-shadow:inset_0_0_90px_rgba(52,211,153,0.55)]"
            style={{ animation: "lb-glow 0.9s ease-out forwards" }}
          />
        )}

        {praise && praise.big && (
          <div
            key={`praise-${praise.key}`}
            className="pointer-events-none absolute inset-x-0 -top-20 z-50 flex flex-col items-center gap-1 opacity-0"
            style={{ animation: "lb-praise-in 1.5s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <div
              className="text-center font-black italic leading-none tracking-tight text-amber-400 [transform:skewX(-6deg)] [text-shadow:0_2px_0_rgba(0,0,0,0.35),0_0_34px_rgba(251,191,36,0.5)]"
              style={{ fontSize: `clamp(${22 + praise.size * 4}px, ${3 + praise.size * 1.2}vw, ${36 + praise.size * 12}px)` }}
            >
              {praise.big}
            </div>
            {praise.sub && (
              <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-300 [text-shadow:0_0_16px_rgba(52,211,153,0.6)]">
                {praise.sub}
              </div>
            )}
          </div>
        )}

        {floatXp && (
          <div
            key={`xp-${floatXp.key}`}
            className="pointer-events-none absolute -bottom-6 left-1/2 z-50 text-base font-extrabold tabular-nums text-emerald-400 opacity-0 [text-shadow:0_0_14px_rgba(52,211,153,0.7)]"
            style={{ animation: "lb-xp-rise 1.3s ease-out forwards" }}
          >
            {floatXp.text}
          </div>
        )}
      </div>

      {/* One canvas for every gold word on screen — see GoldenDust. */}
      {dustAnchors.length > 0 && <GoldenDust anchors={dustAnchors} />}


      {selectedWord && (
        <WordPopup
          word={selectedWord}
          position={popupPosition}
          language={effectiveLang}
          translating={translating}
          onClose={() => setSelectedWord(null)}
          onSave={() => {
            // Check BEFORE the optimistic update (while the word is still white).
            const sweep = selectedWord ? wouldCompleteLine(selectedWord.text) : false;
            if (onSaveWord && selectedWord) onSaveWord(selectedWord);
            // Optimistic local update so the word turns red (UNKNOWN — newly
            // saved) immediately, mirroring the green update for "mark known".
            if (selectedWord) {
              setDeck((prev) => {
                const next = new Map(prev);
                const key = normalizeToken(selectedWord.text);
                const existing = next.get(key);
                next.set(key, {
                  id: existing?.id || selectedWord.id,
                  word: selectedWord.text,
                  language: effectiveLang,
                  state: existing?.state ?? "red",
                  times_correct: existing?.times_correct ?? 0,
                  review_count: existing?.review_count ?? 0,
                });
                return next;
              });
            }
            setSelectedWord(null);
            // Fire the gold line-blast after the re-render so it sweeps the
            // freshly-coloured words — and send in the RED chameleon: a
            // full-green line just gained a brand-new word.
            if (sweep) {
              setTimeout(maybeBlastLine, 40);
              setReaction("red");
            }
          }}
          onMarkKnown={
            onMarkKnown
              ? () => {
                  if (selectedWord) {
                    // Check BEFORE the update: was this the last non-green word,
                    // and was it ORANGE? If so the chameleon starts orange and
                    // transforms to green as the line completes.
                    const orangeFinish = isLastNonGreen(selectedWord.text, "orange");
                    const anyFinish = orangeFinish || isLastNonGreen(selectedWord.text, "red");
                    onMarkKnown(selectedWord);
                    // Optimistic local update so the word turns green immediately.
                    setDeck((prev) => {
                      const next = new Map(prev);
                      const key = normalizeToken(selectedWord.text);
                      const existing = next.get(key);
                      next.set(key, {
                        id: existing?.id || selectedWord.id,
                        word: selectedWord.text,
                        language: effectiveLang,
                        state: "green",
                        times_correct: existing?.times_correct ?? 0,
                        review_count: existing?.review_count ?? 0,
                      });
                      return next;
                    });
                    // The line just turned fully green — sweep it in gold and
                    // send in the chameleon (orange → green when the last word
                    // was still in the learning deck).
                    if (anyFinish) {
                      setTimeout(maybeBlastLine, 40);
                      setReaction("orange-to-green");
                    }
                  }
                  setSelectedWord(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
};
