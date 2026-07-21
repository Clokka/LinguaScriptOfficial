// Live three.js viewer for a pet GLB with imperative animation control.
// Fetches the real model from public/pets/ and crossfades between clips.
//
// Optional `tint` drives a magical colour-state look: the model's material is
// recoloured (and glows via emissive) and smoothly lerps toward the target
// each frame, so red→orange→green transitions animate. `god` mode oscillates
// between gold and blue at high intensity for a hyper/"god" state.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface MascotTint {
  /** Base colour the body lerps toward, e.g. "#ef4444". */
  color: string;
  /** Emissive glow colour (defaults to a dimmed `color`). */
  emissive?: string;
  /** Emissive strength, 0–~2. Default 0.35. */
  emissiveIntensity?: number;
  /** Keep the original baseColor texture (muddies strong tints). Default false. */
  keepMap?: boolean;
  /** Hyper state: oscillate gold↔blue at high glow, ignoring `color`. */
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
  onReady?: () => void;
}

const GOLD = new THREE.Color("#ffd014");
const BLUE = new THREE.Color("#3b82f6");

export const PetLive = forwardRef<PetLiveHandle, PetLiveProps>(
  ({ glbFile, size, idleClip = "Idle_A", tint, onReady }, ref) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
    const currentRef = useRef<THREE.AnimationAction | null>(null);
    const idleRef = useRef(idleClip);
    idleRef.current = idleClip;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    // Tint plumbing: the loaded materials + the live target the tick lerps to.
    const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);
    const origMapsRef = useRef<(THREE.Texture | null)[]>([]);
    const tintRef = useRef<MascotTint | undefined>(tint);
    tintRef.current = tint;

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

        // Collect materials so tinting can recolour + glow them.
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
        applyTintImmediate(tintRef.current);

        mixer = new THREE.AnimationMixer(model);
        const actions: Record<string, THREE.AnimationAction> = {};
        for (const clip of gltf.animations) {
          actions[clip.name] = mixer.clipAction(clip);
        }
        actionsRef.current = actions;
        play(idleRef.current, true);
        onReadyRef.current?.();
      });

      // Seed the material to the target instantly (avoids a colour flash on load).
      const applyTintImmediate = (t: MascotTint | undefined) => {
        if (!t) return;
        const col = new THREE.Color(t.color);
        matsRef.current.forEach((m, i) => {
          m.map = t.keepMap ? origMapsRef.current[i] : null;
          m.color.copy(col);
          m.emissive.copy(new THREE.Color(t.emissive ?? t.color));
          m.emissiveIntensity = t.emissiveIntensity ?? 0.35;
          m.needsUpdate = true;
        });
      };

      const clock = new THREE.Clock();
      const tmpColor = new THREE.Color();
      const tmpEmissive = new THREE.Color();
      const tick = () => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        const dt = clock.getDelta();
        mixer?.update(dt);

        // Smoothly lerp materials toward the current tint target each frame.
        const t = tintRef.current;
        if (t && matsRef.current.length) {
          const time = clock.elapsedTime;
          if (t.god) {
            const k = 0.5 + 0.5 * Math.sin(time * 2.2); // gold↔blue
            tmpColor.copy(GOLD).lerp(BLUE, k);
            tmpEmissive.copy(tmpColor);
          } else {
            tmpColor.set(t.color);
            tmpEmissive.set(t.emissive ?? t.color);
          }
          const targetIntensity = t.god
            ? 1.4 + 0.5 * Math.sin(time * 6)
            : t.emissiveIntensity ?? 0.35;
          const lerp = 1 - Math.pow(0.5, dt * 6); // ~frame-rate independent
          matsRef.current.forEach((m, i) => {
            if (t.keepMap && origMapsRef.current[i] && m.map !== origMapsRef.current[i]) {
              m.map = origMapsRef.current[i];
              m.needsUpdate = true;
            } else if (!t.keepMap && m.map) {
              m.map = null;
              m.needsUpdate = true;
            }
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
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [glbFile, size]);

    return <div ref={hostRef} style={{ width: size, height: size }} />;
  },
);
PetLive.displayName = "PetLive";
