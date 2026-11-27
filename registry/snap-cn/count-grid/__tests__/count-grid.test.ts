import { describe, expect, it } from "vitest";

import {
  CARD,
  CELL,
  cellIn,
  entryBlur,
  FILL_AT,
  GRID_ZOOM,
  gridScale,
  LABEL,
  LATE_CARD,
  labelIn,
  lateBlur,
  ORIGIN,
  pitch,
  ringOf,
  SEED,
  toCards,
} from "../index";

/**
 * The reference is 30fps, so every measured sample lands on a frame — and every
 * frame number here is **zero-based**. The frames were read out of files named
 * `f001.png`…`f047.png`, which are one-based: `f038.png` is frame 37. Taking
 * the filenames at face value ran the whole clip a frame late.
 */
const at = (f: number) => f / 30;

describe("the pull-back", () => {
  it("reproduces the measured pitch across the settle", () => {
    // Distance between the two centre columns, frame by frame.
    expect(pitch(at(7))).toBeCloseTo(138.5, 1);
    expect(pitch(at(11))).toBeCloseTo(128, 1);
    expect(pitch(at(19))).toBeCloseTo(121.5, 1);
    expect(pitch(at(26))).toBeCloseTo(119.6, 1);
    expect(pitch(at(36))).toBeCloseTo(118, 1);
  });

  it("reproduces the measured pitch across the fill", () => {
    expect(pitch(at(38))).toBeCloseTo(113, 1);
    expect(pitch(at(40))).toBeCloseTo(104, 1);
    expect(pitch(at(42))).toBeCloseTo(99.5, 1);
    expect(pitch(at(45))).toBeCloseTo(96.6, 1);
  });

  it("is continuous where the two settles meet", () => {
    const before = pitch(at(36.4));
    const after = pitch(at(36.6));
    expect(Math.abs(after - before)).toBeLessThan(1);
  });

  it("only ever shrinks", () => {
    for (let f = 1; f <= 46; f++) {
      expect(pitch(at(f)), `frame ${f}`).toBeLessThan(pitch(at(f - 1)));
    }
  });

  it("never freezes: every frame of it actually moves", () => {
    // The middle of this shot looks static and is not — the pitch is still
    // shedding a fifth of a pixel a frame at 36, which is the difference
    // between a held shot and a frozen one.
    for (let f = 1; f <= 46; f++) {
      expect(pitch(at(f - 1)) - pitch(at(f)), `frame ${f}`).toBeGreaterThan(0);
    }
  });

  it("starts wide enough to come from off-frame and ends inside the cell", () => {
    expect(gridScale(at(0))).toBeGreaterThan(1.4);
    expect(gridScale(at(19))).toBeCloseTo(1, 1);
    expect(gridScale(at(46))).toBeLessThan(0.82);
  });
});

describe("the blur", () => {
  it("is spent in five frames, not carried by the motion", () => {
    // The frame's own horizontal gradient: 0.28 at frame 3, 1.90 at 4, 2.75 at
    // 5, and flat after. Driving this off the pitch's derivative instead kept a
    // smear on screen for seven frames the reference does not have.
    expect(entryBlur(at(0))).toBeGreaterThan(15);
    expect(entryBlur(at(3))).toBeCloseTo(6, 0);
    expect(entryBlur(at(5))).toBe(0);
    expect(entryBlur(at(20))).toBe(0);
  });

  it("only ever clears", () => {
    for (let f = 1; f <= 20; f++) {
      expect(entryBlur(at(f))).toBeLessThanOrEqual(entryBlur(at(f - 1)));
    }
  });

  it("keeps one card smearing after the rest are sharp", () => {
    expect(lateBlur(at(5))).toBeGreaterThan(entryBlur(at(5)));
    expect(lateBlur(at(7))).toBeGreaterThan(0);
    expect(lateBlur(at(9))).toBe(0);
  });

  it("puts the late card behind the label, where the reference has it", () => {
    expect(SEED).toContainEqual(LATE_CARD);
  });
});

describe("the label", () => {
  it("fades up whole rather than typing", () => {
    expect(labelIn(at(11))).toBe(0);
    expect(labelIn(at(15))).toBeCloseTo(0.55, 2);
    expect(labelIn(at(18))).toBe(1);
    expect(labelIn(at(46))).toBe(1);
  });

  it("sits on the middle row's own centre line", () => {
    expect(LABEL.cy).toBe(202.5);
  });
});

describe("the grid", () => {
  it("is five cards, and not a tidy 2×3 of them", () => {
    expect(SEED).toHaveLength(5);
    const rows = new Set(SEED.map(([, r]) => r));
    expect(rows.size).toBe(3);
    // The bottom row has one card, not two — the odd one out is the whole
    // reason it reads as a handful rather than as a swatch.
    expect(SEED.filter(([, r]) => r === 1)).toHaveLength(1);
  });

  it("fills all but a hairline of its cell, evenly on both axes", () => {
    // The reference's own card takes 75% of its cell and reads as a scatter of
    // stickers. This one takes 95%, which is what makes it a wall — and the two
    // axes have to agree within a couple of px or the grid looks stretched.
    expect(CARD.w / CELL.w).toBeGreaterThan(0.93);
    expect(CARD.h / CELL.h).toBeGreaterThan(0.93);
    expect(CARD.w / CELL.w).toBeLessThan(1);
    expect(CARD.h / CELL.h).toBeLessThan(1);
    expect(Math.abs(CELL.w - CARD.w - (CELL.h - CARD.h))).toBeLessThan(2.5);
  });

  it("gets its size from the cell it fills, not from an extra zoom", () => {
    // The cards looked half-size against their own gaps because the card was
    // drawn in reference px inside a cell laid out in render px. A zoom knob
    // hides that and moves the error into the spacing; the fix is the missing
    // `k`, and this stays at 1 to keep anyone from reaching for the knob again.
    expect(GRID_ZOOM).toBe(1);
    expect((GRID_ZOOM * CARD.w) / CELL.w / (90.5 / 120.5)).toBeCloseTo(1.27, 1);
  });

  it("keeps the card portrait, and its corners sharp", () => {
    expect(CARD.w / CARD.h).toBeGreaterThan(0.7);
    expect(CARD.w / CARD.h).toBeLessThan(0.85);
    expect(CARD.radius).toBeLessThanOrEqual(3);
  });

  it("scales about a point below the middle row, not about the frame", () => {
    // On the frame's centre the inner cards come out a pixel high through the
    // whole fill; the fixed point is 5px under the row they sit on.
    expect(ORIGIN.y).toBeGreaterThan(LABEL.cy);
    expect(ORIGIN.y - LABEL.cy).toBeCloseTo(5.1, 1);
  });

  it("rings outward from the five by Chebyshev distance", () => {
    for (const [c, r] of SEED) expect(ringOf(c, r)).toBe(0);
    expect(ringOf(-2, 0)).toBe(1);
    expect(ringOf(1, 0)).toBe(1);
    expect(ringOf(-1, 1)).toBe(1);
    expect(ringOf(-3, 0)).toBe(2);
  });

  it("holds the five and fills the rest from frame 37", () => {
    expect(cellIn(0, at(0))).toBe(1);
    expect(cellIn(1, at(36))).toBe(0);
    // The ramp straddles the switch: at 37 the reference's first new columns
    // are already 80px wide against a settled 90.
    expect(cellIn(1, at(37))).toBeGreaterThan(0.5);
    expect(cellIn(1, at(38))).toBe(1);
  });

  it("staggers a whole frame per ring, so ring two lags ring one", () => {
    // At frame 37 the reference has ring one and nothing else; by 38 it has
    // both, the second narrower than the first.
    expect(cellIn(2, at(37))).toBe(0);
    expect(cellIn(2, at(38))).toBeGreaterThan(0.5);
    expect(cellIn(2, at(38))).toBeLessThan(cellIn(1, at(38)));
  });

  it("switches the count on the frame the grid starts filling", () => {
    expect(FILL_AT).toBe(37);
  });
});

describe("toCards", () => {
  it("splits the string form and drops empties", () => {
    expect(toCards(" a.png | b.png ||")).toEqual(["a.png", "b.png"]);
    expect(toCards("")).toEqual([]);
  });
});
