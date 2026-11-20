import { describe, expect, it } from "vitest";
import { commissionCents, referralId } from "@/lib/affiliate";

describe("referralId", () => {
  it("passes an Affonso id through", () => {
    expect(referralId("cmdhq6ayf0001abc")).toBe("cmdhq6ayf0001abc");
  });

  it("drops what cannot be one — it goes to Dodo verbatim", () => {
    expect(referralId(undefined)).toBeNull();
    expect(referralId("")).toBeNull();
    expect(referralId("a b")).toBeNull();
    expect(referralId('{"x":1}')).toBeNull();
    expect(referralId("x".repeat(129))).toBeNull();
  });
});

describe("commissionCents", () => {
  it("is 30% of net revenue (price minus 5.5% + 40¢), to the cent", () => {
    expect(commissionCents(19900)).toBe(5630); // net 187.66 → the page's "$188 → $56"
    expect(commissionCents(27900)).toBe(7898);
    expect(commissionCents(17900)).toBe(5063);
  });
});
