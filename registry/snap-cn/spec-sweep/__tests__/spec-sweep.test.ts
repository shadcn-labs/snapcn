import { describe, expect, it } from "vitest";
import { entryOffset, layoutLine, sweepLevel } from "../index";

describe("spec-sweep", () => {
  it("slides in and stops", () => {
    expect(entryOffset(0)).toBe(1);
    expect(entryOffset(0.5)).toBeCloseTo(0.82);
    expect(entryOffset(15)).toBe(0);
    expect(entryOffset(40)).toBe(0);
  });

  it("gives each role its own level behind the highlight", () => {
    expect(sweepLevel("lead", 0)).toBe(1);
    expect(sweepLevel("lead", 30)).toBeLessThan(0.6);
    expect(sweepLevel("accent", 30)).toBe(1);
    expect(sweepLevel("accent", -30)).toBe(sweepLevel("lead", -30));
    expect(sweepLevel("muted", 0, 0.6)).toBe(0.6);
  });

  it("splits text into words and spaces every item", () => {
    const { items, width } = layoutLine(
      [{ text: "a  bb" }, { role: "icon" }, { text: "c", role: "accent" }],
      (s) => s.length * 10,
      30,
    );
    expect(items.map((i) => [i.role, i.text, i.x])).toEqual([
      ["lead", "a", 0],
      ["lead", "bb", 20],
      ["icon", "", 50],
      ["accent", "c", 90],
    ]);
    expect(width).toBe(100);
  });

  it("lays out nothing as an empty line", () => {
    expect(layoutLine([], () => 0, 10)).toEqual({ items: [], width: 0 });
  });
});
