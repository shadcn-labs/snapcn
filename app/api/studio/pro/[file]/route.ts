import { auth } from "@/auth";
import { planFor } from "@/lib/server/entitlements";
import {
  readStudioPro,
  STUDIO_PRO_FILES,
  type StudioProFile,
} from "@/lib/server/pro-registry";
import { verifyStudioProToken } from "@/lib/server/studio-pro-token";

export const runtime = "nodejs";

/**
 * GET /api/studio/pro/[file] — the studio's Pro script and its metadata.
 *
 * Two callers, and only two:
 * - a signed-in session whose plan unlocks components — the same people who
 *   can already install every Pro source file with their key, so serving
 *   them the compiled script exposes nothing new;
 * - our own renderer, carrying the short-lived token `/api/render` minted
 *   after checking the exporter's plan (it has no session).
 *
 * Everyone else gets 404, not 403: a free caller learns nothing about what's
 * there. Never cached by a shared cache.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!(file in STUDIO_PRO_FILES)) return notFound();

  const token = new URL(request.url).searchParams.get("t");
  let allowed = verifyStudioProToken(token);
  if (!allowed) {
    const session = await auth().catch(() => null);
    const userId = session?.user?.id ?? null;
    allowed = Boolean(userId) && (await planFor(userId)).limits.components;
  }
  if (!allowed) return notFound();

  const body = await readStudioPro(file as StudioProFile);
  if (body === null) return notFound();
  return new Response(body, {
    headers: {
      "Content-Type": STUDIO_PRO_FILES[file as StudioProFile],
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
