import { describe, expect, it } from "vitest";
import { cardAt, sample, timeline } from "../index";

describe("drop-line", () => {
  it("cuts four words on the measured beats", () => {
    expect(timeline(4)).toEqual({ starts: [0, 9, 16, 23], end: 38, drop: 23 });
  });
  it("gives one word both the rise and the drop", () => {
    expect(timeline(1)).toEqual({ starts: [0], end: 24, drop: 9 });
  });
  it("adds a hold per extra word", () => {
    expect(timeline(6).end).toBe(52);
  });
  it("finds the card up at a frame", () => {
    const { starts } = timeline(4);
    expect(cardAt(starts, 0)).toBe(0);
    expect(cardAt(starts, 8.9)).toBe(0);
    expect(cardAt(starts, 9)).toBe(1);
    expect(cardAt(starts, 37)).toBe(3);
  });
  it("samples between entries and holds both ends", () => {
    expect(sample([0, 10], 0.5)).toBe(5);
    expect(sample([0, 10], -3)).toBe(0);
    expect(sample([0, 10], 9)).toBe(10);
  });
});
