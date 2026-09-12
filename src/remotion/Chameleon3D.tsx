// The real 3D chameleon pet model (public/pets/Chameleon_Animations.glb —
// the same rig used by the app's actual level-up celebration, see
// src/components/pets/PetCelebration.tsx and src/lib/levelCelebrations.ts),
// driven deterministically by the Remotion frame clock instead of
// requestAnimationFrame. Every frame sets the mixer's time directly and calls
// update(0) rather than accumulating a delta — Remotion renders frames out of
// order (and can re-render the same frame twice), so an accumulating clock
// would desync from the exported video the moment that happened.
//
// STATUS: work in progress. In this sandbox's headless Chromium (software
// WebGL via the deprecated SwiftShader fallback path — see
// Chameleon3DSmokeTest.tsx), neither this rigged model NOR the static
// unrigged one (brand/models/chameleon-optimised.glb) produce visible pixels
// yet, even though the GLTF loads correctly (verified: geometry, materials,
// bones, and both animation clips are all present — confirmed via debug
// throws during investigation). Confirmed working in the same environment:
// plain procedural r3f geometry (a <boxGeometry> mesh) with the same
// ThreeCanvas/light setup. So the gap is specifically "loaded GLTF mesh
// renders nothing," not the 3D pipeline in general. Next things to try:
// disable frustumCulled on every mesh in the traverse (SkinnedMesh bounding
// sphere can be degenerate pre-animation-update on some GL backends), try
// without `linear` on ThreeCanvas, and test in a real browser / real GPU to
// confirm whether this is sandbox-specific (software WebGL) rather than a
// code bug — if it renders fine there, this is an environment limitation,
// not something to keep chasing here.
import { Suspense, useMemo } from "react";
import { useCurrentFrame, useVideoConfig, staticFile, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DECK } from "@/lib/deck-colors";

const MODEL_URL = staticFile("pets/Chameleon_Animations.glb");

/** Picks (and holds a ready-to-scrub) AnimationAction for one clip on one model. */
function useScrubbableClip(model: THREE.Object3D, clips: THREE.AnimationClip[], name: string) {
  return useMemo(() => {
    const mixer = new THREE.AnimationMixer(model);
    const clip = THREE.AnimationClip.findByName(clips, name);
    const action = clip ? mixer.clipAction(clip) : null;
    action?.play();
    return { mixer, action, duration: clip?.duration ?? 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, name]);
}

interface ChameleonRigProps {
  /** Frames (local to this component, i.e. already offset) the intro clip gets before looping. */
  introFrames: number;
  introClip: string;
  loopClip: string;
}

function ChameleonRig({ introFrames, introClip, loopClip }: ChameleonRigProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gltf = useLoader(GLTFLoader, MODEL_URL);

  const model = useMemo(() => {
    // Not cloned: gltf.scene is a rigged SkinnedMesh, and Object3D.clone(true)
    // does not re-link skeleton bone bindings (that needs SkeletonUtils.clone).
    // A naive clone renders nothing. Only one instance is ever on screen in
    // this composition, so mutating the cached scene directly is safe.
    const scene = gltf.scene;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.1 / Math.max(size.x, size.y, size.z);
    scene.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
    scene.position.sub(center);
    return scene;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);

  const intro = useScrubbableClip(model, gltf.animations, introClip);
  const loop = useScrubbableClip(model, gltf.animations, loopClip);

  // Colour ramps red -> green across the whole beat, same deck colours as
  // every other surface in the product.
  const tintProgress = interpolate(frame, [0, introFrames + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame < introFrames && intro.action) {
    intro.action.time = frame / fps;
    intro.mixer.update(0);
  } else if (loop.action) {
    const localT = (frame - introFrames) / fps;
    loop.action.time = localT % loop.duration;
    loop.mixer.update(0);
  }

  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      const c = new THREE.Color(
        tintProgress < 0.5
          ? new THREE.Color(DECK.red).lerp(new THREE.Color(DECK.orange), tintProgress * 2)
          : new THREE.Color(DECK.orange).lerp(new THREE.Color(DECK.green), (tintProgress - 0.5) * 2),
      );
      // Tint, don't replace — keeps the model's own shading/gradient, just
      // pushes it toward the deck colour the way the 2D mascot's CSS custom
      // properties do.
      child.material.color.set(c);
    }
  });

  const spawnScale = interpolate(frame, [0, 14], [0.001, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  return (
    <group scale={spawnScale} rotation={[0, Math.PI * 0.15, 0]}>
      <primitive object={model} />
    </group>
  );
}

export interface Chameleon3DProps {
  introFrames?: number;
  introClip?: string;
  loopClip?: string;
  width: number;
  height: number;
}

/**
 * The 3D level-up chameleon, ready to drop into a <Series.Sequence>.
 * Wrapped in Suspense because GLTFLoader suspends until the model is fetched
 * — Remotion's renderer waits for this to resolve before it captures the
 * frame (see @remotion/three's SuspenseLoader pattern).
 */
export function Chameleon3D({
  introFrames = 45,
  introClip = "Spin",
  loopClip = "Bounce",
  width,
  height,
}: Chameleon3DProps) {
  return (
    <ThreeCanvas width={width} height={height} linear>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={[0xffffff, 0x443388, 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <Suspense fallback={null}>
        <ChameleonRig introFrames={introFrames} introClip={introClip} loopClip={loopClip} />
      </Suspense>
    </ThreeCanvas>
  );
}

export default Chameleon3D;
