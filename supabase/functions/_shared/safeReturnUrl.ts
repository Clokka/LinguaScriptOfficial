// Stripe sends the customer to whatever return URL we give it. That URL used
// to come straight from the browser, so anyone could make a real Stripe page
// bounce people to any website they liked. Only our own sites are allowed now;
// anything else falls back to the given default.

const ALLOWED_HOSTS = new Set([
  "linguascript.co.uk",
  "www.linguascript.co.uk",
  "localhost",
  "127.0.0.1",
]);

// Deliberately no "*.lovable.app": anyone can make a free site there, so it
// would still be an open door. Checkouts started from a Lovable preview
// return to the live site instead. To allow a specific preview, add its exact
// hostname to ALLOWED_HOSTS.
const ALLOWED_HOST_SUFFIXES: string[] = [];

export function safeReturnUrl(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 2000) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return fallback;
  }
  const host = url.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) return fallback;
  if (ALLOWED_HOSTS.has(host) || ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    // Return the original string, not url.toString(): Stripe's
    // {CHECKOUT_SESSION_ID} placeholder must reach Stripe untouched.
    return candidate;
  }
  return fallback;
}
