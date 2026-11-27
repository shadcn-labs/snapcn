import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { trackFor } from "@/lib/studio/music";

// Node runtime: streams a file off disk via node:fs.
export const runtime = "nodejs";

/**
 * GET /api/music/[slug] — stream a stock soundtrack.
 *
 * Read by the studio's track picker (preview), the Player, and the headless
 * Chrome doing an export. The slug must be in the measured library, so the path
 * is ours end to end; the caller names a track, never a file.
 *
 * The files live outside the repo (licensed audio): `STUDIO_MUSIC_DIR`, default
 * `media/music/` (gitignored). Range support matters — Chrome seeks within
 * audio, and without it re-fetches the whole file per seek.
 */
const MUSIC_DIR = process.env.STUDIO_MUSIC_DIR
  ? path.resolve(process.env.STUDIO_MUSIC_DIR)
  : path.join(process.cwd(), "media", "music");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const track = trackFor(slug);
  if (!track) return new Response("Not found", { status: 404 });
  const filePath = path.join(MUSIC_DIR, `${track.slug}.mp3`);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };
  const match = /^bytes=(\d*)-(\d*)$/.exec(
    request.headers.get("range")?.trim() ?? "",
  );
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (start <= end && end < size) {
      return new Response(
        Readable.toWeb(
          createReadStream(filePath, { start, end }),
        ) as ReadableStream,
        {
          status: 206,
          headers: {
            ...headers,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${size}`,
          },
        },
      );
    }
  }
  return new Response(
    Readable.toWeb(createReadStream(filePath)) as ReadableStream,
    { headers: { ...headers, "Content-Length": String(size) } },
  );
}
