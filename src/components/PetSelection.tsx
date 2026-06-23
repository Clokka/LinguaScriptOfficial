import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import PetPreviewCard from './PetPreviewCard';

const PETS = [
  { id: 'Colobus',  name: 'Colobus' },
  { id: 'Gecko',    name: 'Gecko'   },
  { id: 'Herring',  name: 'Finn'    },
  { id: 'Inkfish',  name: 'Ink'     },
  { id: 'Muskrat',  name: 'Mico'    },
  { id: 'Pudu',     name: 'Pudu'    },
  { id: 'Sparrow',  name: 'Chip'    },
  { id: 'Taipan',   name: 'Sage'    },
];

interface PetSelectionProps {
  onSelect: (petId: string, petName: string) => void;
  onSkip: () => void;
}

export default function PetSelection({ onSelect, onSkip }: PetSelectionProps) {
  const [view, setView] = useState<'choose' | 'name'>('choose');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [petName, setPetName] = useState('');

  const selectedPet = PETS.find(p => p.id === selectedId);

  if (view === 'name' && selectedPet) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 200, height: 260, margin: '0 auto 24px' }}>
          <PetPreviewCard
            petId={selectedPet.id}
            petName={selectedPet.name}
            isSelected
            isHovered={false}
            onClick={() => {}}
            onHoverChange={() => {}}
          />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 6 }}>
          What will you name your companion?
        </h2>
        <p style={{ fontSize: 14, color: '#777', marginBottom: 24 }}>
          Your pet will celebrate every milestone with you.
        </p>
        <input
          type="text"
          value={petName}
          onChange={e => setPetName(e.target.value)}
          placeholder={`e.g. ${selectedPet.name}`}
          maxLength={20}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 280,
            margin: '0 auto 20px',
            padding: '10px 16px',
            borderRadius: 12,
            border: '1.5px solid #f97316',
            fontSize: 15,
            outline: 'none',
            textAlign: 'center',
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => setView('choose')}
            style={{
              padding: '10px 20px', borderRadius: 999,
              border: '1px solid #e5e7eb', background: '#fff',
              color: '#555', cursor: 'pointer', fontSize: 14,
            }}
          >
            Back
          </button>
          <button
            onClick={() => onSelect(selectedPet.id, petName.trim() || selectedPet.name)}
            style={{
              padding: '10px 24px', borderRadius: 999,
              background: '#f97316', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            Confirm <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 6 }}>
        Choose your companion
      </h2>
      <p style={{ fontSize: 14, color: '#777', marginBottom: 20 }}>
        Your pet celebrates every word you learn. Hover to see their personality.
      </p>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 24,
      }}>
        {PETS.map(pet => (
          <PetPreviewCard
            key={pet.id}
            petId={pet.id}
            petName={pet.name}
            isSelected={selectedId === pet.id}
            isHovered={hoveredId === pet.id}
            onClick={() => setSelectedId(pet.id)}
            onHoverChange={h => setHoveredId(h ? pet.id : null)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={onSkip}
          style={{
            padding: '10px 20px', borderRadius: 999,
            border: '1px solid #e5e7eb', background: '#fff',
            color: '#555', cursor: 'pointer', fontSize: 14,
          }}
        >
          Skip for now
        </button>
        <button
          disabled={!selectedId}
          onClick={() => setView('name')}
          style={{
            padding: '10px 24px', borderRadius: 999,
            background: selectedId ? '#f97316' : '#fed7aa',
            color: '#fff', border: 'none',
            cursor: selectedId ? 'pointer' : 'not-allowed',
            fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Choose companion <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
