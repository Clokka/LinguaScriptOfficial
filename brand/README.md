# LinguaScript Brand Assets

Canonical, version-controlled home for LinguaScript's brand identity — colours,
the chameleon mascots, and 3D models. This folder is the **single source of
truth**. If a colour or asset appears in the app, the extension, or marketing,
it must match what's here.

> **Note on `public/` vs `brand/`:** heavy source files (e.g. the 20 MB
> `chameleon-base.glb`) live here in `brand/` so they are archived **without**
> shipping in the website build. Only small, optimised derivatives should be
> copied into `public/` for runtime use.

---

## 1. Colour system — the red/orange/green decks 🦎

The heart of the brand: every saved word lives in one of three decks, and its
colour is **identical everywhere it appears** — flashcards, the website player,
the Netflix overlay, and the YouTube overlay.

| Deck | Meaning | Hex | Where it's defined |
|------|---------|-----|--------------------|
| 🔴 **Red** | Unknown / newly saved | `#FF3B30` | `DECK` (src/lib/deck-colors.ts), `DECK_COLORS` (SubtitleOverlay.tsx), `Deck.PALETTE.red` (extension/ls-core.js) |
| 🟠 **Orange** | Learning | `#FF8A00` | same three |
| 🟢 **Green** | Known / acquired | `#34C759` | same three |
| ✨ **Gold** | Green, review due (not a deck — a *moment*) | `#FFD54A` | `Deck.PALETTE.gold` (extension/ls-core.js); see AGENTS.md's review-ladder entry |

**Mapping is 1:1:** red deck → red word, orange → orange, green → green.
No shifting, on any surface. Gold is layered on top of green at review time —
it is never a word's resting colour.

**Rule:** these hexes are the source of truth. If you change one, update all of:
- `src/lib/deck-colors.ts` → `DECK`
- `src/components/SubtitleOverlay.tsx` → `DECK_COLORS`
- `extension/ls-core.js` → `Deck.PALETTE` (shared by both `extension/adapters/netflix.js` and `extension/adapters/youtube.js`)

(There is a grep-based check for drift in the colour verification prompt.)

---

## 2. The chameleon mascots

Three chameleons, one per deck state — the visual embodiment of the colour
system. Same character, recoloured to red / orange / green.

| Asset | State | Status |
|-------|-------|--------|
| `mascots/chameleon-green.png`  | 🟢 Known    | ⛔ TODO — add as a file upload |
| `mascots/chameleon-orange.png` | 🟠 Learning | ⛔ TODO — add as a file upload |
| `mascots/chameleon-red.png`    | 🔴 Unknown  | ⛔ TODO — add as a file upload |
| `reference/chameleon-mascot.png` | Neutral mascot (existing) | ✅ present (from `public/mascot/`) |

> The three coloured chameleons were shared inline in chat and are **not yet on
> disk**. Re-attach them as **file uploads** and they'll be stored here.

**Usage idea:** the deck-coloured chameleon is the natural celebration character
when a word is saved into that deck (red on save, orange/green on promotion).

---

## 3. 3D models (GLB)

### Chameleon (brand hero model)
| File | Size | Notes |
|------|------|-------|
| `models/chameleon-base.glb` | **20 MB** | Raw upload. **Too heavy for web/extension as-is** — the 8 pet models total 2.2 MB. Optimise before runtime use (see below). |

**Optimisation before any runtime use** (target < 2 MB):
```bash
# Draco mesh compression + texture resize typically gets 20 MB → 1–3 MB
npx gltf-pipeline -i models/chameleon-base.glb -o models/chameleon-optimised.glb -d
# or meshopt + texture downscale via gltf-transform:
npx @gltf-transform/cli optimize models/chameleon-base.glb models/chameleon-optimised.glb \
  --texture-size 1024 --compress meshopt
```
Then copy the optimised file into `public/pets/` (or `public/brand/`) for the app.

### Companion pets (already in the app)
Rendered via `<model-viewer>` (loaded from CDN in `index.html`); 200–450 KB each,
stored in `public/pets/`:
`Colobus, Gecko, Herring, Inkfish, Muskrat, Pudu, Sparrow, Taipan`
(`*_Animations.glb`). Animation names: `Idle, Wave, Happy, Dance, Celebrate,
Sleep, Excited` (see `src/components/pets/PetViewer.tsx`).

---

## 4. Asset index (this folder)

```
brand/
├── README.md                     ← this file (the brand guide)
├── models/
│   └── chameleon-base.glb        ← 20 MB raw hero model (optimise before use)
├── mascots/                      ← the 3 deck-coloured chameleons (to add)
└── reference/
    └── chameleon-mascot.png      ← existing neutral mascot (copy of public/mascot)
```

---

## 5. Where the brand shows up in code

| Surface | File |
|---------|------|
| Canonical deck colours | `src/lib/deck-colors.ts` (`DECK`) |
| Website subtitle overlay | `src/components/SubtitleOverlay.tsx` (`DECK_COLORS`) |
| Extension word colours (Netflix + YouTube) | `extension/ls-core.js` (`Deck.PALETTE`), used by `extension/adapters/netflix.js` and `extension/adapters/youtube.js` |
| Extension review-ladder check | `extension/background.js` (`deckState()`), checked against `packages/core/src/review.ts` by `npm run test:review` |
| Pet rendering | `src/components/pets/PetViewer.tsx`, `PetLive.tsx`, `PetCelebration.tsx` |
| Chameleon mascot (2D, SVG) | `src/components/ChameleonMascot.tsx`, `public/logo.svg` / `favicon.svg` |
| Chameleon in 3D | `src/components/landing/Chameleon3D.tsx` (hue-rotates the rigged `/pets/Chameleon_Animations.glb` model — see §3) |
| Landing mascot demo | `src/components/LandingChameleonDemo.tsx` (`/mascot/chameleon.png`) |

---

## 6. The blue chameleon — 100% known

A fourth tier beyond green, not a fourth deck: a green word the learner got
right at its own 30-day review (`isBlue()` in `packages/core/src/review.ts` —
`state === "green"` and `interval_days` has climbed past the ladder's last
rung). The review ladder itself keeps going after this; blue only changes
how the word is *shown*, and it drops out of the phone's gold reviews
(widgets, lock screen) once it's blue.

| Part | Hex | Notes |
|------|-----|-------|
| Skin | `#2F7BFF` | |
| Skin (dark/shade) | `#1F5FD6` | also the tail stroke and the skin-spot colour (45% alpha) |
| Belly | `#C7DBFF` | |
| Ridge | `#163F99` | |

**What's different about this mascot, not just a recolour:** it has skin
spots (four small translucent dots) that the red/orange/green mascot never
has — see `ls_cham_blue.xml`. That's deliberate: 100% known should read as a
distinct milestone, not just "another colour in the ladder."

**Where it exists today:** Android only —
`mobile/plugins/word-bubble/res/drawable/ls_cham_blue.xml` (the home-screen
widget, `DeckWidget`). **Where it does NOT exist yet:** the website's
`ChameleonMascot.tsx` (tiers are still only `red | orange | green`), `DECK`
in `src/lib/deck-colors.ts`, and the extension's `Deck.PALETTE` in
`extension/ls-core.js`. If blue is meant to show up on web or in the
extension too, that's real, scoped follow-up work — not a mystery, just not
built yet.
