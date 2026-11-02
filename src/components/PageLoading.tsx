// The page-loading style chosen in HQ ("Go live" → Page loading screen),
// remembered on the device by src/lib/site/config.ts. Tiny on purpose.
function pageLoaderStyle(): string {
  try { return localStorage.getItem("ls.site.pageLoader") || "skeleton"; } catch { return "skeleton"; }
}
const DECK = ["#FF453A", "#FF9F0A", "#34C759", "#FFD60A"];

function BrandLoading() {
  return (
    <main className="min-h-screen bg-background grid place-items-center px-6" aria-busy="true" aria-label="Loading LinguaScript">
      <style>{`@keyframes lsPL{0%,100%{color:inherit}25%{color:${DECK[0]}}50%{color:${DECK[1]}}75%{color:${DECK[2]}}}
        @keyframes lsPB{50%{transform:translateY(-6px)}}
        @media (prefers-reduced-motion:reduce){.ls-pl *{animation:none!important}}`}</style>
      <div className="ls-pl flex flex-col items-center gap-4 text-foreground">
        <img src="/logo.svg" alt="" width="72" height="72" style={{ animation: "lsPB 1.6s ease-in-out infinite" }} />
        <span className="text-3xl font-black tracking-tight" aria-hidden="true">
          {"LinguaScript".split("").map((c, i) => (
            <span key={i} style={{ animation: `lsPL 2.4s ${i * 0.08}s infinite` }}>{c}</span>
          ))}
        </span>
      </div>
    </main>
  );
}

export function PageLoading() {
  if (pageLoaderStyle() === "brand") return <BrandLoading />;
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