// MOTIVATION LAYER — 3D pet spawn celebrations, driven by XpToast.
// Word saved: small non-blocking toast, bottom-right — pet pops in with an
// elastic scale, loops Bounce, XP chip slides up, despawns after ~2.2s.
// Level up: centered takeover — dim/blur backdrop, golden glow, pet plays
// Spin then loops Bounce, confetti burst, gradient level title.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import confetti from "canvas-confetti";
import { getPetById } from "@/lib/pets";
import { celebrationForLevel } from "@/lib/levelCelebrations";

const loader = new GLTFLoader();
const gltfCache = new Map<string, Promise<GLTF>>();

function loadPetModel(glbFile: string): Promise<GLTF> {
  let p = gltfCache.get(glbFile);
  if (!p) {
    p = new Promise((res, rej) => loader.load(glbFile, res, undefined, rej));
    gltfCache.set(glbFile, p);
  }
  return p;
}

/** Preload the active pet's model so the first celebration spawns instantly. */
export function preloadPetModel(petId: string | null) {
  const pet = petId ? getPetById(petId) : null;
  if (pet) void loadPetModel(pet.glbFile).catch(() => gltfCache.delete(pet.glbFile));
}

// easeOutBack — the elastic "pop" for spawn-in
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function makeStage(canvasSize: number) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(canvasSize, canvasSize);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.35, 3.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x443388, 2.2));
  const dir = new THREE.DirectionalLight(0xffffff, 2.4);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  return { renderer, scene, camera };
}

function fitModel(gltf: GLTF) {
  const model = gltf.scene;
  // the model object is shared across celebrations — detach it from any
  // previous (possibly scaled-out) wrapper and reset its transform BEFORE
  // measuring, or the fit compensates for stale parent/self scale
  if (model.parent) model.parent.remove(model);
  model.scale.setScalar(1);
  model.position.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = 1.5 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.position.y += 0.05;
  const wrapper = new THREE.Group();
  wrapper.add(model);
  return wrapper;
}

function playClip(
  gltf: GLTF,
  model: THREE.Object3D,
  name: string,
  { loop = false } = {},
) {
  const mixer = new THREE.AnimationMixer(model);
  const clip = THREE.AnimationClip.findByName(gltf.animations, name);
  if (!clip) return { mixer, action: null, clip: null };
  const action = mixer.clipAction(clip);
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.clampWhenFinished = true;
  action.play();
  return { mixer, action, clip };
}

interface StageTimings {
  spawn: number;
  hold: number;
  exit: number;
}

/**
 * Mounts a three.js stage into `host`, spawns the pet with the elastic pop,
 * runs the animation loop, and calls `onDone` after spawn+hold+exit.
 * Returns a cleanup function.
 */
function runStage(opts: {
  host: HTMLElement;
  glbFile: string;
  canvasSize: number;
  timings: StageTimings;
  clips: { intro?: string; loop: string };
  onExit?: (k: number) => void; // k goes 1 → 0 during exit
  onDone: () => void;
}) {
  const { host, glbFile, canvasSize, timings, clips, onExit, onDone } = opts;
  let disposed = false;
  let raf = 0;
  let renderer: THREE.WebGLRenderer | null = null;
  let introTimer: ReturnType<typeof setTimeout> | null = null;

  loadPetModel(glbFile)
    .then((gltf) => {
      if (disposed) return;
      const stage = makeStage(canvasSize);
      renderer = stage.renderer;
      host.appendChild(stage.renderer.domElement);

      const wrapper = fitModel(gltf);
      stage.scene.add(wrapper);
      const model = wrapper.children[0];

      let mixer: THREE.AnimationMixer;
      if (clips.intro) {
        const intro = playClip(gltf, model, clips.intro);
        mixer = intro.mixer;
        if (intro.clip) {
          introTimer = setTimeout(() => {
            if (disposed) return;
            mixer = playClip(gltf, model, clips.loop, { loop: true }).mixer;
          }, intro.clip.duration * 1000);
        } else {
          mixer = playClip(gltf, model, clips.loop, { loop: true }).mixer;
        }
      } else {
        mixer = playClip(gltf, model, clips.loop, { loop: true }).mixer;
      }

      const { spawn, hold, exit } = timings;
      const start = performance.now();
      const clock = new THREE.Clock();
      const tick = () => {
        if (disposed) return;
        const t = (performance.now() - start) / 1000;
        mixer.update(clock.getDelta());
        if (t < spawn) {
          wrapper.scale.setScalar(Math.max(0.001, easeOutBack(t / spawn)));
        } else if (t < spawn + hold) {
          wrapper.scale.setScalar(1);
        } else if (t < spawn + hold + exit) {
          const k = 1 - (t - spawn - hold) / exit;
          wrapper.scale.setScalar(Math.max(0.001, k));
          onExit?.(k);
        } else {
          onDone();
          return;
        }
        stage.renderer.render(stage.scene, stage.camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
    })
    .catch(() => {
      gltfCache.delete(glbFile);
      if (!disposed) onDone();
    });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    if (introTimer) clearTimeout(introTimer);
    renderer?.dispose();
    renderer?.domElement.remove();
  };
}

export const WORD_SAVED_DURATION_MS = 2300;

/** Fixed spawn + exit either side of the per-level hold, in seconds. */
const LEVEL_UP_FIXED_S = 0.5 + 0.3;

/**
 * How long a level-up takes, in ms — derived from that level's celebration
 * rather than fixed, because the hold grows along the ramp (level 10 runs a
 * full second longer than level 2). A constant here would unmount the
 * takeover mid-animation on the bigger levels.
 */
export function levelUpDurationMs(level: number): number {
  return Math.round((celebrationForLevel(level).hold + LEVEL_UP_FIXED_S) * 1000) + 200;
}

interface WordSavedCelebrationProps {
  petId: string;
  amount: number;
  label: string;
  onDone?: () => void;
}

export function WordSavedCelebration({ petId, amount, label, onDone }: WordSavedCelebrationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const pet = getPetById(petId);
    if (!pet || !hostRef.current) {
      onDoneRef.current?.();
      return;
    }
    const chipTimer = setTimeout(() => chipRef.current?.classList.add("opacity-100", "translate-y-0"), 250);
    const cleanup = runStage({
      host: hostRef.current,
      glbFile: pet.glbFile,
      canvasSize: 150,
      timings: { spawn: 0.45, hold: 1.5, exit: 0.25 },
      clips: { loop: "Bounce" },
      onExit: (k) => {
        if (rootRef.current) rootRef.current.style.opacity = String(k);
        chipRef.current?.classList.remove("opacity-100", "translate-y-0");
      },
      onDone: () => onDoneRef.current?.(),
    });
    return () => {
      clearTimeout(chipTimer);
      cleanup();
    };
  }, [petId]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed right-6 z-[100] flex flex-col items-center"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" }}
    >
      <div ref={hostRef} className="h-[150px] w-[150px]" />
      <div
        ref={chipRef}
        className="-mt-3.5 flex translate-y-1.5 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 font-semibold text-white opacity-0 shadow-glow-primary transition-all duration-300"
      >
        <span>+{amount} XP</span>
        <span className="text-xs opacity-80">· {label}</span>
      </div>
    </div>
  );
}

interface LevelUpCelebrationProps {
  petId: string;
  level: number;
  onDone?: () => void;
}

export function LevelUpCelebration({ petId, level, onDone }: LevelUpCelebrationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const pet = getPetById(petId);
    if (!pet || !hostRef.current) {
      onDoneRef.current?.();
      return;
    }
    // Each level on the ramp to 10 gets its own clip and confetti weight, so
    // nine rapid level-ups feel like nine moments rather than one on repeat.
    const cel = celebrationForLevel(level);

    requestAnimationFrame(() => rootRef.current?.classList.add("opacity-100"));
    confetti({
      particleCount: cel.particles,
      spread: cel.spread,
      startVelocity: 42,
      origin: { y: 0.55 },
      colors: ["#7c3aed", "#a78bfa", "#fb923c", "#facc15", "#22c55e"],
    });
    return runStage({
      host: hostRef.current,
      glbFile: pet.glbFile,
      canvasSize: 320,
      timings: { spawn: 0.5, hold: cel.hold, exit: 0.3 },
      clips: { intro: cel.intro, loop: cel.loop },
      onExit: () => rootRef.current?.classList.remove("opacity-100"),
      onDone: () => onDoneRef.current?.(),
    });
    // `level` matters: consecutive level-ups reuse this component instance, so
    // without it the second one would replay the first one's animation.
  }, [petId, level]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-[110] flex flex-col items-center justify-center bg-background/60 opacity-0 backdrop-blur-sm transition-opacity duration-300"
    >
      <div className="relative h-[320px] w-[320px]">
        <div
          className="absolute inset-[10%] animate-pulse rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(48 96% 53% / 0.28), hsl(27 96% 61% / 0.12) 55%, transparent 72%)",
          }}
        />
        <div ref={hostRef} className="relative h-[320px] w-[320px]" />
      </div>
      <div
        className="bg-gradient-to-br from-orange-400 to-yellow-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        Level {level}!
      </div>
      {/* Named moment rather than the same line nine times on the way to 10. */}
      <p className="mt-1.5 text-sm text-muted-foreground">
        {celebrationForLevel(level).caption}
      </p>
    </div>
  );
}
