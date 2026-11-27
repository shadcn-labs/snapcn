import { describe, expect, it } from "vitest";
import type { Clip } from "@/lib/video-editor/types";
import { syncToTrack } from "../beat-sync";
import { TRACKS } from "../music";
import { SCENES } from "../scene-data";

const clip = (slug: string, props: Record<string, unknown> = {}): Clip => ({
  id: slug,
  slug,
  props,
  durationInFrames: SCENES[slug]?.naturalFrames ?? 90,
});

// The Panelo first cut, as the studio cast it.
const PANELO: Clip[] = [
  clip("punch-lines", {
    script: "Built for clicks / not for agents | That changes now.",
  }),
  clip("text-reveal"),
  clip("laptop-frame"),
  clip("text-highlight"),
  clip("check-cycle"),
  clip("button-press"),
];

describe.each(TRACKS.map((t) => [t.slug, t] as const))("%s", (_slug, track) => {
  const { clips, trimStart, cutErrorsMs } = syncToTrack(PANELO, track);
  const bar = track.beat * 4;

  it("cuts every scene within half a frame of the beat the viewer hears", () => {
    expect(cutErrorsMs).toHaveLength(PANELO.length);
    for (const e of cutErrorsMs)
      expect(Math.abs(e)).toBeLessThanOrEqual(1000 / 60 + 1e-6);
  });

  it("starts the video on a downbeat, inside the track", () => {
    const bars = (trimStart - track.firstDownbeat) / bar;
    // trimStart is stored to 4 decimals.
    expect(Math.abs(bars - Math.round(bars))).toBeLessThan(1e-3);
    const seconds = clips.reduce((a, c) => a + c.durationInFrames, 0) / 30;
    if (seconds <= track.durationSeconds - track.firstDownbeat) {
      expect(trimStart + seconds).toBeLessThanOrEqual(track.durationSeconds);
    } else {
      // A track shorter than the video starts at its first downbeat and ends
      // early; the picker marks it too short.
      expect(trimStart).toBeCloseTo(track.firstDownbeat, 3);
    }
  });

  it("starts each clip on its first content frame", () => {
    for (const c of clips) {
      const first = SCENES[c.slug].firstContentFrame;
      const speed = typeof c.props.speed === "number" ? c.props.speed : 1;
      expect(Math.round((c.trimBefore ?? 0) * speed)).toBeGreaterThanOrEqual(
        first - 1,
      );
    }
  });

  it("changes punch-lines cards on the beats the viewer hears", () => {
    const shift = Math.round(trimStart * 30) / 30 - trimStart;
    const holds = String(clips[0].props.holds).split(",").map(Number);
    let edge = 0;
    for (const h of holds) {
      edge += h;
      const beats = (edge / 30 + shift) / track.beat;
      expect(
        Math.abs(beats - Math.round(beats)) * track.beat * 1000,
      ).toBeLessThanOrEqual(1000 / 60 + 1e-6);
    }
  });
});

it("lands most scene hits within a sixth of a beat", () => {
  const errs: number[] = [];
  for (const track of TRACKS) {
    const { clips, trimStart } = syncToTrack(PANELO, track);
    const shift = Math.round(trimStart * 30) / 30 - trimStart;
    let start = 0;
    for (const c of clips) {
      const d = SCENES[c.slug];
      if (c.slug === "punch-lines") {
        // Its hits are its card changes, checked above.
        start += c.durationInFrames;
        continue;
      }
      const speed = typeof c.props.speed === "number" ? c.props.speed : 1;
      const hitT =
        (start + (d.hitFrame / speed - (c.trimBefore ?? 0))) / 30 + shift;
      const beats = hitT / track.beat;
      errs.push(Math.abs(beats - Math.round(beats)));
      start += c.durationInFrames;
    }
  }
  errs.sort((a, b) => a - b);
  expect(errs[Math.floor(errs.length * 0.75)]).toBeLessThan(1 / 6);
});

describe("in-scene steps", () => {
  // Each periodic component alone and in a cut, against every track: the
  // changes inside the scene, not just the cuts, should land on the beat grid.
  const periodic = Object.entries(SCENES)
    .filter(([, d]) => d.step && !d.step.prop)
    .map(([slug]) => slug);

  it("lands most step changes within a sixth of a beat (half-beat grid)", () => {
    const errs: number[] = [];
    for (const track of TRACKS) {
      const clips = [clip("text-reveal"), ...periodic.map((s) => clip(s))];
      const { clips: out, trimStart } = syncToTrack(clips, track);
      const shift = Math.round(trimStart * 30) / 30 - trimStart;
      let start = 0;
      for (const c of out) {
        const step = SCENES[c.slug].step;
        const speed = typeof c.props.speed === "number" ? c.props.speed : 1;
        if (step && !step.prop) {
          for (let k = 0; k < 4; k++) {
            const f =
              (step.first + k * step.frames) / speed - (c.trimBefore ?? 0);
            if (f < 0 || f >= c.durationInFrames) continue;
            const half = ((start + f) / 30 + shift) / (track.beat / 2);
            errs.push(Math.abs(half - Math.round(half)) / 2);
          }
        }
        start += c.durationInFrames;
      }
    }
    errs.sort((a, b) => a - b);
    expect(errs.length).toBeGreaterThan(100);
    expect(errs[Math.floor(errs.length * 0.75)]).toBeLessThan(1 / 6);
  });

  it("sets card-rail's flick interval to whole beats", () => {
    for (const track of TRACKS) {
      const { clips: out } = syncToTrack([clip("card-rail")], track);
      const every = out[0].props.every as number;
      const beats = every / (track.beat * 30);
      expect(
        Math.abs(beats - Math.round(beats)) * track.beat * 1000,
      ).toBeLessThan(17);
    }
  });
});
