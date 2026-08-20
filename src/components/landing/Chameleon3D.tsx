import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { getPetById } from "@/lib/pets";

/**
 * The chameleon, in real 3D — the same rigged model /landingpage2 uses.
 *
 * Model choice matters here. The raw upload in brand/models is a 20 MB static
 * sculpt: untextured (baseColorFactor 0.5 grey, zero images) and with zero
 * animation clips. The chameleon pet (/pets/Chameleon_Animations.glb) is what
 * the pet system ships: 227 KB, properly textured, and rigged with 18 clips.
 *
 * Built directly on three (already a dependency) rather than <model-viewer>,
 * which is only available via a CDN <script> in index.html — any blocked or
 * slow CDN killed the 3D silently. The npm build isn't installable either:
 * model-viewer@3 wants three@^0.163 and @4 wants ^0.183, while the pet system
 * pins ^0.169.
 *
 * Falls back to the flat mascot only if WebGL is genuinely unavailable or the
 * model fails to load.
 */
/** The chameleon pet. Sourced from the registry so the path can't drift. */
const MODEL = getPetById("chameleon")?.glbFile ?? "/pets/Chameleon_Animations.glb";
const IDLE = "Idle_A";
/** Played on click, if present. */
const POKE = "Clicked";

/**
 * Tier colour is applied as a hue rotation rather than by repainting the
 * meshes: the model ships textured (white eye, darker flank stripes) and
 * overwriting its material flattens all of that away. Hue rotation leaves
 * greys and whites untouched because they carry no saturation, so the eye
 * stays white while the body shifts red → orange → green.
 * Matches the mapping PetLive uses for the same model.
 *
 * `gold` is the celebration-only state used by the landing hero — it is not a
 * deck, so it never appears on a word.
 */
export type Chameleon3DTier = ChameleonTier | "gold";

const TIER_HUE: Record<Chameleon3DTier, number> = {
  red: -130,
  orange: -95,
  green: 0,
  gold: -62,
};

const TIER_SAT: Record<Chameleon3DTier, number> = {
  red: 1.15,
  orange: 1.1,
  green: 1,
  gold: 1.5,
};

export const Chameleon3D = ({
  tier = "green",
  size = 360,
  className = "",
}: {
  tier?: Chameleon3DTier;
  size?: number;
  className?: string;
}) => {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  // Colour is a CSS filter on the canvas, so a tier change cross-fades instead
  // of tearing down WebGL and re-downloading the model.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.style.filter = `hue-rotate(${TIER_HUE[tier]}deg) saturate(${TIER_SAT[tier]})`;
  }, [tier]);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setFailed(true);
      return;
    }

    let raf = 0;
    let disposed = false;

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.transition = "filter .7s ease";
    renderer.domElement.style.filter = `hue-rotate(${TIER_HUE[tier]}deg) saturate(${TIER_SAT[tier]})`;
    canvasRef.current = renderer.domElement;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.2, 3.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223322, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x34c759, 1.5);
    rim.position.set(-3, 1.5, -2);
    scene.add(rim);

    const pivot = new THREE.Group();
    scene.add(pivot);

    // Pointer swing — target values eased toward each frame.
    let targetY = 0;
    let targetX = 0;
    let curY = 0;
    let curX = 0;
    let dragging = false;

    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      targetY = nx * 0.7;
      targetX = THREE.MathUtils.clamp(ny * 0.4, -0.5, 0.5);
    };
    const onEnter = () => (dragging = true);
    const onLeave = () => {
      dragging = false;
      targetX = 0;
    };

    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerenter", onEnter);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const mixerRef: { current: THREE.AnimationMixer | null } = { current: null };
    const clock = new THREE.Clock();

    // setMeshoptDecoder is harmless for this model and keeps the loader able to
    // read meshopt-compressed GLBs if one is ever swapped in.
    const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

    gltfLoader.load(
      MODEL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;

        // Frame the model: centre it and scale so its largest axis fills view.
        const box = new THREE.Box3().setFromObject(model);
        const sizeV = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        // 1.6 rather than 2: this chameleon is long (nose-to-curled-tail), so
        // filling the frame edge-to-edge clipped the tail as the model spun.
        const scale = 1.6 / Math.max(sizeV.x, sizeV.y, sizeV.z);
        model.scale.setScalar(scale);
        model.position.sub(centre.multiplyScalar(scale));

        // Materials are left exactly as authored — see TIER_HUE above.
        pivot.add(model);

        if (gltf.animations?.length) {
          const mixer = new THREE.AnimationMixer(model);
          // The pet rig ships 18 clips and clip 0 is "Attack"; idle is the
          // right resting state for a landing-page mascot.
          const pick = (name: string) =>
            gltf.animations.find((c) => c.name === name) ?? null;
          const idle = pick(IDLE) ?? gltf.animations[0];
          mixer.clipAction(idle).play();
          mixerRef.current = mixer;

          // Poke it — plays the click clip once, then settles back to idle.
          const poke = pick(POKE);
          if (poke) {
            renderer.domElement.addEventListener("pointerdown", () => {
              const a = mixer.clipAction(poke);
              a.reset();
              a.setLoop(THREE.LoopOnce, 1);
              a.clampWhenFinished = true;
              a.play();
              window.setTimeout(() => a.fadeOut(0.35), poke.duration * 1000);
            });
          }
        }
      },
      undefined,
      () => !disposed && setFailed(true),
    );

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      mixerRef.current?.update(dt);

      // Idle spin unless the pointer is steering it.
      if (!dragging) targetY += dt * 0.35;
      curY += (targetY - curY) * 0.07;
      curX += (targetX - curX) * 0.07;
      pivot.rotation.y = curY;
      pivot.rotation.x = curX;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerenter", onEnter);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [size, tier]);

  if (failed) {
    return (
      <div className={className} style={{ width: size }}>
        <ChameleonMascot tier={tier} />
      </div>
    );
  }

  return <div ref={host} className={className} style={{ width: size, height: size }} />;
};

export default Chameleon3D;
