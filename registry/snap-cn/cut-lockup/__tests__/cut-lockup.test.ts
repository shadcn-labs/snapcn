import { describe, expect, it } from "vitest";
import { splitPath, track } from "../index";

describe("cut-lockup", () => {
  it("splits relative paths into absolute subpaths with anchors", () => {
    const s = splitPath("M0 0 h10 v10 h-10 z m20 0 l5 5");
    expect(s).toHaveLength(2);
    expect(s[0]!.dots).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(s[1]!.dots).toEqual([
      [20, 0],
      [25, 5],
    ]);
  });
  it("tracks hold their ends", () => {
    expect(
      track(
        [
          [0, 1],
          [10, 3],
        ],
        5,
      ),
    ).toBe(2);
    expect(
      track(
        [
          [0, 1],
          [10, 3],
        ],
        99,
      ),
    ).toBe(3);
  });
});
