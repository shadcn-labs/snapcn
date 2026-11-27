import library from "./music-library.json";

/**
 * The studio's stock soundtracks, measured by `scripts/analyze-music.mts`.
 *
 * The user picks the track — by ear, from the list; the studio never swaps one
 * on analysis — and the studio cuts the video to it. Every number a cut needs
 * is in here: the beat grid (`offset + n·beat`, fitted to the audio's onsets
 * and phase-corrected to the attacks), the first downbeat, energy per bar, and
 * where the music arrives in full (`dropBar`).
 *
 * The audio itself is not in the repo. `/api/music/<slug>` serves it from
 * `STUDIO_MUSIC_DIR` (default `media/music/`, gitignored); a deploy can point
 * `NEXT_PUBLIC_MUSIC_BASE_URL` at a CDN instead.
 */

export interface Track {
  slug: string;
  title: string;
  artist: string;
  durationSeconds: number;
  bpm: number;
  /** Seconds per beat. */
  beat: number;
  /** First beat, seconds. */
  offset: number;
  /** First downbeat (beat 1 of a bar), seconds. */
  firstDownbeat: number;
  beatsPerBar: 4;
  fit: { hitRate: number; medianMs: number; madMs: number };
  barEnergyDb: number[];
  dropBar: number;
  introBars: number;
  lufs: number | null;
}

export const TRACKS = library as Track[];

const BY_SLUG = new Map(TRACKS.map((t) => [t.slug, t]));

export const trackFor = (slug: unknown): Track | undefined =>
  typeof slug === "string" ? BY_SLUG.get(slug) : undefined;

/** Where the browser and the renderer fetch a track. `origin` for the renderer. */
export function musicSrc(slug: string, origin = ""): string {
  const base = process.env.NEXT_PUBLIC_MUSIC_BASE_URL;
  return base
    ? `${base.replace(/\/$/, "")}/${slug}.mp3`
    : `${origin}/api/music/${slug}`;
}

/**
 * Volume that levels every track to the same loudness, so switching tracks
 * doesn't jump. -14 LUFS is a streaming platform's target; a voice-free bed
 * under titles sits a little under it. Capped at 1 — the player can't boost.
 */
export function levelledVolume(track: Track, target = -16): number {
  if (track.lufs === null) return 0.8;
  return Math.min(1, Math.max(0.2, 10 ** ((target - track.lufs) / 20)));
}

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Measured loudness, as the word a director would use. */
function energy(track: Track): string {
  if (track.lufs === null) return "medium";
  return track.lufs > -10 ? "loud" : track.lufs > -14 ? "medium" : "soft";
}

/**
 * The library as the storyboard reads it, to choose the soundtrack itself.
 * Facts only — tempo, length, how long before it arrives, how loud — so the
 * choice follows the brief's tone and the video's length, not a title.
 */
export const TRACKS_PROMPT = TRACKS.map(
  (t) =>
    `- ${t.slug} — "${t.title}" by ${t.artist} · ${Math.round(t.bpm)} BPM · ${fmt(t.durationSeconds)} · ${energy(t)} · full after ${t.introBars} bar${t.introBars === 1 ? "" : "s"}`,
).join("\n");
