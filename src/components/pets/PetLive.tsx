// Live three.js viewer for a pet GLB with imperative animation control.
// Fetches the real model from public/pets/ and crossfades between clips.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface PetLiveHandle {
  /** Play a clip by GLB name (e.g. "Bounce", "Spin", "Jump", "Roll"). */
  play: (clip: string) => void;
}

interface PetLiveProps {
  glbFile: string;
  size: number;
  idleClip?: string;
  onReady?: () => void;
}

export const PetLive = forwardRef<PetLiveHandle, PetLiveProps>(
  ({ glbFile, size, idleClip = "Idle_A", onReady }, ref) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
    const currentRef = useRef<THREE.AnimationAction | null>(null);
    const idleRef = useRef(idleClip);
    idleRef.current = idleClip;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

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
      const tick = () => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        mixer?.update(clock.getDelta());
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
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [glbFile, size]);

    return <div ref={hostRef} style={{ width: size, height: size }} />;
  },
);
PetLive.displayName = "PetLive";
