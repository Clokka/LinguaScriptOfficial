export function PageLoading() {
  return (
    <main className="min-h-screen bg-background px-6 py-10" aria-busy="true" aria-label="Loading LinguaScript">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" width="48" height="48" />
          <span className="text-xl font-semibold text-foreground">LinguaScript</span>
        </div>
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-video rounded-lg bg-muted motion-safe:animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}