// Three.js scene that stages the gift unboxing:
// 1. Present sits closed. Recipient taps → Present plays its rigged `Open` clip.
// 2. Confetti burst + light flash.
// 3. Present fades out as the hedgehog fades in from below on a spring,
//    plays `Sit`, then `Clicked` (looks up), then loops `Bounce`.
// 4. Rose + tulip fade in on either side.
// Optional accessories (sneakers/hat) equipped by the gift creator are
// attached to the hedgehog just before it fades in.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import gsap from "gsap";
import confetti from "canvas-confetti";
import { attachAccessories } from "@/lib/petAccessoryLoader";

const PRESENT_GLB = "/gifts/Present.glb";
const DEFAULT_PET_GLB = "/pets/Hedgehog_Animations.glb";
const ROSE_GLB = "/gifts/Rose.glb";
const TULIP_GLB = "/gifts/Tulip.glb";

export interface GiftUnboxHandle {
  open: () => void;
}

interface GiftUnboxSceneProps {
  /** GLB path for the pet being gifted. Defaults to the hedgehog. */
  petGlb?: string;
  accessories?: string[];
  /** Show the rose + tulip alongside the pet. Off by default. */
  showFlowers?: boolean;
  onReady?: () => void;
  onOpenComplete?: () => void;
  size?: number;
}

export const GiftUnboxScene = forwardRef<GiftUnboxHandle, GiftUnboxSceneProps>(
  ({ petGlb = DEFAULT_PET_GLB, accessories = [], showFlowers = false, onReady, onOpenComplete, size = 320 }, ref) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const openFnRef = useRef<() => void>(() => {});

    useImperativeHandle(ref, () => ({
      open: () => openFnRef.current(),
    }));

    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onOpenCompleteRef = useRef(onOpenComplete);
    onOpenCompleteRef.current = onOpenComplete;
    const accessoriesKey = accessories.join(",");

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      let disposed = false;
      let raf = 0;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0.6, 3.6);
      camera.lookAt(0, 0.1, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x2b1e3a, 2.6));
      const key = new THREE.DirectionalLight(0xfff2d6, 2.6);
      key.position.set(2, 4, 3);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xff9ec7, 1.2);
      rim.position.set(-3, 2, -2);
      scene.add(rim);

      // Small ground disc so shadows/flowers sit believably
      const groundGeom = new THREE.CircleGeometry(1.4, 48);
      const groundMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.12,
      });
      const ground = new THREE.Mesh(groundGeom, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.55;
      scene.add(ground);

      // Flash sprite for the reveal moment
      const flashMat = new THREE.SpriteMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const flash = new THREE.Sprite(flashMat);
      flash.scale.set(2.5, 2.5, 1);
      flash.position.set(0, 0.1, 0.3);
      scene.add(flash);

      const loader = new GLTFLoader();

      let mixerPresent: THREE.AnimationMixer | null = null;
      let presentOpenAction: THREE.AnimationAction | null = null;
      let mixerHedgehog: THREE.AnimationMixer | null = null;
      let presentModel: THREE.Object3D | null = null;
      let hedgehogModel: THREE.Object3D | null = null;
      const hedgehogActions: Record<string, THREE.AnimationAction> = {};
      let roseModel: THREE.Object3D | null = null;
      let tulipModel: THREE.Object3D | null = null;
      let opened = false;
      let cleanupAccessories: (() => void) | null = null;

      // Ready fires once both the box and the hedgehog are loaded. Flowers
      // load in parallel and appear later, so they don't gate the button.
      const readyCounter = { count: 0, target: 2, fired: false };
      const maybeReady = () => {
        readyCounter.count += 1;
        if (readyCounter.count >= readyCounter.target && !readyCounter.fired && !disposed) {
          readyCounter.fired = true;
          onReadyRef.current?.();
        }
      };

      const normaliseAndCentre = (obj: THREE.Object3D, targetHeight: number) => {
        const box = new THREE.Box3().setFromObject(obj);
        const s = box.getSize(new THREE.Vector3());
        const scale = targetHeight / Math.max(s.y, 1e-4);
        obj.scale.setScalar(scale);
        const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
        obj.position.sub(new THREE.Vector3(c.x, box.min.y * scale, c.z));
      };

      const setOpacity = (obj: THREE.Object3D, opacity: number) => {
        obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if (!m) return;
            const mm = m as THREE.MeshStandardMaterial;
            mm.transparent = true;
            mm.opacity = opacity;
            mm.depthWrite = opacity > 0.9;
          });
        });
      };

      // --- Present ---
      loader.load(PRESENT_GLB, (gltf) => {
        if (disposed) return;
        presentModel = gltf.scene;
        normaliseAndCentre(presentModel, 0.9);
        presentModel.position.y = -0.55;
        setOpacity(presentModel, 1);
        scene.add(presentModel);

        mixerPresent = new THREE.AnimationMixer(presentModel);
        const openClip = gltf.animations[0];
        if (openClip) {
          // Prime the clip to first frame so the box shows closed until we open it.
          presentOpenAction = mixerPresent.clipAction(openClip);
          presentOpenAction.setLoop(THREE.LoopOnce, 1);
          presentOpenAction.clampWhenFinished = true;
          presentOpenAction.play();
          presentOpenAction.paused = true;
          presentOpenAction.time = 0;
        }
        maybeReady();
      });

      // --- Pet (whichever pet the gift is for) ---
      loader.load(petGlb, async (gltf) => {
        if (disposed) return;
        hedgehogModel = gltf.scene;
        normaliseAndCentre(hedgehogModel, 0.85);
        hedgehogModel.position.y = -0.55;
        hedgehogModel.visible = false; // hidden inside the box until reveal
        setOpacity(hedgehogModel, 0);
        scene.add(hedgehogModel);

        mixerHedgehog = new THREE.AnimationMixer(hedgehogModel);
        for (const clip of gltf.animations) {
          hedgehogActions[clip.name] = mixerHedgehog.clipAction(clip);
        }

        if (accessories.length > 0) {
          cleanupAccessories = await attachAccessories(hedgehogModel, accessories);
          if (disposed) {
            cleanupAccessories?.();
            cleanupAccessories = null;
            return;
          }
          // Start accessories invisible; they fade in with the hedgehog.
          setOpacityForAccessories(0);
        }
        maybeReady();
      });

      const setOpacityForAccessories = (opacity: number) => {
        if (!hedgehogModel) return;
        hedgehogModel.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if (m?.userData?.noTint) {
              const mm = m as THREE.MeshStandardMaterial;
              mm.transparent = true;
              mm.opacity = opacity;
            }
          });
        });
      };

      // --- Flowers (rose + tulip) — optional ---
      if (showFlowers) loader.load(ROSE_GLB, (gltf) => {
        if (disposed) return;
        roseModel = gltf.scene;
        normaliseAndCentre(roseModel, 0.55);
        roseModel.position.set(-0.85, -0.55, 0.1);
        roseModel.rotation.y = 0.35;
        setOpacity(roseModel, 0);
        roseModel.visible = false;
        scene.add(roseModel);
      });

      if (showFlowers) loader.load(TULIP_GLB, (gltf) => {
        if (disposed) return;
        tulipModel = gltf.scene;
        normaliseAndCentre(tulipModel, 0.7);
        tulipModel.position.set(0.85, -0.55, 0.1);
        tulipModel.rotation.y = -0.4;
        setOpacity(tulipModel, 0);
        tulipModel.visible = false;
        scene.add(tulipModel);
      });

      openFnRef.current = () => {
        if (opened) return;
        opened = true;

        // Kick the present open animation forward.
        if (presentOpenAction) {
          presentOpenAction.paused = false;
          presentOpenAction.timeScale = 1.0;
          presentOpenAction.reset();
          presentOpenAction.setLoop(THREE.LoopOnce, 1);
          presentOpenAction.clampWhenFinished = true;
          presentOpenAction.play();
        }

        // Confetti burst mid-open
        window.setTimeout(() => {
          if (disposed) return;
          const rect = renderer.domElement.getBoundingClientRect();
          confetti({
            particleCount: 90,
            spread: 65,
            startVelocity: 34,
            origin: {
              x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight,
            },
            colors: ["#ff5c8a", "#ffb3c6", "#ffffff", "#ffd166", "#c74b6b"],
            disableForReducedMotion: true,
          });
        }, 550);

        // Light flash
        gsap.to(flashMat, {
          opacity: 0.85,
          duration: 0.15,
          delay: 0.6,
          onComplete: () => {
            gsap.to(flashMat, { opacity: 0, duration: 0.35 });
          },
        });

        // Present fades out
        if (presentModel) {
          const box = { v: 1 };
          gsap.to(box, {
            v: 0,
            duration: 0.5,
            delay: 0.75,
            onUpdate: () => presentModel && setOpacity(presentModel, box.v),
            onComplete: () => presentModel && (presentModel.visible = false),
          });
        }

        // Hedgehog reveal
        window.setTimeout(() => {
          if (disposed || !hedgehogModel) return;
          hedgehogModel.visible = true;
          hedgehogModel.position.y = -0.95;

          // Fade in
          const fh = { v: 0 };
          gsap.to(fh, {
            v: 1,
            duration: 0.55,
            onUpdate: () => {
              if (!hedgehogModel) return;
              setOpacity(hedgehogModel, fh.v);
              setOpacityForAccessories(fh.v);
            },
          });

          // Spring pop-up
          gsap.to(hedgehogModel.position, {
            y: -0.55,
            duration: 0.75,
            ease: "back.out(1.7)",
          });

          // Animation sequence: Sit → Clicked → Bounce (loop)
          const play = (name: string, loop: boolean, then?: () => void) => {
            const a = hedgehogActions[name];
            if (!a || !mixerHedgehog) return;
            a.reset()
              .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
              .fadeIn(0.2)
              .play();
            a.clampWhenFinished = !loop;
            if (then) {
              const dur = a.getClip().duration * 1000;
              window.setTimeout(then, dur + 60);
            }
          };

          play("Sit", false, () => {
            play("Clicked", false, () => {
              play("Bounce", true);
              onOpenCompleteRef.current?.();
            });
          });
        }, 900);

        // Flowers fade in (only when the gift includes them)
        if (showFlowers) window.setTimeout(() => {
          if (disposed) return;
          [roseModel, tulipModel].forEach((flower, i) => {
            if (!flower) return;
            flower.visible = true;
            const f = { v: 0 };
            gsap.to(f, {
              v: 1,
              duration: 0.6,
              delay: i * 0.12,
              onUpdate: () => flower && setOpacity(flower, f.v),
            });
          });
        }, 1600);
      };

      // Idle sway of the closed box (so it doesn't sit dead until opened)
      const clock = new THREE.Clock();
      const tick = () => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        const dt = clock.getDelta();
        const t = clock.elapsedTime;
        mixerPresent?.update(dt);
        mixerHedgehog?.update(dt);
        if (presentModel && !opened) {
          presentModel.rotation.y = Math.sin(t * 0.9) * 0.15;
          presentModel.position.y = -0.55 + Math.sin(t * 1.6) * 0.02;
        }
        if (hedgehogModel && opened) {
          hedgehogModel.rotation.y = Math.sin(t * 0.6) * 0.2;
        }
        renderer.render(scene, camera);
      };
      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        cleanupAccessories?.();
        renderer.dispose();
        renderer.domElement.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, accessoriesKey, petGlb, showFlowers]);

    return (
      <div
        ref={hostRef}
        style={{ width: size, height: size }}
        className="mx-auto"
      />
    );
  }
);
GiftUnboxScene.displayName = "GiftUnboxScene";
