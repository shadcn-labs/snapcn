import { describe, expect, it } from "vitest";
import { converter } from "culori";
import { mixOklch } from "@/lib/snap-cn-ui";

const hue = (c: string) => converter("oklch")(c)!.h!;

describe("mixOklch", () => {
  it("off-white + blue stays blue, not green", () => {
    expect(Math.abs(hue(mixOklch("#faf9f6", "#1d6bff", 0.42)) - 262)).toBeLessThan(8);
  });
});
