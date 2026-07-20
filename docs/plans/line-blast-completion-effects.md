# Line Blast — Block Blast-style completion effects for LinguaScript

**Status: PLAN ONLY — no implementation yet. For discussion & review.**

The idea (from Rowan): completing a subtitle line is LinguaScript's version of
filling a row of blocks. When a line goes from 90-something % green and the
*last* word turns green, we should get a massive Block Blast-style payoff —
combos, score multipliers, and the row-clear animation. Rare enough to keep
dopamine fluctuating, big enough to spike it.

---

## 1. Research: how Block Blast actually does it

Open-source references studied (the official game by Hungry Studio is
closed-source; these are the best public reimplementations):

| Repo | Stack | What it's useful for |
|---|---|---|
| [tokaa1/blockerino](https://github.com/tokaa1/blockerino) | TypeScript, React (Native) + Reanimated | **Primary reference.** Full clear animation, combo system, and HUD in React idioms we can port almost directly |
| [blockblastpuzzle/block-blast](https://github.com/blockblastpuzzle/block-blast) | TypeScript, Next.js | Web implementation of the game loop |
| [RisticDjordje/BlockBlast-Game-AI-Agent](https://github.com/RisticDjordje/BlockBlast-Game-AI-Agent) | Python | Cleanest written-down scoring/combo rules (built for RL, so the reward math is explicit) |
| [sinancemerdogan/Block-Blast](https://github.com/sinancemerdogan/Block-Blast) | Unity/C# | Polish reference (juice, squash & stretch) |

### The row-clear animation (from blockerino's `BlockGrid.tsx`)

When cells flip from FILLED to EMPTY, each block simultaneously:

- **scales down and fades**: `scale: 1 - progress`, `opacity: 1 - progress`
- **scatters outward on a random trajectory**: offset by
  `cos(angle) * distance`, `sin(angle) * distance` with a random angle —
  blocks explode outward like particles, they don't just vanish
- **rotates randomly** while flying: `rotate: randomRotation * progress`
- **easing**: `1 - 2^(-10 * progress)` (hard exponential ease-out — fast
  burst, gentle settle)
- **duration**: ~500 ms total

### The scoring & combo system (from blockerino's `Game.tsx`)

```js
// every placement
score += pieceBlockCount;
// on clear — the multiplier is where the dopamine lives
score += linesBroken * boardLength * (combo / 2) * pieceBlockCount;
```

- Combo **increments on every clear** and **persists across placements**;
  it resets only after a full hand (3 pieces) passes with no clear.
- Multi-line clears multiply the payout, so bigger completions feel
  disproportionately bigger.

### The HUD (from blockerino's `GameHud.tsx`)

- Score **counts up** (animated interpolation over ~200 ms), never snaps.
- Combo is a **colored meter**: `interpolateColor` from transparent → red →
  green as the combo builds, and it **pulses** (`scale 1 → 1.1 → 1`,
  repeated) when one step from the max.
- The official game adds praise text that escalates with combo
  ("Good" → "Great" → "Amazing" → "Unbelievable") plus a glow beam through
  the cleared row and a haptic tick. We should copy that escalation ladder.

---

## 2. Mapping Block Blast → LinguaScript

We already have the perfect substrate — nothing about the core model changes:

| Block Blast | LinguaScript equivalent (already exists) |
|---|---|
| Row of blocks | Subtitle line (`SubtitleOverlay`) |
| One block | One word token |
| Filled block | Green word (`deck.state === "green"`) |
| Row completion | `greenScoreForLine(...).pct` crossing to **100** (`src/lib/understanding.ts`) |
| Score | XP (`XpContext.award`, `src/lib/xp.ts`) |
| Piece placed | Word marked known / promoted to green |

**The trigger moment** — exactly the one described: the user taps "mark
known" on the last non-green word of the on-screen line.
`SubtitleOverlay` already does an optimistic deck update on `onMarkKnown`
(line ~213), and already computes `greenScore` per line — so detecting the
`pct < 100 → pct === 100` transition is a tiny diff in a component that
already owns all the state. No new data fetching, no backend changes.

### Combo rule (proposed — discuss)

- Completing a line starts/increments the combo: ×1, ×2, ×3… capped at ×5.
- Combo **persists while you keep completing**: it resets after **8 subtitle
  lines pass with zero completions** (the analog of blockerino's
  "one hand without a clear"). Time-based reset feels wrong in a video
  context — lines are the natural clock.
- Combo state lives per watch-session (resets when you leave the video).

### Scoring rule (proposed — discuss)

New XP action `line_complete` in `src/lib/xp.ts`:

```
base 15 XP × combo multiplier   →   15 / 30 / 45 / 60 / 75
```

For scale: saving a word is 20 XP, watching a whole video is 10 XP. A ×5
combo (75 XP) should feel jackpot-rare. Numbers are tunable — see open
questions.

### Anti-farming guard

A line only ever blasts **once per video per user** (track completed line
indices in a per-session set). Otherwise you could farm XP by toggling a
word red/green on a paused frame.

---

## 3. The effect itself (escalating with combo)

All built from things already in `package.json` — `framer-motion`,
`canvas-confetti` — plus CSS keyframes in the existing `index.css` style:

1. **Gold flash sweep** (~150 ms): every word in the line flashes
   emerald→gold left-to-right (staggered ~30 ms/word — the "wave" blockerino
   uses on board load).
2. **The blast** (~500 ms): each word tile clones into an absolutely
   positioned copy that scatters outward — random angle, random rotation,
   scale→0, opacity→0, exponential ease-out. Direct port of blockerino's
   cell animation, with words instead of squares. The real subtitle line
   stays legible underneath (we blast the clones, not the actual text —
   users still need to read).
3. **Praise text**: "LINE COMPLETE!" scaling in over the line; at combo ≥2
   it becomes "COMBO ×2 — GREAT!", ×3 "AMAZING!", ×4+ "UNBELIEVABLE!" with
   growing font size and glow.
4. **XP chip counts up** (not snaps) — 200 ms interpolation, blockerino-style.
5. **Combo ≥2 extra**: `canvas-confetti` burst (the exact pattern already
   used in `PetCelebration.tsx` line ~257) + screen-edge emerald glow pulse.
6. **Combo meter**: small chip next to the existing "% green" badge on the
   overlay showing `×N` with the red→green color interpolation, pulsing when
   a completion would level it up.

Constraints respected:

- `prefers-reduced-motion` → skip scatter/confetti, keep XP chip + praise
  text fade (existing pattern in `XpToast.tsx`).
- Works inside the fullscreen player container (overlay is already rendered
  there, `Watch.tsx` line ~1081).
- Never blocks word taps — all effect layers `pointer-events-none`.

---

## 4. Implementation plan (phased, all testable on localhost)

**Phase 1 — pure logic, no UI** (`src/lib/lineBlast.ts` + tests)
- `detectLineCompletion(prevScore, nextScore)` transition detector
- Combo state machine (increment / decay-after-8-lines / cap / reset)
- XP calculation with multiplier
- Unit tests for all edge cases (empty lines, 1-word lines, function-word-only
  lines, re-showing a completed line)

**Phase 2 — the effect component, in isolation** (`src/components/LineBlastEffect.tsx`)
- Word-scatter animation, praise ladder, confetti tiers
- Dev preview harness: `?blastdemo=1` URL param with trigger buttons at each
  combo level — same pattern as the existing `?petdemo=1` in `XpToast.tsx`
  (line ~145). This is how we iterate on the feel on localhost **without
  needing a real video or real deck data**.

**Phase 3 — wiring** (small diffs to existing files)
- `SubtitleOverlay.tsx`: detect the 100% transition on optimistic deck
  update, call `onLineComplete(greenScore)`
- `Watch.tsx`: own the session combo state + completed-lines set, render
  `LineBlastEffect`, award XP
- `xp.ts` / `XpToast.tsx`: `line_complete` action + label

**Phase 4 — tuning pass (together, on localhost)**
- XP numbers, combo decay window, praise thresholds, particle counts
- Optional stretch: sound effect + `navigator.vibrate` haptic on mobile

**Localhost test protocol** (before anything ships):
1. `npm run dev` → `http://localhost:8080`
   (verified working in the cloud dev container — but there the sandbox has
   no IPv6, so `vite.config.ts`'s `host: "::"` fails; run
   `npx vite --host 127.0.0.1` there instead)
2. `/?blastdemo=1` — visual iteration on the effect at every combo tier,
   plus reduced-motion emulation in devtools
3. Real flow: open a video on `/watch`, mark the last unknown words of a
   line known → verify the blast, combo persistence across lines, the
   once-per-line guard, XP totals, and fullscreen mode
4. Regression: word tap/popup still works during the effect, no layout
   shift of the subtitle panel

---

## 5. Open questions to settle before building

1. **Combo decay**: reset after 8 completion-less lines (proposed) — or
   per-video-only, or a 60-second timer?
2. **XP values**: is 15 × multiplier (max 75) the right size next to
   add_word = 20?
3. **Already-green lines**: when a line appears that's *already* 100% green,
   no blast (proposed — it would fire constantly for advanced users and kill
   the rarity). Maybe a subtle shimmer instead?
4. **Flashcard reviews**: should a word promoted to green during flashcard
   review also blast (it can complete lines in videos you're not watching)?
   Proposed: no — keep the blast exclusive to the watch moment.
5. **Sound**: Block Blast leans hard on audio. In a video player, effect
   sounds compete with the film's audio. Proposed: off by default, or a very
   short soft chime.
