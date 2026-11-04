import assert from "node:assert/strict";
import { hasActivePro } from "../src/lib/proAccess";
import { proOnly } from "../src/lib/mcp/pro";
import type { ToolContext } from "@lovable.dev/mcp-js";
const now = Date.parse("2026-11-04T06:17:00Z");
assert.equal(hasActivePro({ is_pro: false }, now), false, "Free accounts cannot use Pro AI connections");
assert.equal(hasActivePro(null, now), false, "Missing profiles fail closed");
assert.equal(hasActivePro({ is_pro: true }, now), true, "Permanent Pro grants have access");
assert.equal(hasActivePro({ is_pro: true, pro_expires_at: "2026-11-05T00:00:00Z" }, now), true, "Unexpired Pro grants have access");
assert.equal(hasActivePro({ is_pro: true, pro_expires_at: "2026-11-03T00:00:00Z" }, now), false, "Expired Pro grants are denied");
assert.equal(hasActivePro({ is_pro: true, pro_expires_at: "not-a-date" }, now), false, "Invalid expiry fails closed");
console.log("Pro AI entitlement rules passed");

process.env.SUPABASE_URL = "https://example.invalid";
process.env.SUPABASE_ANON_KEY = "test-public-key";
const originalFetch = globalThis.fetch;
let called = 0;
let allowed = false;
globalThis.fetch = async () => new Response(JSON.stringify({ is_pro: allowed, pro_expires_at: null }), { headers: { "Content-Type": "application/json" } });
const ctx = { isAuthenticated: () => true, getUserId: () => "test-user", getToken: () => "test-token" } as unknown as ToolContext;
const wrapped = proOnly({ handler: async () => { called++; return { content: [{ type: "text" as const, text: "allowed" }] }; } });
try {
  assert.equal((await wrapped.handler(undefined, ctx)).isError, true, "Free MCP callers receive a tool error");
  assert.equal(called, 0, "Free MCP callers never execute the tool");
  allowed = true;
  await wrapped.handler(undefined, ctx);
  assert.equal(called, 1, "Pro MCP callers execute the tool");
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "lookup failed" }), { status: 403 });
  assert.equal((await wrapped.handler(undefined, ctx)).isError, true, "Permission lookup failure denies the call");
  assert.equal(called, 1, "Lookup failure never executes the tool");
  console.log("MCP execution gate passed");
} finally { globalThis.fetch = originalFetch; }