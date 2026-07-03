const modules = import.meta.glob("@/assets/mieoframes/*.asset.json", { eager: true }) as Record<
  string,
  { default: { url: string; original_filename: string } }
>;

const frames = Object.entries(modules)
  .map(([path, mod]) => {
    const name = path.split("/").pop()!.replace(".asset.json", "");
    return { name, url: mod.default.url };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export default function MieoFrames() {
  return (
    <main className="min-h-dvh bg-background text-foreground px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Mieo Figma Frames</h1>
          <p className="text-muted-foreground mt-2">
            {frames.length} frames from the Mieo — Language Learning Figma file.
          </p>
        </header>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0">
          {frames.map((f) => (
            <li key={f.name} className="glass-panel p-4">
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="block focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              >
                <img
                  src={f.url}
                  alt={`Mieo frame: ${f.name.replace(/-/g, " ").replace(".png", "")}`}
                  loading="lazy"
                  className="w-full h-auto rounded-lg bg-muted"
                />
                <p className="mt-3 text-sm font-medium truncate">{f.name}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
