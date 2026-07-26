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
| 🔴 **Red** | Unknown / newly saved | `#FF3B30` | `DECK_CONFIG` (Flashcards.tsx), `DECK_COLORS` (SubtitleOverlay.tsx), `.ls-red` (extension) |
| 🟠 **Orange** | Learning | `#FF8A00` | same three |
| 🟢 **Green** | Known / acquired | `#34C759` | same three |

**Mapping is 1:1:** red deck → red word, orange → orange, green → green.
No shifting, on any surface.

**Rule:** these three hexes are the source of truth. If you change one, update
all of:
- `src/pages/Flashcards.tsx` → `DECK_CONFIG`
- `src/components/SubtitleOverlay.tsx` → `DECK_COLORS`
- `extension/content.js` and `extension/youtube-content.js` → `.ls-red/.ls-orange/.ls-green`

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
| Flashcard decks | `src/pages/Flashcards.tsx` (`DECK_CONFIG`) |
| Website subtitle overlay | `src/components/SubtitleOverlay.tsx` (`DECK_COLORS`) |
| Netflix word colours | `extension/content.js` (`.ls-red/.ls-orange/.ls-green`) |
| YouTube word colours | `extension/youtube-content.js` (same) |
| Pet rendering | `src/components/pets/PetViewer.tsx`, `PetCelebration.tsx` |
| Landing mascot | `src/components/LandingChameleonDemo.tsx` (`/mascot/chameleon.png`) |
