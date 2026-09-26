# Big, vibrant level-up chameleon

## Quickest way back to the old version
Open the History tab and restore the version from before the last "chameleon clipping" change. That brings back the old large level-up chameleon. It also undoes the word popup spacing and the Japanese video label fix. If you want to keep those, use the fix below instead.

## Audit: why the level-up chameleon shrank
- The last fix sized the chameleon to fit **every** move in its model file (Spin, Roll, Fly, Run and more), not just the moves it actually plays. Roll and Fly sweep very wide, so the chameleon got scaled down to fit moves it never does in that moment.
- The level-up box stayed the same size (190px on phones, 220px on bigger screens), with a 1.15 fit. So a smaller chameleon inside a small box looks tiny.
- The glow behind it is faint (28% gold), so the whole moment feels flat.
- This only affects the level-up. The small word-saved chameleon and the ones in the subtitles stay the same.

## Fix
1. Size the level-up chameleon only against the two moves it plays for that level (its intro move plus Bounce), not all of them.
2. Make the level-up stage much bigger: about 280px on phones and 340px on larger screens, and have it fill more of the frame so it looks large while staying uncropped.
3. Make it more vibrant: brighter lighting only on the level-up, a stronger gold and orange glow that pulses, and a short "burst" ring when it pops in.
4. Bigger effect: a larger pop-in, a second confetti burst from both sides, and a bigger "Level N!" title.
5. Leave everything else as it is: the word-saved toast, the subtitle chameleons, timings, captions and moves.
6. Check it on a 384×626 phone and on desktop. Take screenshots during the pop, the intro move and the bounce to confirm it's large and never cropped.

## Technical details (prompt)
In `src/components/pets/PetCelebration.tsx`:
- Give `fitModel(gltf, fit, clipNames?)` a clip filter so it only samples the named clips. Level-up passes `[cel.intro, cel.loop]`. Word-saved passes `["Bounce"]`, which keeps its behaviour.
- Level-up: box `h-[280px] w-[280px] sm:h-[340px] sm:w-[340px]`, `canvasSize: 340`, `fit: 1.45`. Camera stays the same.
- Add a `bright` option to `makeStage` for level-up only: hemisphere 2.6, key 2.8, fill 1.4, and set `renderer.toneMapping = ACESFilmic` with exposure 1.15.
- Glow: radial gradient at about 0.55/0.3 opacity at `inset-0`, plus a one-shot ring that scales and fades out over 0.6s.
- Confetti: keep the centre burst and add left and right bursts at 250ms. Title goes from `text-4xl` to `text-5xl sm:text-6xl`.
- Check with Playwright at 384×626 and 1280×800. Take frame captures during spawn, intro and loop, and confirm the canvas edges have no clipped pixels.
