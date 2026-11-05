import { describe, expect, it } from "vitest";
import {
  BLOOM_CARDS,
  BLOOM_DELAY,
  BLOOM_FADE,
  BLOOM_SECONDS,
  LOCKUP_SECONDS,
  LOGO_Y,
} from "../data";
import { cardFade, clipFrames, sample } from "../index";

describe("bloom-lockup", () => {
  it("runs four seconds at 30fps", () => {
    expect(clipFrames(30)).toBe(120);
    expect(BLOOM_SECONDS + LOCKUP_SECONDS).toBeLessThan(4);
  });
  it("has a start and a length for every bloom card", () => {
    expect(BLOOM_DELAY).toHaveLength(BLOOM_CARDS.length);
    expect(BLOOM_FADE).toHaveLength(BLOOM_CARDS.length);
  });
  it("holds a card at nothing until its start, then lands it fully", () => {
    const start = BLOOM_DELAY[3] ?? 0;
    expect(cardFade(3, start - 0.01)).toBe(0);
    expect(cardFade(3, start + (BLOOM_FADE[3] ?? 0))).toBe(1);
  });
  it("starts the logo on the centre of the stage and lifts it", () => {
    expect(Math.abs((LOGO_Y[0] ?? 0) - 540)).toBeLessThan(4);
    expect(LOGO_Y[LOGO_Y.length - 1]).toBeLessThan(LOGO_Y[0] ?? 0);
  });
  it("samples between entries and holds both ends", () => {
    expect(sample([0, 10], 0.5 / 30)).toBe(5);
    expect(sample([0, 10], -1)).toBe(0);
    expect(sample([0, 10], 9)).toBe(10);
  });
});
