import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived pass for OUR renderer to fetch the studio's Pro script.
 *
 * The headless Chrome doing an export has no session cookie, so `/api/render`
 * — which has already checked the caller's plan — mints one of these into the
 * render's own input props. It is `<expiry>.<signature>`: valid only until
 * `expiry`, only for the Pro script (the domain prefix), and forgeable only
 * with `AUTH_SECRET`. Without a secret there is no token, and a Pro export
 * fails rather than fetching unauthenticated. Same scheme as `pro-sample.ts`.
 */
const SECRET = process.env.AUTH_SECRET;
/** Longer than the longest render the queue allows, short enough to be useless leaked. */
export const STUDIO_PRO_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function signature(expiry: number): string {
  return createHmac("sha256", SECRET ?? "")
    .update(`studio-pro:${expiry}`)
    .digest("base64url")
    .slice(0, 43);
}

export function mintStudioProToken(now = Date.now()): string | null {
  if (!SECRET) return null;
  const expiry = now + STUDIO_PRO_TOKEN_TTL_MS;
  return `${expiry}.${signature(expiry)}`;
}

export function verifyStudioProToken(
  token: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!SECRET || !token) return false;
  const [raw, sig] = token.split(".");
  const expiry = Number(raw);
  if (!sig || !/^\d{13}$/.test(raw ?? "") || expiry < now) return false;
  const expected = Buffer.from(signature(expiry));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
