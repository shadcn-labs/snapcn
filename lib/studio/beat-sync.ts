import { type Clip, MAX_TOTAL_FRAMES } from "@/lib/video-editor/types";
import type { Track } from "./music";
import { SCENES } from "./scene-data";

/**
 * Cut a timeline to a track.
 *
 * What "on the beat" means here, and why each rule exists (every one is a
 * failure from a film the user rejected — see the Nov 23 notes):
 *
 * 1. **Every cut sits on a beat of the measured grid.** Boundaries are placed in
 *    beat units and rounded to frames ONCE, cumulatively — never per scene — so
 *    rounding a 13.85-frame beat can't drift: the 20th cut is as close to its
 *    beat as the first (≤ half a frame, 16.7ms at 30fps).
 * 2. **A cut lands on content.** Each clip starts at its measured first content
 *    frame (`trimBefore`), so no cut shows a blank intro — a dip to nothing on
 *    the beat reads as a mistake, exactly where the ear is listening hardest.
 * 3. **The scene's hit lands on a beat too.** A slot is a whole number of
 *    beats (bars preferred) and the clip's `speed` — only within the range its
 *    control allows, and only on components that honour it — is chosen so that
 *    the moment the scene lands (title settles, button clicks) falls on a beat
 *    while its useful span still fits the slot.
 * 4. **Video frame 0 is a downbeat, and the drop lands on the reveal.** The
 *    track is trimmed to a downbeat so the music's arrival in full meets the
 *    second scene (the name), not the hook. Kept inside the track's length.
 * 5. **Cards change on beats.** `punch-lines` gets per-card holds of whole
 *    beats, nearest its designed 1.6s card.
 *
 * Pure and deterministic: the same clips and track give the same cut, and the
 * function never reads the network or the clock.
 */

export interface SyncResult {
  clips: Clip[];
  /** Seconds into the track that video frame 0 plays. */
  trimStart: number;
  /** Seconds, per cut, between the cut and its beat — the acceptance check. */
  cutErrorsMs: number[];
}

const FPS = 30;
/** Speeds the studio will use: beyond these a scene reads as broken, not fast. */
const SPEED_FLOOR = 0.8;
const SPEED_CEIL = 1.4;
/** Shortest slot anyone can read a title card in. */
const MIN_SLOT_SECONDS = 1.2;

interface Plan {
  beats: number;
  speed: number;
  /** In-point, in the component's own frames. */
  in: number;
}

/**
 * Slot (in beats), speed and in-point for one clip, by scoring every option.
 *
 * The hit landing on a beat is weighted above filling the slot exactly: most
 * scenes hold their last frame, so running a little long is invisible, while a
 * hit between beats is what reads as "off". Cutting before the scene has
 * landed is the one thing worse than either.
 *
 * A component whose speed can't move (no control, or one it ignores) can still
 * put its hit on a beat by starting a few frames into its entrance — at most
 * half a beat, and never more than a third of the entrance, so the move still
 * reads as a move and not as a jump.
 */
function planClip(clip: Clip, beatFrames: number): Plan {
  const d = SCENES[clip.slug];
  if (!d) {
    return {
      beats: Math.max(2, Math.round(clip.durationInFrames / beatFrames)),
      speed: 1,
      in: 0,
    };
  }
  const first = d.firstContentFrame;
  const lo = d.speed ? Math.max(d.speed.min, SPEED_FLOOR) : 1;
  const hi = d.speed ? Math.min(d.speed.max, SPEED_CEIL) : 1;
  const maxSkip = Math.max(
    0,
    Math.floor(Math.min(beatFrames / 2, (d.hitFrame - first) / 3)),
  );
  const minBeats = Math.max(
    2,
    Math.ceil((MIN_SLOT_SECONDS * FPS) / beatFrames),
  );

  let best: Plan & { cost: number } = {
    beats: minBeats,
    speed: 1,
    in: first,
    cost: Number.POSITIVE_INFINITY,
  };
  for (let skip = 0; skip <= maxSkip; skip++) {
    const start = first + skip;
    const useful = Math.max(1, d.exitStartFrame - start);
    const hit = Math.max(0, d.hitFrame - start);
    for (let beats = minBeats; beats <= 32; beats++) {
      const slot = beats * beatFrames;
      for (let s = lo; s <= hi + 1e-9; s += 0.01) {
        const shown = slot * s;
        const hitAt = hit / s; // timeline frames after the cut
        if (hitAt >= slot - 2) continue; // never cut before the scene lands
        const under = shown < useful ? (useful - shown) / useful : 0;
        const over = shown > useful ? (shown - useful) / useful : 0;
        const hitBeats = hitAt / beatFrames;
        const hitErr = Math.abs(hitBeats - Math.round(hitBeats));
        // A scene that changes on a fixed step (words, cards, titles) is
        // on the beat only if every change is: the step must be a whole
        // number of half-beats, and the first change must land on one.
        let stepErr = 0;
        if (d.step && !d.step.prop) {
          const per = d.step.frames / s / beatFrames;
          const first = Math.max(0, d.step.first - start) / s / beatFrames;
          stepErr =
            Math.abs(per * 2 - Math.round(per * 2)) / 2 +
            Math.abs(first * 2 - Math.round(first * 2)) / 2;
        }
        const shape = beats % 4 === 0 ? 0 : beats % 2 === 0 ? 0.05 : 0.3;
        const cost =
          under * 3 +
          over * (d.exitStartFrame < d.naturalFrames ? 1 : 0.35) +
          // Step phase outweighs the hit when there is one: a run of
          // changes off the beat is heard several times, a hit once.
          (d.step && !d.step.prop ? stepErr * 6 + hitErr * 1 : hitErr * 2.5) +
          shape +
          Math.abs(s - 1) * 0.5 +
          (skip / Math.max(1, d.hitFrame - first)) * 0.8;
        if (cost < best.cost) best = { beats, speed: s, in: start, cost };
      }
    }
  }
  return {
    beats: best.beats,
    speed: Number(best.speed.toFixed(2)),
    in: best.in,
  };
}

/** Beats per `punch-lines` card: whole beats, nearest its designed 48 frames. */
function cardBeats(
  clip: Clip,
  beatFrames: number,
): { cards: number; per: number } | null {
  if (clip.slug !== "punch-lines") return null;
  const cards = String(clip.props.script ?? "")
    .split("|")
    .filter((c) => c.trim()).length;
  if (cards === 0) return null;
  return { cards, per: Math.max(2, Math.round(48 / beatFrames)) };
}

export function syncToTrack(clips: Clip[], track: Track): SyncResult {
  const beatFrames = track.beat * FPS;

  // Pass 1 — each clip's slot in beats, speed and in-point.
  const plans = clips.map((clip) => {
    const card = cardBeats(clip, beatFrames);
    if (card)
      return { clip, card, beats: card.cards * card.per, speed: 1, in: 0 };
    return { clip, card: null, ...planClip(clip, beatFrames) };
  });
  const startBeats: number[] = [];
  let totalBeats = 0;
  for (const p of plans) {
    startBeats.push(totalBeats);
    totalBeats += p.beats;
  }

  // Pass 2 — where in the track frame 0 plays. On a downbeat, with the drop
  // on the reveal (scene 2) when the track is long enough to allow it.
  const bar = track.beat * track.beatsPerBar;
  const totalSeconds = totalBeats * track.beat;
  const revealBar = Math.floor((startBeats[1] ?? 0) / track.beatsPerBar);
  const lastStartBar = Math.floor(
    (track.durationSeconds - track.firstDownbeat - totalSeconds - 1) / bar,
  );
  const j = Math.max(0, Math.min(track.dropBar - revealBar, lastStartBar));
  const trimStart = track.firstDownbeat + j * bar;
  // The timeline starts audio on a whole frame (`trimBefore` is in frames), so
  // the grid the viewer hears is shifted by that rounding. Place the cuts on
  // the heard grid, not the ideal one: beat k is at k·beat − shift.
  const shift = Math.round(trimStart * FPS) / FPS - trimStart;

  // Pass 3 — frame edges, rounded once on the running total.
  const out: Clip[] = [];
  const cutErrorsMs: number[] = [];
  let prevEdge = 0;
  plans.forEach((p, i) => {
    const endBeats = startBeats[i] + p.beats;
    const ideal = (endBeats * track.beat - shift) * FPS;
    const edge = Math.max(prevEdge + 1, Math.round(ideal));
    if (edge > MAX_TOTAL_FRAMES) return;
    cutErrorsMs.push(((edge - ideal) / FPS) * 1000);
    const hasSpeed = Boolean(SCENES[p.clip.slug]?.speed);
    let props = p.clip.props;
    if (p.card) {
      // Card edges on the heard grid, in frames from this clip's start.
      const holds: number[] = [];
      let prev = prevEdge;
      for (let k = 1; k <= p.card.cards; k++) {
        const at =
          k === p.card.cards
            ? edge
            : Math.round(
                ((startBeats[i] + k * p.card.per) * track.beat - shift) * FPS,
              );
        holds.push(at - prev);
        prev = at;
      }
      props = { ...props, holds: holds.join(","), speed: 1 };
    } else if (hasSpeed) {
      props = { ...props, speed: p.speed };
    }
    // A step the component times by a prop, not by `speed` (card-rail's
    // flick interval): set it to the whole number of beats nearest its own.
    const step = SCENES[p.clip.slug]?.step;
    if (step?.prop) {
      const beats = Math.max(1, Math.round(step.frames / beatFrames));
      props = { ...props, [step.prop]: Math.round(beats * beatFrames) };
    }
    const { trimBefore: _old, ...rest } = p.clip;
    out.push({
      ...rest,
      props,
      durationInFrames: edge - prevEdge,
      // In timeline frames; the component runs at `speed`.
      ...(p.in > 0 ? { trimBefore: Math.round(p.in / p.speed) } : {}),
    });
    prevEdge = edge;
  });

  return { clips: out, trimStart: Number(trimStart.toFixed(4)), cutErrorsMs };
}
