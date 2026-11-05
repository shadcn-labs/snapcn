import { describe, expect, it } from "vitest";
import { FRAMES, IMAGES, LOGO, TILES, WORDS } from "../data";
import { pose, reveal } from "../index";

describe("gather-lockup", () => {
  it("has a picture for every index a tile asks for", () => {
    const pics = TILES.flatMap((t) => t.keys.map((k) => k[1] ?? 0));
    expect(Math.max(...pics)).toBe(IMAGES.length - 1);
  });
  it("keeps every track inside the clip and in frame order", () => {
    for (const t of [...TILES, ...WORDS]) {
      expect(t.until).toBeLessThan(FRAMES);
      const from = t.keys.map((k) => k[0] ?? 0);
      expect(from).toEqual([...from].sort((a, b) => a - b));
    }
  });
  it("holds the last pose that has started", () => {
    const keys = [
      [0, 1],
      [5, 2],
    ];
    expect(pose(keys, 4)?.[1]).toBe(1);
    expect(pose(keys, 5)?.[1]).toBe(2);
    expect(pose(keys, 99)?.[1]).toBe(2);
  });
  it("reveals the wordmark in three steps, whatever its length", () => {
    expect(reveal("snapcn", 2, 0)).toEqual(["sn", ""]);
    expect(reveal("snapcn", 4, 1)).toEqual(["snap", "c"]);
    expect(reveal("snapcn", 6, 0)).toEqual(["snapcn", ""]);
    expect(reveal("acme", 2, 0)).toEqual(["ac", ""]);
    expect(reveal("acme", 4, 1)).toEqual(["ac", "m"]);
  });
  it("ends on the whole lockup", () => {
    expect(LOGO.word[LOGO.word.length - 1]?.[1]).toBe(6);
  });
});
