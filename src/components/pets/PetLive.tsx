// Live three.js viewer for a pet GLB with imperative animation control.
// Fetches the real model from public/pets/ and crossfades between clips.
//
// Optional `tint` drives a magical colour-state look. Two modes:
//  • Skin recolour (hueRotate set): the baseColor texture is redrawn through a
//    `hue-rotate/saturate` filter, so the skin genuinely changes colour while
//    unsaturated detail (eyes, mouth, claws) stays intact. Best for real
//    red/orange/green chameleon skins.
//  • Solid tint (no hueRotate): the material colour/emissive lerp to a target.
// `god` mode oscillates a gold skin with a pulsing blue glow for a hyper state.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface MascotTint {
  /** Solid-tint mode: colour the body lerps toward, e.g. "#ef4444". */
  color?: string;
  /** Skin-recolour mode: degrees to rotate the texture hue (green≈baseline). */
  hueRotate?: number;
  /** Saturation multiplier for skin-recolour mode. Default 1. */
  saturate?: number;
  /** Emissive glow colour (defaults to a dimmed target). */
  emissive?: string;
  /** Emissive strength, 0–~2. Default 0.3. */
  emissiveIntensity?: number;
  /** Hyper state: gold skin + pulsing blue glow, ignores other fields. */
  god?: boolean;
}

export interface PetLiveHandle {
  /** Play a clip by GLB name (e.g. "Bounce", "Spin", "Jump", "Roll"). */
  play: (clip: string) => void;
}

interface PetLiveProps {
  glbFile: string;
  size: number;
  idleClip?: string;
  tint?: MascotTint;
  /** Comprehension percentage (0–100) to drive Felix's color changes. */
  comprehensionPercent?: number;
  onReady?: () => void;
}

const GOLD = new THREE.Color("#f5b301");

export const PetLive = forwardRef<PetLiveHandle, PetLiveProps>(
  ({ glbFile, size, idleClip = "Idle_A", tint, comprehensionPercent, onReady }, ref) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
    const currentRef = useRef<THREE.AnimationAction | null>(null);
    const idleRef = useRef(idleClip);
    idleRef.current = idleClip;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);
    const origMapsRef = useRef<(THREE.Texture | null)[]>([]);
    // Cache of recoloured skin textures, keyed by "hue|sat", per material index.
    const skinCacheRef = useRef<Map<string, THREE.Texture>[]>([]);
    const tintRef = useRef<MascotTint | undefined>(tint);

    const play = (name: string, loop = false) => {
      const a = actionsRef.current[name];
      if (!a) return;
      if (currentRef.current && currentRef.current !== a) {
        currentRef.current.fadeOut(0.15);
      }
      a.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !loop;
      a.fadeIn(0.15).play();
      currentRef.current = a;
      if (!loop) {
        const dur = a.getClip().duration * 1000;
        setTimeout(() => play(idleRef.current, true), dur + 80);
      }
    };

    useImperativeHandle(ref, () => ({ play: (clip) => play(clip) }));

    // Build (and cache) a recoloured copy of a material's original texture.
    const recolouredSkin = (i: number, hue: number, sat: number): THREE.Texture | null => {
      const orig = origMapsRef.current[i];
      const img = orig?.image as (HTMLImageElement | ImageBitmap | undefined);
      if (!orig || !img || !("width" in img)) return orig;
      const key = `${Math.round(hue)}|${sat.toFixed(2)}`;
      const cache = (skinCacheRef.current[i] ??= new Map());
      const hit = cache.get(key);
      if (hit) return hit;
      const canvas = document.createElement("canvas");
      canvas.width = (img as { width: number }).width;
      canvas.height = (img as { height: number }).height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return orig;
      ctx.filter = `hue-rotate(${hue}deg) saturate(${sat})`;
      ctx.drawImage(img as CanvasImageSource, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = orig.colorSpace;
      tex.flipY = orig.flipY;
      tex.wrapS = orig.wrapS;
      tex.wrapT = orig.wrapT;
      tex.needsUpdate = true;
      cache.set(key, tex);
      return tex;
    };

    // Apply the current tint's *discrete* parts (skin texture / map swap).
    const applySkin = (t: MascotTint | undefined) => {
      if (!matsRef.current.length) return;
      matsRef.current.forEach((m, i) => {
        if (t?.god) {
          m.map = recolouredSkin(i, -55, 1.6); // gold skin
        } else if (t && t.hueRotate !== undefined) {
          m.map = recolouredSkin(i, t.hueRotate, t.saturate ?? 1);
        } else {
          m.map = t?.color ? null : origMapsRef.current[i];
        }
        m.needsUpdate = true;
      });
    };

    useEffect(() => {
      // If comprehensionPercent is provided, calculate hue-rotate for Felix's color change
      let effectiveTint = tint;
      if (comprehensionPercent !== undefined) {
        // 0% = red (hue -100), 100% = green (hue ~18)
        const hueRotate = -100 + (comprehensionPercent / 100) * 118;
        const saturate = 1 + (comprehensionPercent / 100) * 0.25;
        effectiveTint = { ...tint, hueRotate, saturate };
      }
      tintRef.current = effectiveTint;
      applySkin(effectiveTint);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tint?.hueRotate, tint?.saturate, tint?.god, tint?.color, comprehensionPercent]);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      let disposed = false;
      let raf = 0;
      let mixer: THREE.AnimationMixer | null = null;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0.6, 0.5, 3.2);
      camera.lookAt(0, 0.05, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x2e5d3a, 2.4));
      const dir = new THREE.DirectionalLight(0xfff7e0, 2.2);
      dir.position.set(2, 4, 3);
      scene.add(dir);

      new GLTFLoader().load(glbFile, (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const s = box.getSize(new THREE.Vector3());
        model.scale.setScalar(1.7 / Math.max(s.x, s.y, s.z));
        const c = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
        model.position.sub(c);
        scene.add(model);

        const mats: THREE.MeshStandardMaterial[] = [];
        const origMaps: (THREE.Texture | null)[] = [];
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          list.forEach((m) => {
            const std = m as THREE.MeshStandardMaterial;
            if (std && "emissive" in std) {
              mats.push(std);
              origMaps.push(std.map ?? null);
            }
          });
        });
        matsRef.current = mats;
        origMapsRef.current = origMaps;
        skinCacheRef.current = mats.map(() => new Map());
        applySkin(tintRef.current);

        mixer = new THREE.AnimationMixer(model);
        const actions: Record<string, THREE.AnimationAction> = {};
        for (const clip of gltf.animations) {
          actions[clip.name] = mixer.clipAction(clip);
        }
        actionsRef.current = actions;
        play(idleRef.current, true);
        onReadyRef.current?.();
      });

      const clock = new THREE.Clock();
      const tmpColor = new THREE.Color();
      const tmpEmissive = new THREE.Color();
      const white = new THREE.Color(0xffffff);
      const tick = () => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        const dt = clock.getDelta();
        mixer?.update(dt);

        const t = tintRef.current;
        if (t && matsRef.current.length) {
          const time = clock.elapsedTime;
          const skinMode = t.god || t.hueRotate !== undefined;
          if (t.god) {
            // gold skin with a gentle golden self-glow; the blue "divine"
            // halo is supplied by the surrounding aura, keeping the skin gold.
            tmpColor.copy(white);
            tmpEmissive.copy(GOLD);
          } else if (skinMode) {
            tmpColor.copy(white); // let the recoloured texture show true
            tmpEmissive.set(t.emissive ?? "#000000");
          } else {
            tmpColor.set(t.color ?? "#ffffff");
            tmpEmissive.set(t.emissive ?? t.color ?? "#000000");
          }
          const targetIntensity = t.god
            ? 0.4 + 0.15 * Math.sin(time * 5)
            : t.emissiveIntensity ?? (skinMode ? 0.12 : 0.3);
          const lerp = 1 - Math.pow(0.5, dt * 6);
          matsRef.current.forEach((m) => {
            m.color.lerp(tmpColor, lerp);
            m.emissive.lerp(tmpEmissive, lerp);
            m.emissiveIntensity += (targetIntensity - m.emissiveIntensity) * lerp;
          });
        }

        renderer.render(scene, camera);
      };
      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        renderer.dispose();
        renderer.domElement.remove();
        actionsRef.current = {};
        currentRef.current = null;
        matsRef.current = [];
        origMapsRef.current = [];
        skinCacheRef.current = [];
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [glbFile, size]);

    return <div ref={hostRef} style={{ width: size, height: size }} />;
  },
);
PetLive.displayName = "PetLive";
