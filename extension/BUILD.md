# Extension vendor bundles

`extension/vendor/*.bundle.js` are pre-built and committed — the unpacked
extension needs zero build step to load. They exist because MV3 content
scripts can't `import` npm packages directly; these two features need real
npm dependencies the extension can't otherwise reach:

- `chameleon3d.bundle.js` — three.js + GLTFLoader + MeshoptDecoder, exposing
  `window.LSChameleon3D.mount(...)`. Powers the 3D chameleon level-up
  celebration. Only injected into the page lazily, on a learner's first
  level-up — never loaded on every page view.
- `confetti.bundle.js` — the real `canvas-confetti` package (same one
  `src/lib/lineBlast.ts` uses), exposing `window.LSConfetti.create(canvas)`.
  Keeps the extension's Line Blast confetti byte-identical to the website's
  instead of a hand-rolled reimplementation.

Both are built from `extension/src/*-entry.js`, which are faithful
non-React ports of `src/components/landing/Chameleon3D.tsx` and the
`canvas-confetti` usage in `src/lib/lineBlast.ts`.

Rebuild after touching either entry file, or after bumping `three` /
`canvas-confetti` in `package.json`:

```sh
npm run build:extension-vendor
```

`extension/vendor/Chameleon_Animations.glb` is a straight copy of
`public/pets/Chameleon_Animations.glb` (the 227 KB textured, rigged pet
asset — not the 20 MB untextured brand sculpt in `brand/models/`). Re-copy
it if the source model ever changes.
