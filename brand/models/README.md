# brand/models

3D models for the LinguaScript brand.

## Status

| File | State | In git? |
|------|-------|---------|
| `chameleon-base.glb` | Raw 20 MB hero upload | ❌ git-ignored (too heavy; no LFS) |
| `chameleon-optimised.glb` | Optimised derivative (< 2 MB) | ✅ commit once generated |

The raw `chameleon-base.glb` is intentionally kept out of version control until a
storage decision is made (compress-and-commit / Git LFS / external Supabase
storage). It currently exists only in the working tree / original upload.

To produce a committable, runtime-ready version:
```bash
npx @gltf-transform/cli optimize chameleon-base.glb chameleon-optimised.glb \
  --texture-size 1024 --compress meshopt
# or: npx gltf-pipeline -i chameleon-base.glb -o chameleon-optimised.glb -d
```
Then copy `chameleon-optimised.glb` into `public/pets/` (or `public/brand/`) for
the app to load via `<model-viewer>`.
