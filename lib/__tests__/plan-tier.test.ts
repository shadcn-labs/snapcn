import { describe, expect, it } from "vitest";
import { tierForProduct, tierIncludes, tierOfPurchase } from "@/lib/plans";

describe("tierOfPurchase", () => {
  it("names a one-time personal purchase Lifetime, not Pro", () => {
    expect(
      tierOfPurchase({
        plan: "pro",
        licence: "personal",
        subscriptionId: null,
      }),
    ).toBe("lifetime");
  });
  it("names the annual subscription Pro", () => {
    expect(
      tierOfPurchase({
        plan: "pro",
        licence: "personal",
        subscriptionId: "sub_1",
      }),
    ).toBe("pro");
  });
  it("names a commercial licence Commercial", () => {
    expect(
      tierOfPurchase({
        plan: "pro",
        licence: "commercial",
        subscriptionId: null,
      }),
    ).toBe("commercial");
  });
  it("leaves free and starter as they are", () => {
    expect(
      tierOfPurchase({
        plan: "free",
        licence: "personal",
        subscriptionId: null,
      }),
    ).toBe("free");
    expect(
      tierOfPurchase({
        plan: "starter",
        licence: "personal",
        subscriptionId: "sub_1",
      }),
    ).toBe("starter");
  });
});

describe("tierIncludes", () => {
  it("Lifetime includes Pro and Free but not Commercial", () => {
    expect(tierIncludes("lifetime", "pro")).toBe(true);
    expect(tierIncludes("lifetime", "free")).toBe(true);
    expect(tierIncludes("lifetime", "commercial")).toBe(false);
  });
  it("Pro does not include Lifetime", () => {
    expect(tierIncludes("pro", "lifetime")).toBe(false);
  });
});

describe("tierForProduct", () => {
  it("maps every checkout product to the tier it sells", () => {
    expect(tierForProduct("everything_annual")).toBe("pro");
    expect(tierForProduct("lifetime")).toBe("lifetime");
    expect(tierForProduct("commercial")).toBe("commercial");
    expect(tierForProduct("pack")).toBeNull();
  });
});
