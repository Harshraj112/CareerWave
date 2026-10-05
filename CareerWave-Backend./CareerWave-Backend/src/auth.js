/**
 * auth.js — verifies the Auth0 access token the React app sends as
 * `Authorization: Bearer <jwt>`. RS256 verification uses Node's built-in
 * crypto + Auth0's JWKS endpoint, so no extra JWT dependency is needed.
 *
 * AUTH_DISABLED=true is for local development and automated tests only:
 * every request is treated as user "dev-user" (or the X-Dev-User header).
 */
import crypto from "crypto";

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache = { keys: null, fetchedAt: 0, domain: null };

function b64urlJson(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

async function getSigningKey(domain, kid, forceRefresh = false) {
  const stale = Date.now() - jwksCache.fetchedAt > JWKS_TTL_MS || jwksCache.domain !== domain;
  if (!jwksCache.keys || stale || forceRefresh) {
    const res = await fetch(`https://${domain}/.well-known/jwks.json`);
    if (!res.ok) throw new Error(`Could not fetch Auth0 JWKS (${res.status})`);
    const body = await res.json();
    jwksCache = { keys: body.keys || [], fetchedAt: Date.now(), domain };
  }
  const jwk = jwksCache.keys.find((k) => k.kid === kid);
  if (!jwk && !forceRefresh) return getSigningKey(domain, kid, true); // key rotation
  if (!jwk) throw new Error("Signing key not found");
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

export async function verifyAuth0Token(token, { domain, audience }) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [h, p, s] = parts;
  const header = b64urlJson(h);
  if (header.alg !== "RS256") throw new Error(`Unsupported token algorithm ${header.alg}`);

  const key = await getSigningKey(domain, header.kid);
  const valid = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"));
  if (!valid) throw new Error("Invalid token signature");

  const claims = b64urlJson(p);
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== `https://${domain}/`) throw new Error("Token issuer mismatch");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audience && !aud.includes(audience)) throw new Error("Token audience mismatch");
  if (typeof claims.exp === "number" && claims.exp < now - 60) throw new Error("Token expired");
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) throw new Error("Token not yet valid");
  return claims;
}

export function createAuthMiddleware(authConfig) {
  if (authConfig.disabled) {
    console.warn("⚠️  AUTH_DISABLED=true — every request is accepted as a dev user. Never use this in production.");
    return (req, _res, next) => {
      const sub = String(req.get("x-dev-user") || "dev-user").slice(0, 120);
      req.user = { sub, email: req.get("x-dev-email") || null };
      next();
    };
  }

  if (!authConfig.domain || !authConfig.audience) {
    console.error("❌ AUTH0_DOMAIN and AUTH0_AUDIENCE must be set (or AUTH_DISABLED=true for local development).");
  }

  return async (req, res, next) => {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "unauthorized", message: "Sign in to continue." });
    try {
      const claims = await verifyAuth0Token(match[1], authConfig);
      req.user = { sub: claims.sub, email: claims.email || claims["https://careerwave.app/email"] || null };
      next();
    } catch (err) {
      console.warn("[auth] rejected token:", err.message);
      res.status(401).json({ error: "unauthorized", message: "Your session has expired. Please sign in again." });
    }
  };
}
