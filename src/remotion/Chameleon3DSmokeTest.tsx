import { Suspense } from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Chameleon3D } from "./Chameleon3D";

const STATIC_MODEL_URL = staticFile("brand/chameleon-optimised.glb");

/**
 * Renders the static (unrigged) chameleon model — brand/models/chameleon-
 * optimised.glb, copied to public/brand/ so it's servable at render time.
 * Needs setMeshoptDecoder() before loading: this GLB is meshopt-compressed
 * (EXT_meshopt_compression) and GLTFLoader throws without it configured.
 */
function StaticChameleon() {
  const gltf = useLoader(GLTFLoader, STATIC_MODEL_URL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  return <primitive object={gltf.scene} scale={2} />;
}

/**
 * Throwaway composition for validating the 3D chameleon pipeline in this
 * environment before it's wired into the full FeatureShowcase reel — see the
 * STATUS note at the top of Chameleon3D.tsx. Currently neither half below
 * produces visible pixels here (confirmed: a plain procedural mesh with the
 * same ThreeCanvas/lighting setup DOES render, so the gap is specific to
 * loaded-GLTF-mesh rendering in this sandbox's software WebGL, not the R3F/
 * ThreeCanvas pipeline itself). Delete once resolved and folded into the
 * real composition, or once confirmed to be a sandbox-only limitation.
 */
export const Chameleon3DSmokeTest = () => (
  <AbsoluteFill style={{ backgroundColor: "#08080B", flexDirection: "row" }}>
    <ThreeCanvas width={360} height={720}>
      <ambientLight intensity={1} />
      <directionalLight position={[2, 4, 3]} intensity={2} />
      <Suspense fallback={null}>
        <StaticChameleon />
      </Suspense>
    </ThreeCanvas>
    <Chameleon3D width={360} height={720} />
  </AbsoluteFill>
);

export default Chameleon3DSmokeTest;
