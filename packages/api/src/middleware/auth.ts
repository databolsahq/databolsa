import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { UnauthorizedError } from "./errors";

/**
 * Identity the core data API carries per request. The core holds no user data: a
 * Principal is just enough to log and, later, branch on coarse access policy.
 * Key minting, sessions and hosted-user concerns live outside this package.
 */
export type Principal =
  | { kind: "anonymous" }
  // direct API-key access (self-host / internal): the core checks an env-listed key.
  | { kind: "api-key"; keyId: string }
  // a trusted gateway authenticated the caller upstream and forwards the identity.
  | { kind: "gateway"; id: string | null; tier: string | null };

/** Hono env so handlers/middleware can read `c.get("principal")` with types. */
export type AppEnv = { Variables: { principal: Principal } };

const KEYS = (process.env.DATABOLSA_API_KEYS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Shared secret proving a request came through the control-plane gateway. When set,
// a request bearing the matching `X-DataBolsa-Gateway` header is trusted and its
// forwarded principal adopted; the core never looks a user up.
const GATEWAY_SECRET = (process.env.INTERNAL_GATEWAY_SECRET ?? "").trim();

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch — guard first (length isn't secret).
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function bearer(c: Context): string {
  const header = c.req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

// Never log a full key — first 6 chars are enough to correlate.
function maskKey(key: string): string {
  return key.length <= 8 ? "key:…" : `${key.slice(0, 6)}…`;
}

/**
 * Resolve the request's Principal via a pluggable strategy, in precedence order:
 *   1. **gateway-trust** — `INTERNAL_GATEWAY_SECRET` set AND a matching
 *      `X-DataBolsa-Gateway` header → adopt the forwarded principal (hosted mode,
 *      behind a gateway). The principal id/tier come from headers the gateway
 *      sets; any hosted enforcement already happened upstream.
 *   2. **env API-key** — `DATABOLSA_API_KEYS` set → require `Authorization: Bearer
 *      <key>` (self-host / direct internal access).
 *   3. **open** — neither configured → anonymous (open self-host default).
 * `/v1/health` is always public (the contract marks it `security: []`).
 *
  * This is the seam: standing up a gateway is config-only (set the gateway secret)
  * and needs no code change here. The core stays stateless about users either way.
 */
export async function apiKeyAuth(c: Context<AppEnv>, next: Next) {
  const principal = resolvePrincipal(c);
  c.set("principal", principal);
  // Observable identity for debugging / the gateway seam (not the cached body).
  c.header("x-databolsa-principal-kind", principal.kind);
  return next();
}

function resolvePrincipal(c: Context<AppEnv>): Principal {
  if (c.req.path === "/v1/health") return { kind: "anonymous" };

  // 1) trusted gateway forwards an already-authenticated principal.
  if (GATEWAY_SECRET) {
    const presented = c.req.header("x-databolsa-gateway");
    if (presented && constantTimeEqual(presented, GATEWAY_SECRET)) {
      return {
        kind: "gateway",
        id: c.req.header("x-databolsa-principal-id") ?? null,
        tier: c.req.header("x-databolsa-tier") ?? null,
      };
    }
    // Secret configured but this request didn't carry it. With direct API keys ALSO
    // configured we fall through to the key check below (mixed gateway + direct-key
    // deploy). Without any keys, hosted mode expects every caller to come through the
    // gateway — falling through to anonymous would expose protected data to anyone who
    // reaches the core directly, so reject instead of failing open.
    if (KEYS.length === 0) {
      throw new UnauthorizedError(
        "acesso direto não autorizado — requisições devem passar pelo gateway",
      );
    }
  }

  // 2) direct API-key check.
  if (KEYS.length > 0) {
    const token = bearer(c);
    if (!token || !KEYS.includes(token)) {
      throw new UnauthorizedError("API key ausente ou inválida (use Authorization: Bearer <key>)");
    }
    return { kind: "api-key", keyId: maskKey(token) };
  }

  // 3) open self-host.
  return { kind: "anonymous" };
}
