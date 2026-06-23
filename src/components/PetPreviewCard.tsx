import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

interface PetPreviewCardProps {
  petId: string;
  petName: string;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHoverChange: (hovered: boolean) => void;
}

function PetModel({ petId, isHovered }: { petId: string; isHovered: boolean }) {
  const url = `/pets/${petId}_Animations.glb`;
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, scene);
  const modelRef = useRef<THREE.Group>(null);

  // Scale and position model
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.8 / size.y;
    scene.scale.setScalar(scale);
    scene.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(scene);
    scene.position.y = -box2.min.y;
  }, [scene]);

  // Play idle_a on mount
  useEffect(() => {
    if (!actions || names.length === 0) return;
    const idleName = names.find(n => n.toLowerCase().includes('idle_a'))
      ?? names.find(n => n.toLowerCase().includes('idle'))
      ?? names[0];
    if (idleName && actions[idleName]) {
      actions[idleName].reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
    return () => { Object.values(actions).forEach(a => a?.stop()); };
  }, [actions, names]);

  // Swap animation on hover
  useEffect(() => {
    if (!actions || names.length === 0) return;
    const idleName = names.find(n => n.toLowerCase().includes('idle_a'))
      ?? names.find(n => n.toLowerCase().includes('idle'))
      ?? names[0];
    const clickedName = names.find(n => n.toLowerCase().includes('clicked'))
      ?? names.find(n => n.toLowerCase().includes('jump'))
      ?? names.find(n => n.toLowerCase().includes('wave'));

    if (isHovered && clickedName && actions[clickedName]) {
      if (idleName && actions[idleName]) actions[idleName].stop();
      actions[clickedName].reset().setLoop(THREE.LoopOnce, 1).play();
      actions[clickedName].clampWhenFinished = true;
    } else if (!isHovered && idleName && actions[idleName]) {
      if (clickedName && actions[clickedName]) actions[clickedName].stop();
      actions[idleName].reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [isHovered, actions, names]);

  useFrame((_, delta) => {
    // mixer update handled by useAnimations internally
  });

  return <primitive ref={modelRef} object={scene} />;
}

function LoadingBox() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#29B6F6" wireframe />
    </mesh>
  );
}

export default function PetPreviewCard({
  petId,
  petName,
  isSelected,
  isHovered,
  onClick,
  onHoverChange,
}: PetPreviewCardProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
        width: 140,
        height: 190,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        border: isSelected
          ? '1.5px solid #29B6F6'
          : '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: isSelected ? '0 0 18px rgba(41,182,246,0.25)' : 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: '#29B6F6',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 900,
            color: '#fff',
            zIndex: 2,
          }}
        >
          ✓
        </div>
      )}
      <div style={{ width: '100%', height: 150 }}>
        <Canvas
          camera={{ position: [0, 1.2, 3.5], fov: 45 }}
          style={{ background: 'transparent' }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={1.5} />
          <directionalLight position={[2, 4, 2]} intensity={2} />
          <Suspense fallback={<LoadingBox />}>
            <PetModel petId={petId} isHovered={isHovered} />
          </Suspense>
        </Canvas>
      </div>
      <div
        style={{
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          textAlign: 'center',
          padding: '6px 4px 8px',
          letterSpacing: 0.3,
        }}
      >
        {petName}
      </div>
    </div>
  );
}
