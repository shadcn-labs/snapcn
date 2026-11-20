/**
 * The affiliate programme, run on Affonso (affonso.io) over Dodo.
 *
 * ## Who computes what
 *
 * Affonso does the arithmetic, not this app. The pixel in `app/layout.tsx`
 * drops an `affonso_referral` cookie when someone lands on `?via=<code>`,
 * `/api/checkout` copies it into the Dodo session's metadata, and Affonso — a
 * Dodo webhook of its own, connected in its dashboard — reads it off the paid
 * event and books the commission. Nothing here grants, stores or pays anything.
 *
 * So the numbers below are the *copy* of the dashboard settings, written once so
 * the page cannot quote one percent while Affonso pays another. Change one,
 * change the dashboard in the same sitting.
 *
 * ## Why 30 and not 29
 *
 * Affonso commissions the price **before tax, after any discount** — Dodo's VAT
 * and sales tax sit on top of our price (`tax_inclusive: false`, BILLING_LOCAL.md)
 * and never enter the split. Dodo's fee is ours to carry: 4% + 40¢, +1.5% on a
 * card outside the US, +0.5% on a subscription. On a $279 Lifetime, foreign card:
 *
 *   279.00 − 15.75 Dodo − 83.70 affiliate (30%) = 179.55 kept (64%)
 *   at 29% the affiliate gets 80.91 and we keep 182.34 — $2.79 a sale
 *
 * One point buys $2.79 and costs the round number every affiliate compares
 * programmes on. 30% it is. Affonso's own plan (€15–29/mo) and its managed
 * payout fee are fixed costs, not per-sale ones, so they do not move this.
 *
 * Deliberately dependency-free, like `lib/plans.ts`: the page imports it and so
 * does a route.
 */

export const AFFILIATE = {
  /** Commission, percent of net revenue (see `netCents`). Dashboard: Commission = 28% flat, its equivalent. */
  percent: 30,
  /**
   * Days the referral cookie lives. Written into the pixel tag itself, so this
   * one is enforced here, not just quoted.
   */
  cookieDays: 60,
  /**
   * Days a commission waits before it is payable. Sales are final, but a card
   * dispute can still land weeks later; this keeps us from paying out on money
   * that is about to leave. Dashboard: Payouts → holding period.
   */
  holdDays: 30,
  /**
   * The link parameter. Not `ref`: this site already uses `?ref=` for its own
   * attribution (`?ref=cli`, `?ref=sale_banner`, …), and the two must never be
   * read as each other. Dashboard: Tracking → referral parameter.
   */
  param: "via",
} as const;

/** The cookie Affonso's pixel writes and its Dodo integration reads back. */
export const AFFONSO_COOKIE = "affonso_referral";

/**
 * Affonso's public program id, for the pixel. Unset — every fresh clone, every
 * preview — and the pixel is not rendered at all, the same "absent, not broken"
 * rule `dodoConfigured()` follows.
 */
export const AFFONSO_PROGRAM_ID = process.env.NEXT_PUBLIC_AFFONSO_PROGRAM_ID;

/**
 * Where "Become an affiliate" goes: the program's Affonso sign-up page. Until
 * it is set, the button opens an email instead of a dead link.
 */
export const AFFILIATE_JOIN_URL =
  process.env.NEXT_PUBLIC_AFFONSO_JOIN_URL ||
  "mailto:support@simplifyingai.com?subject=snapcn%20affiliate%20program";

/**
 * Net revenue on a pre-tax price: what is left after Dodo's fee. Quoted with
 * the foreign-card rate (4% + 1.5%) + 40¢, the common case for our buyers —
 * the page says "~", and Affonso is set to 28% flat, which lands within a
 * dollar of this on every plan. ponytail: one fee rate for all cards; per-sale
 * exact needs Affonso to read Dodo's settlement, which it can't.
 */
export function netCents(priceCents: number): number {
  return priceCents - Math.round(priceCents * 0.055) - 40;
}

/** An affiliate's earnings on a price: `percent` of net revenue. */
export function commissionCents(priceCents: number): number {
  return Math.round((netCents(priceCents) * AFFILIATE.percent) / 100);
}

/** Dollars from cents, with cents shown only when there are some: $279, $83.70. */
export function usd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * The referral id from the cookie, or null.
 *
 * The cookie is set by third-party JavaScript on the visitor's machine, so it is
 * input like any other: it goes into Dodo metadata verbatim, and Dodo drops a
 * value it does not like *silently* (lib/server/dodo.ts). Affonso's ids are
 * short opaque tokens (`cmdhq6ayf…`); anything else is not one of them.
 */
export function referralId(cookie: string | undefined): string | null {
  return cookie && /^[A-Za-z0-9_-]{1,128}$/.test(cookie) ? cookie : null;
}
