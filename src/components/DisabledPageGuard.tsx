// Pages switched off in HQ (Today → Landing pages) send visitors to the
// homepage. Uses the cached live config (src/lib/site/config.ts); a stale cache
// refreshes in the background. HQ's preview adds ?hqpreview=1 to see it anyway.
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageLoading } from "@/components/PageLoading";
import { cacheIsFresh, fetchLiveSite, readCache } from "@/lib/site/config";

const WAIT_MS = 900;
const norm = (p: string) => p.toLowerCase().replace(/\/+$/, "") || "/";

export function DisabledPageGuard({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const path = norm(pathname);
  const [disabled, setDisabled] = useState<string[] | undefined>(() => {
    const c = readCache();
    return cacheIsFresh(c) ? c!.config?.disabledPages ?? [] : undefined;
  });

  useEffect(() => {
    if (disabled !== undefined) return;
    let done = false;
    const fallback = () => { if (!done) { done = true; setDisabled(readCache()?.config?.disabledPages ?? []); } };
    const t = setTimeout(fallback, WAIT_MS);
    fetchLiveSite().then((c) => { if (!done) { done = true; setDisabled(c?.disabledPages ?? []); } }).catch(fallback);
    return () => clearTimeout(t);
  }, [disabled]);

  // Landing pages wait (max 0.9 s) on a first visit so a switched-off page never flashes.
  if (disabled === undefined) return /^\/landing/.test(path) ? <PageLoading /> : <>{children}</>;
  if (path !== "/" && disabled.includes(path) && !/[?&]hqpreview=1/.test(search)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
