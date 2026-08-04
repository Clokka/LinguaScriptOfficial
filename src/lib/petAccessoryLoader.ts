import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getAccessoryById, type AccessoryMeta } from "./accessories";

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
  const hit = cache.get(meta.id);
  if (hit) return hit;
  const p = new Promise<LoadedAccessory>((resolve, reject) => {
    loader.load(
      meta.glbFile,
      (gltf) => resolve({ meta, scene: gltf.scene }),
      undefined,
      reject
    );
  });
  cache.set(meta.id, p);
  return p;
}

// Every material on an accessory is flagged so PetLive's tint pass leaves it
// alone; also enable transparency so the reveal fade-in works.
function markAccessoryMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Clone the material so we can mutate opacity per-instance without
    // affecting the cached shared material on other pets.
    const original = mesh.material;
    if (Array.isArray(original)) {
      mesh.material = original.map((m) => {
        const c = m.clone();
        c.userData.noTint = true;
        (c as THREE.MeshStandardMaterial).transparent = true;
        return c;
      });
    } else if (original) {
      const c = original.clone();
      c.userData.noTint = true;
      (c as THREE.MeshStandardMaterial).transparent = true;
      mesh.material = c;
    }
  });
}

// Center at origin, scale so its widest horizontal axis matches targetWidth.
function centerAndScale(node: THREE.Object3D, targetWidth: number) {
  let box = new THREE.Box3().setFromObject(node);
  const size = new THREE.Vector3();
  box.getSize(size);
  const width = Math.max(size.x, size.z, 1e-4);
  const scale = targetWidth / width;
  node.scale.multiplyScalar(scale);
  // Recompute after scaling, then center.
  box = new THREE.Box3().setFromObject(node);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  node.position.sub(centre);
}

function findBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (!hit && obj.name === name) hit = obj;
  });
  return hit;
}

/**
 * Attach accessories to a loaded pet. Returns a disposer.
 * Kept intentionally minimal — accessories are wholesale clones of the source
 * GLB, sized against the pet's own bounding box.
 */
export async function attachAccessories(
  petRoot: THREE.Object3D,
  accessoryIds: string[]
): Promise<() => void> {
  if (accessoryIds.length === 0) return () => {};

  const petBox = new THREE.Box3().setFromObject(petRoot);
  const petSize = new THREE.Vector3();
  petBox.getSize(petSize);
  const petHeight = Math.max(petSize.y, 1e-4);
  const petWidth = Math.max(petSize.x, petSize.z, petHeight);
  // Deliberately generous sizes so accessories can't hide inside the pet
  // mesh. Better too big than invisible.
  const footWidth = petHeight * 0.42;
  const headWidth = petWidth * 1.0;
  console.log("[gift] attaching accessories:", accessoryIds, "petSize:", petSize);

  const added: THREE.Object3D[] = [];
  const metas = accessoryIds
    .map(getAccessoryById)
    .filter((m): m is AccessoryMeta => !!m);

  await Promise.all(
    metas.map(async (meta) => {
      try {
        const loaded = await loadAccessoryScene(meta);
        if (meta.slot === "feet") {
          attachShoes(petRoot, loaded.scene, footWidth, added);
        } else if (meta.slot === "head") {
          attachHat(petRoot, loaded.scene, headWidth, added);
        }
      } catch (err) {
        console.error(`[accessories] failed to attach ${meta.id}`, err);
      }
    })
  );

  return () => {
    added.forEach((n) => n.parent?.remove(n));
  };
}

function attachShoes(
  petRoot: THREE.Object3D,
  sourceScene: THREE.Object3D,
  footWidth: number,
  added: THREE.Object3D[]
) {
  const foundBones: string[] = [];
  LEG_BONE_NAMES.forEach((bone) => {
    const target = findBone(petRoot, bone);
    if (!target) return;
    foundBones.push(bone);
    const shoe = sourceScene.clone(true);
    markAccessoryMaterials(shoe);
    centerAndScale(shoe, footWidth);
    const shoeBox = new THREE.Box3().setFromObject(shoe);
    const shoeSize = new THREE.Vector3();
    shoeBox.getSize(shoeSize);
    // Push the shoe well below the bone — leg bones are usually inside the
    // body mesh, so we need to extend clearly outside it.
    shoe.position.y -= shoeSize.y * 1.2;
    if (bone.startsWith("leg.B")) shoe.rotation.y = Math.PI;
    target.add(shoe);
    added.push(shoe);
  });
  console.log("[gift] shoes attached to bones:", foundBones);
}

function attachHat(
  petRoot: THREE.Object3D,
  sourceScene: THREE.Object3D,
  headWidth: number,
  added: THREE.Object3D[]
) {
  const body = findBone(petRoot, BODY_BONE_NAME) ?? petRoot;

  // Head-anchor: midpoint of ear bones if present (hedgehog), otherwise the
  // top of the body's world bounds (chameleon and anything else).
  const anchor = new THREE.Object3D();
  anchor.name = "HeadAnchor";
  const earL = findBone(petRoot, EAR_BONE_NAMES[0]);
  const earR = findBone(petRoot, EAR_BONE_NAMES[1]);
  if (earL && earR) {
    const posL = new THREE.Vector3();
    const posR = new THREE.Vector3();
    earL.getWorldPosition(posL);
    earR.getWorldPosition(posR);
    const mid = posL.clone().add(posR).multiplyScalar(0.5);
    body.worldToLocal(mid);
    anchor.position.copy(mid);
  } else {
    const bodyBox = new THREE.Box3().setFromObject(body);
    const bodyCentre = new THREE.Vector3();
    bodyBox.getCenter(bodyCentre);
    const worldTop = new THREE.Vector3(
      bodyCentre.x,
      bodyBox.max.y,
      bodyCentre.z
    );
    body.worldToLocal(worldTop);
    anchor.position.copy(worldTop);
  }
  body.add(anchor);
  added.push(anchor);

  const hat = sourceScene.clone(true);
  markAccessoryMaterials(hat);
  centerAndScale(hat, headWidth);
  const hatBox = new THREE.Box3().setFromObject(hat);
  const hatSize = new THREE.Vector3();
  hatBox.getSize(hatSize);
  // Sit the hat well above the anchor so its brim clears the pet's head.
  hat.position.y += hatSize.y * 0.8;
  hat.rotation.x = -0.15;
  anchor.add(hat);
  added.push(hat);
  console.log("[gift] hat attached, head anchor:", anchor.position.toArray());
}
