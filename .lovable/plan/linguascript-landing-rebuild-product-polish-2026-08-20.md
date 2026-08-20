# LinguaScript — Landing rebuild + product polish

Two workstreams: (A) a genuinely one-of-a-kind landing experience, (B) the audit fixes you listed. Nothing ships until you approve.

## Before I build — three blockers

1. **The Claude artifact links can't be opened by me.** They're behind your org login ("Échec de l'authentification / L'accès à l'organisation est désactivé"). Paste the code or export each artifact as a file and drop it in chat, and I'll port them exactly — especially the better 2D chameleon.
2. **The 21st.dev API key you pasted in chat is now public.** Rotate it. If you want it in the app, I'll store it as a backend secret — never in a message.
3. **External skill repos** (ui-ux-pro-max etc.) can't be auto-installed from GitHub by me. Skills are activated from Settings > Skills. I'll apply the craft directly instead: the copy/UX below is written to that standard.

## A. The landing page (new `/` experience, replacing what `/landingpage4` and `/thechameleonmethod` do today)

### Structure — every scroll beat earns the next

```text
1  THE WORDMARK IS THE PRODUCT   Lingua|Script — tap "Script"
                                 white -> green -> gold -> LINE BLAST
                                 3D chameleon celebrates + shifts colour
2  THE CHAMELEON METHOD          second interactive line, same mechanic
3  STORE BADGES                  App Store / Google Play / Chrome
4  YOUR COMPANION                3D chameleon, colour-changing, auto-orbit
5  LINGUASCRIPTS, LIVE           embedded working /linguascripts demo
6  WATCH -> SAVE -> GREEN        the three decks, real subtitle overlay
7  PROOF + PRICING + STUDENT CTA absorbed from the chameleon method page
```

### Hero mechanic (the showpiece)
- Giant `LinguaScript`. `Lingua` static, `Script` is the interactive target.
- Tap/click `Script`: white flash -> green fill -> **gold** -> Line Blast particles fire outward using the real `useLineBlast`/`LineBlastOverlay` code, not a mock.
- The 3D chameleon (`Chameleon3D`, the rigged 227 KB pet model) plays its celebrate clip and cross-fades red -> orange -> green -> gold.
- Auto-plays once after ~1.2s for anyone who doesn't touch it; replay on every tap.
- Reduced-motion: static gold end-state, no particles.

### Copy (new voice — warm, funny, trustworthy, zero AI dashes)
- Headline eyebrow: **The Chameleon Method**
- Sub: **The app that makes learning a language free, fun, and open to everyone.**
- Scroll cue: **Scroll to turn the LinguaScript green.** (replaces "Watch the language turn green" on both pages)
- Demo line becomes: **J'utiliserai la meilleure application d'apprentissage des langues (LinguaScript).**
- **Cut entirely:** "Why shows don't teach you", "You've watched 200 hours of French. You still can't order coffee.", and the three negative cards. Replaced by Line Blast as the first thing after the hero.
- Line Blast section keeps: "Finish the line. Watch it go green. Tap the words you already know. When the last one turns, the whole line is yours. This is the real thing below, not a video of it."
- Companion section keeps "It changes colour because you did." — "Drag to spin it" is removed; the model orbits on its own and reacts to the cursor.
- Global pass: no em-dash-heavy AI cadence, no "unlock your potential", no triplet lists for their own sake.

### LinguaScripts built-in demo
A real, playable `LinguaScriptExercise` on the landing page seeded with a fixed French word set, running the same components as `/linguascripts` (no auth, no writes). Shows the exercise, the correct/incorrect feedback, and the word promoting red -> orange -> green.

### 3D vs 2D chameleon
- 3D everywhere it fits (hero, companion, celebrations) via the existing rigged model.
- 2D only as fallback — and I'll swap the current SVG for your better artifact version once you send it.

## B. Audit fixes

| # | Issue | Fix |
|---|-------|-----|
| 1 | YouTube/Netflix marks look faded | Full-opacity brand marks, no 70% dim, larger |
| 2 | Runtime error on `/landingpage4` | Reproduce in the preview and fix at source |
| 3 | Google sign-in shows "lovable.app / subtitlemastery" | Needs your own Google Cloud OAuth client with the verified `linguascript.co.uk` consent screen; I'll give you the exact steps and wire the credentials in |
| 4 | "The 3 pillars" screen looks like different software | Re-skin the whole onboarding to the landing palette (near-black canvas, deck colours, the same type scale) |
| 5 | "Onboarding" wording | Renamed to **Sign up** everywhere user-facing |
| 6 | French missing as native language | Caused by excluding the learning language from the native list; the two lists become independent |
| 7 | Goal completion is silent | When a daily goal is hit (e.g. 5 words reviewed), the selected pet appears with a warm orange nudge card: "That's your 5. Want to keep going?" with a gentle route to review. Same orange as sign-up, dismissible, once per day |

## Technical notes

- New `src/pages/Landing5.tsx` composed from small components in `src/components/landing/` (`HeroWordmarkBlast`, `LinguaScriptsDemo`, `CompanionOrbit`). `/landingpage4` and `/thechameleonmethod` keep working while we compare, then both point at the new one.
- Hero blast reuses `src/lib/lineBlast.ts` + `LineBlastOverlay` so the marketing effect can never drift from the product.
- Colours stay on the canonical deck tokens in `src/lib/deck-colors.ts`; gold gets added there as a fourth celebration-only token.
- Goal nudge builds on the existing XP/streak hooks and the pet context; no new tables.
- Perf budget: 3D loads lazily below the fold with a poster frame; hero stays under 100 KB JS.

## What I need from you

1. The five artifact files (paste or upload).
2. Confirm the new landing replaces `/` at launch, or stays at `/landing5` until you sign off.
