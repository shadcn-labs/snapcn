import { describe, expect, it } from "vitest";
import { deepestInk, track, typedAt, wordAt } from "../index";

describe("hello-zoom", () => {
  it("tracks hold their ends", () => {
    const pts = [
      [0, 1],
      [10, 3],
    ] as const;
    expect(track(pts, -1)).toBe(1);
    expect(track(pts, 5)).toBe(2);
    expect(track(pts, 99)).toBe(3);
  });

  it("holds seven words three frames each and any count inside the budget", () => {
    expect([0, 2, 3, 17, 18, 19].map((f) => wordAt(f, 7))).toEqual([
      0, 0, 1, 5, 6, 6,
    ]);
    expect(wordAt(19, 3)).toBe(2);
    expect(wordAt(19, 30)).toBeLessThan(30);
  });

  it("types everything in the same five frames, whatever the length", () => {
    expect([25, 26, 27, 30].map((f) => typedAt(f, 10))).toEqual([0, 2, 4, 10]);
    expect(typedAt(30, 60)).toBe(60);
    expect(typedAt(24, 10)).toBe(0);
  });

  it("finds the deepest ink, not the middle of a counter", () => {
    // a 3-wide stem, a gap, then a 9-wide block
    const w = 20;
    const h = 11;
    const a = new Array(w * h).fill(0);
    for (let y = 0; y < h; y++) {
      for (const x of [2, 3, 4]) a[y * w + x] = 255;
      for (let x = 8; x < 17; x++) a[y * w + x] = 255;
    }
    const p = deepestInk(a, w, h, 0, w, 5);
    expect(p).toMatchObject({ x: 12, y: 5 });
    expect(p.r).toBeGreaterThan(3);
  });
});
