---
name: linguascript-design
description: |
  LinguaScript's brand identity and UI/UX rules: the logo (BrandMark), the
  chameleon mascot (PNG states + 3D model and its safe sizes), the colour
  system (red/orange/green decks plus cyan/purple/grey targets), dark theme
  tokens, typography, gradients, glass panels, the Tetris / Block Blast feel,
  and the UX rules (mobile first, dopamine through rarity, colour-blind safe,
  reduced motion). Use for ANY UI work in this repo: new pages, components,
  restyles, celebrations, the Chrome extension, marketing pages, or reviewing
  a screen for brand consistency.
---

# LinguaScript design system 🦎

Brand source of truth: `brand/README.md`. Product decisions for the learning
loop: `docs/plans/target-words-and-sentence-lab.md`. If this skill and the
code disagree, the tokens in `src/index.css` and the constants named below
win. Report the drift, don't invent a third value.

## 1. Logo

- **Always** render the logo with `<BrandMark />` (`src/components/BrandMark.tsx`).
  Never make a stand-in icon.
  - `variant="pin"`: the green chameleon only (headers, small spaces)
  - `variant="lockup"`: chameleon + wordmark **lingua**<green>**script**</green>
    (all lowercase, extrabold, "script" in brand green)
- Source image: `/favicon-512x512.png` (green chameleon on a branch).
- Animated wordmarks for marketing: `src/components/landing/LiveWordmark.tsx`,
  `HeroWordmarkBlast.tsx`.

## 2. The chameleon mascot

The chameleon **is** the colour system: it turns red, orange, then green as
the learner learns. Use it for celebrations and reactions, not decoration.

| Asset | Where |
|---|---|
| Deck-coloured PNGs (red / orange / green) | `src/assets/brand/chameleon-{red,orange,green}.png.asset.json` (Lovable-hosted, import the asset) |
| Neutral mascot PNG | `public/mascot/chameleon.png` |
| Glow mascot | `brand/mascot/chameleon-glow.png` |
| **3D model** (rigged, animated) | `public/pets/Chameleon_Animations.glb` (pet id `chameleon`, `src/lib/pets.ts`) |
| Reactions in the player | `src/components/ChameleonReaction.tsx` |
| 3D celebrations | `src/components/pets/PetCelebration.tsx` |

**3D sizes: the whole chameleon must always be visible, never cropped:**
- Word-saved pop-up: 150×150 box, `canvasSize: 150`, fit `1.5` (default)
- Level-up: `h-[190px] w-[190px] sm:h-[220px] sm:w-[220px]`, `canvasSize: 220`, fit `1.15`
- Camera: `PerspectiveCamera(35, 1, 0.1, 100)` at `(0, 0.35, 3.2)` looking at the origin
- Bigger box = raise `canvasSize` to match; **never** raise `fit` above 1.5 or
  move the camera closer (that's what crops it to just its eyes).

## 3. Colour system

### Deck colours (sacred, identical on every surface)
| Meaning | Hex | Token |
|---|---|---|
| Red: saved, new | `#FF3B30` | `--state-red` |
| Orange: learning | `#FF8A00` | `--state-orange`, `--accent` |
| Green: known, and the brand action colour | `#34C759` | `--state-green`, `--primary`, `--brand-green` |

Code constants: `DECK` in `src/lib/deck-colors.ts`, `DECK_COLORS` in
`SubtitleOverlay.tsx`, `DECK_CONFIG` in `Flashcards.tsx`, `.ls-red/.ls-orange/.ls-green`
in `extension/content.js` + `extension/youtube-content.js`. Change one = change all.

### Learning-loop colours (agreed; add to `deck-colors.ts` + extension when first used)
These are Apple system colours, the same family as the deck colours (which are
iOS red/green), so they sit together naturally.

| Meaning | Hex | Shape rule |
|---|---|---|
| **Cyan**: today's target word | `#64D2FF` | filled tile behind the word, not just text colour |
| **Purple**: target phrase/chunk | `#BF5AF2` | one connected tile across the words (a Tetris piece) |
| **Grey**: names, numbers, "euh" | `#8E8E93` | faded text, ignored by line checks |
| Gold: rare reward | `#FBBF24` (`CELEBRATION_GOLD`) | **on hold**, don't add new gold features |

White = a word not met yet.

### Surfaces (dark theme only)
| Role | Value |
|---|---|
| Page background | `#08080B` (`--background`) |
| Card | `#0E0E11` (`--card`); raised `#141416`; modal `#1a1a1e` |
| Border | `hsl(240 5% 15%)` |
| Text | near-white `hsl(210 40% 98%)`; muted `hsl(240 5% 65%)` |
| Radius | `0.75rem` (cards `rounded-2xl`/`rounded-3xl`, pills `rounded-full`) |
| Glass | `.glass-panel`, `.glass-panel-strong` (blur 20px, 8% white border) |

### Gradients and glows (`src/index.css`)
- `--gradient-primary`: green → orange (brand moments, `.gradient-text`)
- `--gradient-accent`: orange → yellow (streaks, `.gradient-text-accent`)
- Main call-to-action buttons: yellow → green pill (e.g. "Start Session")
- Glows: `--shadow-glow-primary` (green), `--shadow-glow-accent` (orange)

Use tokens (`bg-primary`, `text-brand-green`, `hsl(var(--state-red))`), never
new ad-hoc hexes.

## 4. Typography and voice

- Font: **Inter** (`font-sans`). Headlines `font-extrabold`, tight tracking.
  Small caps labels: `uppercase tracking-[0.2em] text-xs text-muted-foreground`.
- Voice: friendly, short, encouraging, a little playful. Emoji sparingly (🦎 🔥 🎉).
  Talk to the learner as "you". Celebrate progress; never shame.

## 5. The feel: Tetris / Block Blast

- Chunky rounded blocks, bold saturated colour on dark, satisfying snaps.
- A word landing in the deck = a block landing (cyan → red snap).
- Perfect Clear (every word green) = line blast: reuse `src/lib/lineBlast.ts` +
  `src/components/LineBlastOverlay.tsx`. Don't build a second blast.
- Blocks: `src/components/blocks/WordBlock.tsx`. Gap-fill board:
  `src/components/GapFillChallenge.tsx`. Animation help: the `framer-motion` skill.

## 6. UX rules (check every screen against these)

1. **Mobile first.** Most users are on phones. 16px side gutter, no horizontal
   scroll, thumb-reachable primary action, one primary action per screen.
2. **Small numbers, not scary totals.** "Today: 5 boards · ~3 min", never
   "352 due · 352 min". Percentages must be sensible (no "↑121%").
3. **Dopamine through rarity.** Few highlighted items, earned rewards, one big
   celebration per goal. Constant confetti becomes wallpaper.
4. **Colour-blind safe.** About 1 in 12 boys can't tell red from green: pair colour with
   **shape** (tile, outline, icon), never colour alone.
5. **Reduced motion.** Check `prefersReducedMotion()` (`lineBlast.ts`): swap
   flying/scattering effects for a glow. Keep sound and XP identical.
6. **The goal is the daily loop.** Every screen should help the learner hit their
   daily word goal and come back tomorrow. Remove anything that doesn't.
7. **Guests too.** Features work signed out (browser storage); ask for sign-up at a
   moment of pride (first 8/8), never as a wall.

## 7. Before you ship UI

- [ ] Logo via `BrandMark`; chameleon fully visible at the sizes above
- [ ] Only tokens/constants from this file; deck colours unchanged
- [ ] Works at 375px wide with no horizontal scroll
- [ ] Colour + shape; reduced-motion path exists
- [ ] Numbers shown are small, true and motivating
- [ ] If a colour was added, `brand/README.md` and the extension were updated too
