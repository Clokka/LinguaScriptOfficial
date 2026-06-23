import { useEffect, useState } from 'react';

const World = () => {
  const [petId, setPetId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('ls_pet');
    if (stored) setPetId(stored);
  }, []);

  const src = petId ? `/world.html?pet=${encodeURIComponent(petId)}` : '/world.html';

  return (
    <iframe
      src={src}
      style={{ width: '100vw', height: '100vh', border: 'none', display: 'block' }}
      title="Gem Island"
      allow="fullscreen"
    />
  );
};

export default World;
