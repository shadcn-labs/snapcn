"use client";

import { ArrowRight, Check, Loader2, TicketPercent } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";
import {
  bannerOfferEnds,
  codeInUrl,
  countPricingVisit,
  earnOffer,
  type OfferTrigger,
  offerEarned,
  REPEAT_VISITS,
} from "@/lib/offer";
import {
  BANNER_OFFER,
  OFFER,
  type PlanTier,
  TIER_NAME,
  tierIncludes,
} from "@/lib/plans";
import { startCheckout, type UpgradeProduct } from "@/lib/upgrade";
import { cn } from "@/lib/utils";

/** A price string split around its number: "Rp 849,000" → "Rp ", 849000, "". */
function parsePrice(price: string) {
  const m = price.match(/^(\D*)([\d,]+(?:\.\d+)?)(\D*)$/);
  if (!m) return null;
  return {
    prefix: m[1],
    value: Number(m[2].replace(/,/g, "")),
    decimals: m[2].split(".")[1]?.length ?? 0,
    suffix: m[3],
  };
}

/** `price` less `percent`, written the way `price` was ("₹9,499" → "₹8,549"). */
function lessPercent(price: string, percent: number, t = 1): string {
  const p = parsePrice(price);
  if (!p) return price;
  const v = p.value * (1 - (percent / 100) * t);
  return (
    p.prefix +
    v.toLocaleString("en", {
      minimumFractionDigits: p.decimals,
      maximumFractionDigits: p.decimals,
    }) +
    p.suffix
  );
}

/**
 * Every amount in `text` that is `price` or the "… with tax" total, less the
 * offer — so the button and caption quote what checkout will charge. The tax
 * total scales exactly: tax is a percentage of the discounted subtotal.
 */
function withOffer(text: string, price: string, percent: number): string {
  return text
    .replace(price, lessPercent(price, percent))
    .replace(/(\S*\d[\d,]*(?:\.\d+)?)(?= with tax)/, (m) =>
      lessPercent(m, percent),
    );
}

const OFFER_KEYFRAMES = `
@keyframes offer-stamp { 0% { opacity: 0; transform: scale(1.35) rotate(-4deg); } 60% { opacity: 1; transform: scale(0.97) rotate(0.5deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes offer-shine { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(420%) skewX(-20deg); } }
@keyframes offer-strike { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes offer-pop { 0% { opacity: 0; transform: scale(0.6); } 70% { opacity: 1; transform: scale(1.08); } 100% { transform: scale(1); } }`;

/**
 * A card's price with the offer landing on it: the list price is struck
 * through, the big number counts down to what checkout will charge, then the
 * saving pops in. Rounded the way the price was written (no cents on "₹9,499");
 * Dodo's own page shows the exact figure. Reduced motion lands on the result.
 */
function OfferPrice({
  price,
  percent,
  firstYear,
  className,
}: {
  price: string;
  percent: number;
  firstYear: boolean;
  className: string;
}) {
  const parts = parsePrice(price);
  const [shown, setShown] = useState(price);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!parsePrice(price)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(lessPercent(price, percent));
      setDone(true);
      return;
    }
    // Starts once the strike has drawn; ease-out cubic over 700ms.
    const start = performance.now() + 550;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 700));
      setShown(lessPercent(price, percent, 1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(step);
      else setDone(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [price, percent]);

  if (!parts) return <span className={className}>{price}</span>;

  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-2 text-sm">
        <span className="relative text-muted-foreground">
          {price}
          <span
            aria-hidden
            className="absolute inset-x-[-2px] top-1/2 h-[1.5px] origin-left animate-[offer-strike_350ms_ease-out_200ms_both] bg-current"
          />
        </span>
        {done && (
          <span className="animate-[offer-pop_350ms_ease-out_both] rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-600 text-xs dark:text-emerald-400">
            −{percent}%{firstYear ? " first year" : ""}
          </span>
        )}
      </span>
      <span className={cn(className, "tabular-nums")}>{shown}</span>
    </span>
  );
}

/**
 * The pricing cards — the Staged Pricing layout from Ruixen UI
 * (registry/ruixenui/staged-pricing.tsx): cards set in a hairline frame with
 * corner crosshairs, a large price, one bold line naming who the tier is for,
 * then the features.
 *
 * Ported class for class and resolved through snapcn's own tokens, so the
 * card radius lands on DESIGN.md's 10px rather than Ruixen's 22px and the
 * highlight is snapcn's accent rather than Ruixen's black. No billing toggle:
 * nothing here is sold monthly.
 */
type Tier = {
  name: string;
  price: string;
  /** Under the price: what the number buys, in time. */
  caption: string;
  /** The one bold line — who the tier is for. */
  audience: string;
  features: string[];
  /** A short chip beside the price. A fact about the price, never a boast. */
  badge?: string;
  product?: UpgradeProduct;
  /** Where a tier with nothing to buy sends people instead. */
  href?: string;
  /**
   * One line under the button, for a fact about the price rather than about the
   * plan — seats left, a dated rise. Not a feature: a feature is what you get,
   * and this is a reason to decide now.
   */
  note?: string;
  cta: string;
  featured?: boolean;
};

/**
 * Columns, and the breakpoint the frame appears at — the same one, because the
 * frame's vertical lines are placed on grid columns and mean nothing on a
 * single-column stack. Four tiers wait for `xl`: `/docs/pricing` sits beside a
 * 260px sidebar, and at `lg` four cards would be 160px wide.
 */
const LAYOUT: Record<number, { grid: string; frame: string }> = {
  2: { grid: "md:grid-cols-2", frame: "md:block" },
  3: { grid: "lg:grid-cols-3", frame: "lg:block" },
  4: { grid: "md:grid-cols-2 xl:grid-cols-4", frame: "xl:block" },
};

export function PricingPlans({
  tiers,
  currentPlan,
  from = "pricing",
  footnote,
}: {
  tiers: Tier[];
  /** The visitor's plan as bought (`PlanTier`), or anonymous when signed out. */
  currentPlan: PlanTier | "anonymous";
  /** Which page the `upgrade_started` came from — `/pro` sells too. */
  from?: "pricing" | "pro_page";
  /** One line under the whole row — the regional prices. */
  footnote?: string;
}) {
  const trackEvent = useTrackEvent();
  const [pending, setPending] = useState<UpgradeProduct | null>(null);
  // The banner's code for anyone not paying; the intent offer once earned.
  const [offer, setOffer] = useState<typeof OFFER | typeof BANNER_OFFER | null>(
    null,
  );
  const layout = LAYOUT[tiers.length] ?? LAYOUT[4];
  const held = currentPlan === "anonymous" ? null : currentPlan;
  /** Holds a paid plan: their card is the one highlighted, and no promos. */
  const paying = held !== null && held !== "free" && held !== "starter";

  // The intent offer (`lib/offer.ts`) is earned only by someone not yet paying:
  // arriving from the CLI paywall's link, a third separate visit here, or at
  // another wall. What applies is then the one rule the banner and
  // `startCheckout` share — the earned code, else the banner's inside its
  // window — so the bar, this page and checkout never quote different offers.
  // After mount only — the page is the same HTML for everyone. A paying customer
  // gets no offer at all: a "10% off Pro" pill above the plan they already own
  // reads as a mistake, and the banner hides for them too.
  useEffect(() => {
    if (paying) {
      setOffer(null);
      return;
    }
    let earned: OfferTrigger | null = null;
    if (currentPlan === "free" || currentPlan === "anonymous") {
      const visits = countPricingVisit();
      if (codeInUrl(window.location.search)) earned = "cli";
      else if (!offerEarned() && visits >= REPEAT_VISITS)
        earned = "repeat_visit";
      if (earned && !offerEarned()) {
        earnOffer(earned);
        trackEvent("offer_shown", { trigger: earned });
      }
    }
    setOffer(
      earned !== null || offerEarned()
        ? OFFER
        : bannerOfferEnds() > Date.now()
          ? BANNER_OFFER
          : null,
    );
  }, [currentPlan, paying, trackEvent]);

  async function buy(product: UpgradeProduct) {
    if (pending) return;
    setPending(product);
    trackEvent("upgrade_started", {
      from,
      plan: product,
      ...(offer ? { discount: offer.code } : {}),
    });
    try {
      await startCheckout(product, offer?.code);
    } catch (err) {
      setPending(null);
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout.",
      );
    }
  }

  return (
    <div>
      {offer && (
        // Stamped on like a ticket, with one sweep of light: the moment the
        // banner's promise lands. The intent code is named outright, so it can
        // be typed on Dodo's page too.
        <div className="mb-8 flex justify-center">
          <style>{OFFER_KEYFRAMES}</style>
          <p className="relative flex w-fit animate-[offer-stamp_550ms_cubic-bezier(0.2,0.8,0.2,1)_both] items-center gap-2 overflow-hidden text-pretty rounded-full border border-primary/25 bg-primary/10 py-1.5 pr-4 pl-1.5 text-primary text-sm motion-reduce:animate-none">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <TicketPercent className="size-3.5" aria-hidden="true" />
            </span>
            <span>
              {offer.code === OFFER.code ? (
                <>
                  Code{" "}
                  <span className="font-medium font-mono">{offer.code}</span>{" "}
                  applied
                </>
              ) : (
                <span className="font-medium">Regional offer applied</span>
              )}{" "}
              — {offer.percent}% off your first payment, automatically at
              checkout.
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-[offer-shine_900ms_ease-in-out_600ms_both] bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:hidden"
            />
          </p>
        </div>
      )}
      <div className={cn("relative grid grid-cols-1 gap-6", layout.grid)}>
        <FrameLines columns={tiers.length} visible={layout.frame} />
        {tiers.map((tier) => {
          const cardTier = tier.name.toLowerCase() as PlanTier;
          const current = held === cardTier;
          // Below what they hold, the card is theirs already, not for sale:
          // Commercial includes Lifetime, Lifetime includes Pro, Pro includes
          // Free. A Lifetime buyer was being offered the annual Pro.
          const included =
            held !== null && !current && tierIncludes(held, cardTier);
          const owned = current || included;
          const ownedLabel = current
            ? "Your plan"
            : `Included in ${held ? TIER_NAME[held] : ""}`;
          // Their own card draws the eye once they pay; until then, the featured one.
          const highlight = paying ? current : tier.featured;
          /**
           * Taller than a toolbar button and solid on every paid card: the
           * outline buttons read as "cancel" beside the one blue button. The
           * arrow nudges on hover and the button gives on press — 150ms,
           * transform only, so it answers the pointer without animating layout.
           */
          const ctaClass =
            "group/cta h-12 w-full gap-2 rounded-button text-base font-medium transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] lg:h-11";
          /** The offer's percent where it lands on this card, else 0. */
          const discounted =
            offer && tier.product && !owned ? offer.percent : 0;
          const priceClass = cn(
            "whitespace-nowrap font-semibold text-foreground tracking-tight",
            tier.price.length <= 5
              ? "text-5xl"
              : tier.price.length <= 7
                ? "text-4xl"
                : "text-3xl",
          );
          const arrow = (
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5"
            />
          );
          return (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col justify-between rounded-3xl border bg-card px-[23px] pt-[21px] pb-[23px] shadow-[var(--shadow-card)]",
                highlight
                  ? "border-primary/40 ring-4 ring-primary/10"
                  : "border-border",
              )}
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-muted-foreground text-xl">{tier.name}</h2>
                  {current && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                      <Check className="size-3" strokeWidth={2.5} aria-hidden />
                      Your plan
                    </span>
                  )}
                </div>

                <div className="mt-4 lg:mt-8">
                  <div className="flex items-start gap-2">
                    {/* Stepped down for long regional prices — "₫1,249,000"
                        at 48px is wider than the card. */}
                    {discounted ? (
                      <OfferPrice
                        price={tier.price}
                        percent={discounted}
                        firstYear={tier.product === "everything_annual"}
                        className={priceClass}
                      />
                    ) : (
                      <span className={priceClass}>{tier.price}</span>
                    )}
                    {tier.badge && !owned && (
                      <span className="mt-[6px] inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border border-primary/20 bg-primary/10 px-[7px] py-[3px] font-medium text-primary text-xs">
                        {tier.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {discounted
                      ? withOffer(tier.caption, tier.price, discounted)
                      : tier.caption}
                  </p>
                </div>

                <p className="mt-5 text-pretty font-semibold text-foreground text-sm lg:mt-8">
                  {tier.audience}
                </p>

                <ul className="mt-2.5 flex flex-col gap-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Check className="size-3.5" strokeWidth={2.5} />
                      </span>
                      <span className="text-pretty text-muted-foreground text-sm">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex flex-col items-stretch lg:mt-8">
                {owned ? (
                  // Theirs already: says so, and offers nothing to click.
                  <Button className={ctaClass} variant="outline" disabled>
                    <span>{ownedLabel}</span>
                  </Button>
                ) : tier.product ? (
                  <Button
                    className={cn(
                      ctaClass,
                      // Featured: the accent. Other paid tiers: the foreground,
                      // inverted — as solid as the featured one, without
                      // competing with it for the eye.
                      !tier.featured &&
                        "bg-foreground text-background hover:bg-foreground/85",
                    )}
                    variant={tier.featured ? "default" : undefined}
                    disabled={pending !== null}
                    onClick={() => buy(tier.product as UpgradeProduct)}
                  >
                    {pending === tier.product ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {/* In a span, never a bare text node. The click inserts the
                        spinner *before* this label, and browser translation
                        (Edge, Chrome) had already swapped the bare text node
                        for its own <font> — so React's insertBefore threw
                        NotFoundError and the page died mid-checkout. Measured:
                        a buyer on Edge, 30ms after "upgrade_started", never
                        reached Dodo. */}
                    <span>
                      {discounted
                        ? withOffer(tier.cta, tier.price, discounted)
                        : tier.cta}
                    </span>
                    {pending === tier.product ? null : arrow}
                  </Button>
                ) : (
                  <Link
                    href={tier.href ?? "/docs/components"}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      ctaClass,
                    )}
                  >
                    {tier.cta}
                    {arrow}
                  </Link>
                )}
                {/* Always rendered, so a card without a note keeps its button
                    level with the cards that have one. */}
                <p className="mt-2 min-h-4 text-center text-muted-foreground text-xs">
                  {owned ? null : tier.note}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {footnote && (
        <p className="mt-10 text-center text-muted-foreground text-xs">
          {footnote}
        </p>
      )}
      <p
        className={cn(
          "text-center text-muted-foreground text-xs",
          footnote ? "mt-2" : "mt-10",
        )}
      >
        What each plan lets you do:{" "}
        <Link
          href="/docs/getting-started/license"
          className="underline underline-offset-2 hover:text-foreground"
        >
          license terms
        </Link>
        . Prices exclude VAT and sales tax, added at checkout where it applies.
        All sales are final — no refunds.
      </p>
    </div>
  );
}

/** A 7px plus at a corner of the frame. */
function Crosshair({ className }: { className: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute", className)}>
      <div className="relative size-[7px]">
        <div className="absolute top-[3px] left-0 h-px w-full rounded-full bg-foreground/40" />
        <div className="absolute top-0 left-[3px] h-full w-px rounded-full bg-foreground/40" />
      </div>
    </div>
  );
}

/**
 * The frame: a hairline 12px above and below the row, one down every column
 * boundary running 48px past it, each fading out at its ends, and a crosshair
 * where the outer lines meet. Decoration only — hidden from assistive tech and
 * below the breakpoint where the grid has its full column count.
 */
function FrameLines({
  columns,
  visible,
}: {
  columns: number;
  visible: string;
}) {
  const across =
    "pointer-events-none absolute left-0 col-span-full hidden h-px w-full bg-[linear-gradient(to_right,transparent_0%,var(--color-border)_6.5%,var(--color-border)_93.5%,transparent_100%)]";
  return (
    <>
      <div
        aria-hidden
        className={cn(across, "-top-3 -translate-y-1/2", visible)}
      />
      <div
        aria-hidden
        className={cn(across, "-bottom-3 translate-y-1/2", visible)}
      />
      {Array.from({ length: columns + 1 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed, positional lines
          key={i}
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-12 -bottom-12 hidden w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--color-border)_11%,var(--color-border)_89%,transparent_100%)]",
            i === columns
              ? "-right-3 translate-x-1/2"
              : "-left-3 -translate-x-1/2",
            visible,
          )}
          style={{ gridColumnStart: i + 1 }}
        />
      ))}
      {[
        "-top-3 -left-3 -translate-x-1/2 -translate-y-1/2",
        "-top-3 -right-3 translate-x-1/2 -translate-y-1/2",
        "-right-3 -bottom-3 translate-x-1/2 translate-y-1/2",
        "-bottom-3 -left-3 -translate-x-1/2 translate-y-1/2",
      ].map((corner) => (
        <Crosshair key={corner} className={cn("hidden", corner, visible)} />
      ))}
    </>
  );
}
