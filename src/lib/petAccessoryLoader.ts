import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getAccessoryById, type AccessoryMeta } from "./accessories";

// Bones we look for on Omabuarts pets (chameleon, hedgehog, etc.). Neither has
// a head bone, so hats use a computed head anchor instead.
const LEG_BONE_NAMES = ["leg.F.L", "leg.F.R", "leg.B.L", "leg.B.R"];
const EAR_BONE_NAMES = ["ear.L", "ear.R"];
const BODY_BONE_NAME = "body";

interface LoadedAccessory {
  meta: AccessoryMeta;
  scene: THREE.Object3D;
}

const cache = new Map<string, Promise<LoadedAccessory>>();
const loader = new GLTFLoader();

function loadAccessoryScene(meta: AccessoryMeta): Promise<LoadedAccessory> {
  const key = meta.id;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new Promise<LoadedAccessory>((resolve, reject) => {
    loader.load(
      meta.glbFile,
      (gltf) => resolve({ meta, scene: gltf.scene }),
      undefined,
      reject
    );
  });
  cache.set(key, p);
  return p;
}

// Every material on an accessory is flagged so PetLive's tint pass leaves it
// alone. Also enable transparency so the reveal fade-in works.
function markAccessoryMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (!m) return;
      m.userData.noTint = true;
      const std = m as THREE.MeshStandardMaterial;
      if ("transparent" in std) {
        std.transparent = true;
      }
    });
  });
}

// The sneakers GLB is a Sketchfab dump — 29 meshes across many `shoes.*`
// nodes plus a stray `pants_0`. Split into two shoe groups by clustering
// mesh centroids along the widest horizontal axis. Drop meshes whose
// bounding box is taller than wide (kills the pants).
function splitShoesScene(scene: THREE.Object3D): {
  leftShoe: THREE.Group;
  rightShoe: THREE.Group;
} {
  interface MeshEntry {
    mesh: THREE.Mesh;
    centroid: THREE.Vector3;
  }
  const entries: MeshEntry[] = [];
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    const size = new THREE.Vector3();
    bb.getSize(size);
    // Skip pants-like (taller than wide) meshes.
    const width = Math.max(size.x, size.z);
    if (size.y > width * 1.8) return;
    const c = new THREE.Vector3();
    bb.getCenter(c);
    // World-space centroid so grouping is stable regardless of nesting.
    mesh.updateWorldMatrix(true, false);
    c.applyMatrix4(mesh.matrixWorld);
    entries.push({ mesh, centroid: c });
  });

  const leftShoe = new THREE.Group();
  const rightShoe = new THREE.Group();
  leftShoe.name = "LeftShoe";
  rightShoe.name = "RightShoe";

  if (entries.length === 0) return { leftShoe, rightShoe };

  // Figure out which horizontal axis has the wider spread and cluster on it.
  const xs = entries.map((e) => e.centroid.x);
  const zs = entries.map((e) => e.centroid.z);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadZ = Math.max(...zs) - Math.min(...zs);
  const useX = spreadX >= spreadZ;
  const values = useX ? xs : zs;
  const mid = (Math.max(...values) + Math.min(...values)) / 2;

  entries.forEach((e) => {
    const v = useX ? e.centroid.x : e.centroid.z;
    const target = v < mid ? leftShoe : rightShoe;
    // Preserve local transform inside the group so the shoe still looks right.
    const cloned = e.mesh.clone();
    cloned.applyMatrix4(e.mesh.matrixWorld);
    target.add(cloned);
  });

  // If clustering collapsed everything to one side (rare), duplicate.
  if (leftShoe.children.length === 0) {
    rightShoe.children.forEach((c) => leftShoe.add(c.clone()));
  } else if (rightShoe.children.length === 0) {
    leftShoe.children.forEach((c) => rightShoe.add(c.clone()));
  }

  // Recentre each group at its own centre-bottom so scaling and placement
  // downstream work in local units.
  [leftShoe, rightShoe].forEach((g) => {
    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    box.getSize(size);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    centre.y = box.min.y;
    g.children.forEach((child) => {
      child.position.sub(centre);
    });
  });

  return { leftShoe, rightShoe };
}

function findBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (!hit && obj.name === name) hit = obj;
  });
  return hit;
}

/**
 * Attach accessories to a loaded pet model. Returns a disposer that removes
 * them again. Safe to call with an empty list.
 *
 * The pet's own animation clips (Bounce/Walk/etc.) drive bone motion, so
 * parenting the accessory to a bone means it moves with the pet for free.
 */
export async function attachAccessories(
  petRoot: THREE.Object3D,
  accessoryIds: string[]
): Promise<() => void> {
  if (accessoryIds.length === 0) return () => {};

  // Overall pet bounds tell us how big shoes/hats should be.
  const petBox = new THREE.Box3().setFromObject(petRoot);
  const petSize = new THREE.Vector3();
  petBox.getSize(petSize);
  const petHeight = petSize.y || 1;
  // Approximate a foot's real width — a fraction of pet height works
  // across every quadruped in the catalog.
  const footWidth = petHeight * 0.18;
  const headWidth = petSize.x * 0.6 || petHeight * 0.6;

  const added: THREE.Object3D[] = [];

  const metas = accessoryIds
    .map(getAccessoryById)
    .filter((m): m is AccessoryMeta => !!m);

  await Promise.all(
    metas.map(async (meta) => {
      const loaded = await loadAccessoryScene(meta);

      if (meta.id === "sneakers") {
        const { leftShoe, rightShoe } = splitShoesScene(loaded.scene.clone(true));
        [leftShoe, rightShoe].forEach(markAccessoryMaterials);
        attachShoes(petRoot, leftShoe, rightShoe, footWidth, added);
      } else if (meta.slot === "head") {
        const hat = loaded.scene.clone(true);
        markAccessoryMaterials(hat);
        attachHat(petRoot, hat, headWidth, added);
      } else if (meta.slot === "feet") {
        // Generic foot accessory that isn't the sneakers: use the whole scene
        // as a single shoe, mirrored across left/right.
        const one = loaded.scene.clone(true);
        markAccessoryMaterials(one);
        const other = loaded.scene.clone(true);
        markAccessoryMaterials(other);
        attachShoes(petRoot, one as THREE.Group, other as THREE.Group, footWidth, added);
      } else {
        const other = loaded.scene.clone(true);
        markAccessoryMaterials(other);
        petRoot.add(other);
        added.push(other);
      }
    })
  );

  return () => {
    added.forEach((n) => n.parent?.remove(n));
  };
}

function scaleToWidth(node: THREE.Object3D, targetWidth: number): number {
  const box = new THREE.Box3().setFromObject(node);
  const size = new THREE.Vector3();
  box.getSize(size);
  const currentWidth = Math.max(size.x, size.z, 1e-4);
  const s = targetWidth / currentWidth;
  node.scale.multiplyScalar(s);
  return s;
}

function attachShoes(
  petRoot: THREE.Object3D,
  leftShoe: THREE.Object3D,
  rightShoe: THREE.Object3D,
  footWidth: number,
  added: THREE.Object3D[]
) {
  // One shoe clone per leg bone. Left-side bones get the left shoe, right
  // side gets the right shoe, so the tread points outward correctly.
  LEG_BONE_NAMES.forEach((bone) => {
    const target = findBone(petRoot, bone);
    if (!target) return;
    const source = bone.endsWith(".L") ? leftShoe : rightShoe;
    const shoe = source.clone(true);
    scaleToWidth(shoe, footWidth * 1.6);

    // Sit the shoe at the bone with its half-height below origin so the
    // sole meets the ground the leg is standing on.
    const shoeBox = new THREE.Box3().setFromObject(shoe);
    const shoeSize = new THREE.Vector3();
    shoeBox.getSize(shoeSize);
    shoe.position.set(0, -shoeSize.y * 0.5, 0);

    // Face forward: front bones point +Z, back bones point -Z (approx).
    if (bone.startsWith("leg.B")) {
      shoe.rotation.y = Math.PI;
    }

    target.add(shoe);
    added.push(shoe);
  });
}

function attachHat(
  petRoot: THREE.Object3D,
  hat: THREE.Object3D,
  headWidth: number,
  added: THREE.Object3D[]
) {
  const body = findBone(petRoot, BODY_BONE_NAME) ?? petRoot;

  // Head-anchor: midpoint of ear bones if present (hedgehog), otherwise
  // top-front of the body's world bounds (chameleon and everything else).
  const anchor = new THREE.Object3D();
  anchor.name = "HeadAnchor";

  const earL = findBone(petRoot, EAR_BONE_NAMES[0]);
  const earR = findBone(petRoot, EAR_BONE_NAMES[1]);
  if (earL && earR) {
    const posL = new THREE.Vector3();
    const posR = new THREE.Vector3();
    earL.getWorldPosition(posL);
    earR.getWorldPosition(posR);
    const mid = posL.add(posR).multiplyScalar(0.5);
    body.worldToLocal(mid);
    anchor.position.copy(mid);
  } else {
    const bodyBox = new THREE.Box3().setFromObject(body);
    const bodySize = new THREE.Vector3();
    bodyBox.getSize(bodySize);
    const bodyCentre = new THREE.Vector3();
    bodyBox.getCenter(bodyCentre);
    // Top-front of the body: highest y, most forward z. Use world-space
    // then map back into body-local so the hat rides with body rotation.
    const worldTopFront = new THREE.Vector3(
      bodyCentre.x,
      bodyBox.max.y,
      bodyCentre.z + bodySize.z * 0.25
    );
    body.worldToLocal(worldTopFront);
    anchor.position.copy(worldTopFront);
  }

  body.add(anchor);

  scaleToWidth(hat, headWidth * 1.1);
  const hatBox = new THREE.Box3().setFromObject(hat);
  const hatSize = new THREE.Vector3();
  hatBox.getSize(hatSize);
  // Sit hat brim just above the anchor.
  hat.position.set(0, hatSize.y * 0.35, 0);
  hat.rotation.x = -0.12; // small forward tilt for character

  anchor.add(hat);
  added.push(hat, anchor);
}
