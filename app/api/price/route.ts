import { headers } from "next/headers";
import { money } from "@/app/docs/(gallery)/pricing/tiers";
import { CATALOGUE_PRICE, PPP_PRICES } from "@/lib/plans";
import { resolveCountry } from "@/lib/server/country";

/**
 * The visitor's Pro prices for the site-wide sale banner. The banner sits in the
 * prerendered root layout, so it cannot read the country itself; without this it
 * said "$129/yr" above a pricing page charging an Indian visitor ₹4,699.
 * Same chain as the pricing page: a regional price where we have one, else list.
 */
export async function GET(req: Request) {
  const testCountry = new URL(req.url).searchParams.get("country");
  const { country } = await resolveCountry(await headers(), { testCountry });
  const regional =
    country && Object.hasOwn(PPP_PRICES, country)
      ? PPP_PRICES[country as keyof typeof PPP_PRICES]
      : null;
  // The banner's "special offer for India" line; null when we don't know.
  const name = country
    ? (new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? null)
    : null;
  return Response.json(
    {
      country: name,
      ...(regional
        ? {
            annual: money(regional.everything_annual, regional.currency),
            lifetime: money(regional.lifetime, regional.currency),
          }
        : {
            annual: CATALOGUE_PRICE.annual,
            lifetime: CATALOGUE_PRICE.lifetime,
          }),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
