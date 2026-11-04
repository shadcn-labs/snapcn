import { describe, expect, it } from "vitest";
import { SWEEP_FIRST, SWEEP_LAST } from "../data";
import { fitLine, pullBack, sample, sweepFor, titleAt } from "../index";

describe("title-sweep", () => {
  it("samples a table and holds its ends", () => {
    expect(sample([0, 2], 0.5)).toBe(1);
    expect(sample([0, 2], -1)).toBe(0);
    expect(sample([0, 2], 9)).toBe(2);
  });

  it("cuts titles on the beat and holds the last", () => {
    expect(titleAt(0, 2)).toEqual({ index: 0, age: 0 });
    expect(titleAt(35, 2)).toEqual({ index: 0, age: 35 });
    expect(titleAt(36, 2)).toEqual({ index: 1, age: 0 });
    expect(titleAt(90, 2)).toEqual({ index: 1, age: 54 });
  });

  it("sweeps a single title off and lets the last of many hold", () => {
    expect(sweepFor(0, 1)).toBe(SWEEP_FIRST);
    expect(sweepFor(0, 2)).toBe(SWEEP_FIRST);
    expect(sweepFor(1, 2)).toBe(SWEEP_LAST);
  });

  it("only ever moves the gradient forward", () => {
    for (const table of [SWEEP_FIRST, SWEEP_LAST])
      expect(table.slice(1).every((v, i) => v >= (table[i] ?? v))).toBe(true);
  });

  it("pulls back and keeps long copy on the stage", () => {
    expect(pullBack(0)).toBe(1);
    expect(pullBack(50)).toBeLessThan(1);
    expect(fitLine(500, 1920)).toBe(1);
    expect(fitLine(3456, 1920) * 3456).toBeCloseTo(1920 * 0.9);
  });
});
