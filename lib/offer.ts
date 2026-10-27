"use client";

import { BANNER_OFFER, bannerOfferEndsIn, OFFER } from "@/lib/plans";

/**
 * Who has earned `OFFER.code`, remembered per browser.
 *
 * Earned, never timed: the code is unlocked by a wall a purchase removes —
 * a watermarked export, a Pro install refused at the CLI (`?code=` on the link
 * it prints), a third separate visit to pricing — not by minutes on a page,
 * which says nothing about wanting to buy. Once earned it stays: the Dodo code
 * has no expiry, so a "48 hours left" here would be a lie.
 *
 * localStorage, not the account: most of the people who hit these walls are
 * signed out, and the code itself is not secret — it only has to be *shown*
 * to the right people. Every access is guarded because Safari's private mode
 * and locked-down browsers throw on storage.
 */
export type OfferTrigger = "export" | "cli" | "repeat_visit";

const EARNED = "snapcn:offer";
const VISITS = "snapcn:pricing-visits";
const COUNTED = "snapcn:pricing-visit-counted";
/** Separate visits to pricing before the code shows on its own. */
export const REPEAT_VISITS = 3;

export function offerEarned(): boolean {
  try {
    return localStorage.getItem(EARNED) !== null;
  } catch {
    return false;
  }
}

export function earnOffer(trigger: OfferTrigger): void {
  try {
    if (localStorage.getItem(EARNED) === null) {
      localStorage.setItem(EARNED, trigger);
    }
  } catch {
    /* no storage — the offer is still shown this once */
  }
}

/**
 * Counts this browser's visits to pricing, once per tab session — reloading or
 * hopping between the plans and the docs is one visit, coming back another day
 * is the next. Returns the count including this one.
 */
export function countPricingVisit(): number {
  try {
    const seen = Number(localStorage.getItem(VISITS)) || 0;
    if (sessionStorage.getItem(COUNTED)) return seen;
    sessionStorage.setItem(COUNTED, "1");
    localStorage.setItem(VISITS, String(seen + 1));
    return seen + 1;
  } catch {
    return 0;
  }
}

/** `?code=SNAPCN25` on the URL — the link the CLI paywall prints. */
export function codeInUrl(search: string): boolean {
  return new URLSearchParams(search).get("code")?.toUpperCase() === OFFER.code;
}

/**
 * When this browser's banner offer ends, starting its clock on first call.
 * A year-long cookie, so the end time outlives the window it measures and a
 * returning visitor is not handed a fresh 24 hours.
 */
export function bannerOfferEnds(): number {
  const ends = bannerOfferEndsIn(document.cookie);
  if (ends) return ends;
  const until = Date.now() + BANNER_OFFER.hours * 3_600_000;
  // biome-ignore lint/suspicious/noDocumentCookie: one value, read on the server too
  document.cookie = `${BANNER_OFFER.cookie}=${until}; path=/; max-age=31536000; samesite=lax`;
  return until;
}
