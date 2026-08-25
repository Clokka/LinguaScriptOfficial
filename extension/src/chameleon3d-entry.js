// LinguaScript extension — 3D chameleon vendor entry.
//
// Bundled (see extension/BUILD.md) into extension/vendor/chameleon3d.bundle.js,
// a self-contained IIFE with no external deps, so it can be injected as a
// plain <script> into a Netflix/YouTube page from a content script.
//
// This is a faithful, non-React port of src/components/landing/Chameleon3D.tsx
// — same model (Chameleon_Animations.glb, the 227 KB textured/rigged pet
// asset, not the raw 20 MB brand sculpt), same hue-rotation tier technique,
// same camera/lighting rig. It exposes window.LSChameleon3D.mount(...)
// instead of being a React component.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const IDLE = "Idle_A";
const POKE = "Clicked";

// Matches TIER_HUE / TIER_SAT in Chameleon3D.tsx exactly.
const TIER_HUE = { red: -130, orange: -95, green: 0, gold: -62 };
const TIER_SAT = { red: 1.15, orange: 1.1, green: 1, gold: 1.5 };

/**
 * Mount the 3D chameleon into `container`.
 * @param {HTMLElement} container
 * @param {{ tier?: 'red'|'orange'|'green'|'gold', size?: number, glbUrl: string }} opts
 * @returns {{ dispose: () => void, setTier: (t: string) => void }}
 */
function mount(container, opts) {
  const size = opts.size || 220;
  const glbUrl = opts.glbUrl;
  let tier = opts.tier || "green";

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    return { dispose: () => {}, setTier: () => {} };
  }

  let raf = 0;
  let disposed = false;

  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.style.transition = "filter .7s ease";
  const applyFilter = () => {
    renderer.domElement.style.filter = `hue-rotate(${TIER_HUE[tier]}deg) saturate(${TIER_SAT[tier]})`;
  };
  applyFilter();
  container.appendChild(renderer.domElement);

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

  let targetY = 0;
  let targetX = 0;
  let curY = 0;
  let curX = 0;
  let dragging = false;

  const onMove = (e) => {
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

  let mixer = null;
  const clock = new THREE.Clock();
  const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  gltfLoader.load(
    glbUrl,
    (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const sizeV = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const scale = 1.6 / Math.max(sizeV.x, sizeV.y, sizeV.z);
      model.scale.setScalar(scale);
      model.position.sub(centre.multiplyScalar(scale));
      pivot.add(model);

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        const pick = (name) => gltf.animations.find((c) => c.name === name) || null;
        const idle = pick(IDLE) || gltf.animations[0];
        mixer.clipAction(idle).play();

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
    () => {},
  );

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    if (mixer) mixer.update(dt);
    if (!dragging) targetY += dt * 0.35;
    curY += (targetY - curY) * 0.07;
    curX += (targetX - curX) * 0.07;
    pivot.rotation.y = curY;
    pivot.rotation.x = curX;
    renderer.render(scene, camera);
  };
  tick();

  return {
    setTier(next) {
      tier = next;
      applyFilter();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerenter", onEnter);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mat = o.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

window.LSChameleon3D = { mount };
