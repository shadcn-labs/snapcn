import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PricingPlans } from "../pricing-plans";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    caption: "",
    audience: "",
    features: [],
    href: "/docs/components",
    cta: "Start free",
  },
  {
    name: "Lifetime",
    price: "$249",
    caption: "",
    audience: "",
    features: [],
    product: "lifetime" as const,
    cta: "Own it for $249",
    featured: true,
  },
  {
    name: "Pro",
    price: "$129",
    caption: "",
    audience: "",
    features: [],
    product: "everything_annual" as const,
    cta: "Lock in $129/yr",
    note: "21 of 50 left at this price",
  },
  {
    name: "Commercial",
    price: "$499",
    caption: "",
    audience: "",
    features: [],
    product: "commercial" as const,
    cta: "Get it for your team",
  },
];

/** The text of each card's button, in card order. */
function buttons(
  currentPlan: Parameters<typeof PricingPlans>[0]["currentPlan"],
) {
  const html = renderToStaticMarkup(
    createElement(PricingPlans, { tiers: TIERS, currentPlan }),
  );
  return [...html.matchAll(/<(?:button|a)[^>]*>(?:<[^>]+>)*([^<]+)</g)]
    .map((m) => m[1].trim())
    .filter((t) =>
      /Your plan|Included|Start free|Own it|Lock in|Get it/.test(t),
    );
}

describe("pricing cards name what the visitor already owns", () => {
  it("a Lifetime buyer: Free and Pro included, Lifetime theirs, Commercial for sale", () => {
    expect(buttons("lifetime")).toEqual([
      "Included in Lifetime",
      "Your plan",
      "Included in Lifetime",
      "Get it for your team",
    ]);
  });
  it("a Pro subscriber can still upgrade to Lifetime and Commercial", () => {
    expect(buttons("pro")).toEqual([
      "Included in Pro",
      "Own it for $249",
      "Your plan",
      "Get it for your team",
    ]);
  });
  it("a Commercial owner is sold nothing", () => {
    expect(buttons("commercial")).toEqual([
      "Included in Commercial",
      "Included in Commercial",
      "Included in Commercial",
      "Your plan",
    ]);
  });
  it("a signed-out visitor sees every offer", () => {
    expect(buttons("anonymous")).toEqual([
      "Start free",
      "Own it for $249",
      "Lock in $129/yr",
      "Get it for your team",
    ]);
  });
});
