import { describe, expect, it } from "vitest";
import { CUT, MARK_X, WIPE, WORD_RISE } from "../data";
import { beats, layoutLine, sample, sourceFrame, wordBeats } from "../index";

describe("sky-lockup", () => {
  it("plays the source backwards, ending held on the logo", () => {
    expect(sourceFrame(0)).toBe(77);
    expect(sourceFrame(57)).toBe(14);
    expect(sourceFrame(999)).toBe(14);
    for (let f = 1; f <= 57; f++) {
      expect(sourceFrame(f)).toBeLessThan(sourceFrame(f - 1));
    }
  });
  it("lands every out frame on a real source frame", () => {
    for (let f = 0; f <= 57; f++) {
      expect(Number.isInteger(sourceFrame(f))).toBe(true);
    }
  });
  it("only squeezes the held line, everything else is one to one", () => {
    const rates = CUT.slice(1).map(
      ([f, s], i) => ((CUT[i]?.[1] ?? 0) - s) / (f - (CUT[i]?.[0] ?? 0)),
    );
    expect(rates).toEqual([1, 3, 1, 1]);
  });
  it("types the wordmark on the measured beats at any length", () => {
    expect(beats(3, 2, 6)).toEqual([2, 4, 6]);
    expect(beats(1, 2, 6)).toEqual([2]);
    expect(beats(6, 2, 7)).toEqual([2, 3, 4, 5, 6, 7]);
  });
  it("keys words on the measured frames, then every 4", () => {
    expect(wordBeats(2, [32, 36])).toEqual([32, 36]);
    expect(wordBeats(3, [57, 61, 65])).toEqual([57, 61, 65]);
    expect(wordBeats(4, [32, 36])).toEqual([32, 36, 40, 44]);
  });
  it("hangs words either side of the tile", () => {
    const l = layoutLine([100, 200], [50], 10, 40);
    expect(l.before).toEqual([-340, -230]);
    expect(l.after).toEqual([30]);
    expect(l.width).toBe(420);
    expect(l.centre).toBe(-130);
  });
  it("copes with one side of the line empty", () => {
    const l = layoutLine([], [50], 10, 40);
    expect(l.before).toEqual([]);
    expect(l.width).toBe(100);
  });
  it("samples between entries and holds both ends", () => {
    expect(sample([0, 10], 0.5)).toBe(5);
    expect(sample([0, 10], -3)).toBe(0);
    expect(sample([0, 10], 9)).toBe(10);
  });
  it("has a sample for every source frame and a rise that settles", () => {
    expect(MARK_X).toHaveLength(78);
    expect(WIPE).toHaveLength(78);
    expect(Math.abs(WORD_RISE[WORD_RISE.length - 1] ?? 1)).toBeLessThan(0.5);
  });
});
