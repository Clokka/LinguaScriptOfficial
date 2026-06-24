import { useState, Suspense, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const PETS = [
  { id: 'Colobus', name: 'Colobus' },
  { id: 'Gecko',   name: 'Gecko'   },
  { id: 'Herring', name: 'Finn'    },
  { id: 'Inkfish', name: 'Ink'     },
  { id: 'Muskrat', name: 'Mico'    },
  { id: 'Pudu',    name: 'Pudu'    },
  { id: 'Sparrow', name: 'Chip'    },
  { id: 'Taipan',  name: 'Sage'    },
];

function PetModel({ petId, isHovered }: { petId: string; isHovered: boolean }) {
  const { scene, animations } = useGLTF(`/pets/${petId}_Animations.glb`);
  const { actions, names } = useAnimations(animations, scene);

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
      actions[clickedName].reset().setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
      actions[clickedName].play();
    } else if (!isHovered && idleName && actions[idleName]) {
      if (clickedName && actions[clickedName]) actions[clickedName].stop();
      actions[idleName].reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [isHovered, actions, names]);

  return <primitive object={scene} />;
}

interface PetSelectionProps {
  onSelect: (petId: string, petName: string) => void;
  onSkip: () => void;
}

export default function PetSelection({ onSelect, onSkip }: PetSelectionProps) {
  const [view, setView] = useState<'choose' | 'name'>('choose');
  const [hoveredId, setHoveredId] = useState<string>(PETS[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [petName, setPetName] = useState('');

  const previewPet = PETS.find(p => p.id === hoveredId) ?? PETS[0];
  const selectedPet = PETS.find(p => p.id === selectedId);

  if (view === 'name' && selectedPet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 180, height: 220, borderRadius: 16, overflow: 'hidden', background: 'rgba(249,115,22,0.06)', border: '1.5px solid #fed7aa' }}>
          <Canvas camera={{ position: [0, 1.2, 3.5], fov: 45 }} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
            <ambientLight intensity={1.5} />
            <directionalLight position={[2, 4, 2]} intensity={2} />
            <Suspense fallback={null}>
              <PetModel petId={selectedPet.id} isHovered={false} />
            </Suspense>
          </Canvas>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            What will you name {selectedPet.name}?
          </p>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Your companion will celebrate every word you learn.
          </p>
          <input
            type="text"
            value={petName}
            onChange={e => setPetName(e.target.value)}
            placeholder={selectedPet.name}
            maxLength={20}
            autoFocus
            style={{
              display: 'block', width: 220, margin: '0 auto 16px',
              padding: '10px 16px', borderRadius: 12,
              border: '1.5px solid #f97316', fontSize: 15,
              outline: 'none', textAlign: 'center',
            }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => setView('choose')}
              style={{ padding: '10px 20px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#555', cursor: 'pointer', fontSize: 14 }}
            >
              Back
            </button>
            <button
              onClick={() => onSelect(selectedPet.id, petName.trim() || selectedPet.name)}
              style={{ padding: '10px 24px', borderRadius: 999, background: '#f97316', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Confirm <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Left: pet grid */}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          Hover to preview — your companion celebrates every milestone.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {PETS.map(pet => (
            <button
              key={pet.id}
              onMouseEnter={() => setHoveredId(pet.id)}
              onClick={() => {
                setSelectedId(pet.id);
                setHoveredId(pet.id);
                setPetName('');
                setView('name');
              }}
              style={{
                padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                border: selectedId === pet.id ? '2px solid #f97316' : hoveredId === pet.id ? '2px solid #fed7aa' : '1.5px solid #f3e8ff',
                background: selectedId === pet.id ? '#fff7ed' : hoveredId === pet.id ? '#fff7ed' : '#fafafa',
                fontSize: 12, fontWeight: 600, color: '#333',
                transition: 'all 0.15s',
              }}
            >
              {pet.name}
            </button>
          ))}
        </div>
        <button
          onClick={onSkip}
          style={{ fontSize: 13, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Skip for now
        </button>
      </div>

      {/* Right: single 3D preview */}
      <div style={{ width: 160, flexShrink: 0 }}>
        <div style={{ width: 160, height: 200, borderRadius: 16, overflow: 'hidden', background: 'rgba(249,115,22,0.06)', border: '1.5px solid #fed7aa' }}>
          <Canvas camera={{ position: [0, 1.2, 3.5], fov: 45 }} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
            <ambientLight intensity={1.5} />
            <directionalLight position={[2, 4, 2]} intensity={2} />
            <Suspense fallback={null}>
              <PetModel key={hoveredId} petId={hoveredId} isHovered />
            </Suspense>
          </Canvas>
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#333', marginTop: 8 }}>
          {previewPet.name}
        </p>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 2 }}>
          Click to choose
        </p>
      </div>
    </div>
  );
}
