"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useTrackEvent } from "@/lib/analytics";
import { bannerOfferEnds } from "@/lib/offer";
import { BANNER_OFFER } from "@/lib/plans";
import { cn } from "@/lib/utils";

const HREF = "/docs/pricing?ref=sale_banner#plans";
/** Published as `--fd-banner-height`; everything sticky offsets by it. */
const HEIGHT = "3.5rem";

function left(end: number, now: number) {
  const s = Math.max(0, Math.floor((end - now) / 1000));
  return {
    total: s,
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** One odometer digit: the old one rolls up and out as the new one rolls in. */
function Digit({ value }: { value: number }) {
  const [cur, setCur] = useState(value);
  const [prev, setPrev] = useState<number | null>(null);

  useEffect(() => {
    if (value === cur) return;
    setPrev(cur);
    setCur(value);
    const id = setTimeout(() => setPrev(null), 400);
    return () => clearTimeout(id);
  }, [value, cur]);

  return (
    <span className="relative inline-flex h-[1.4em] w-[0.62em] items-center justify-center overflow-hidden">
      {prev !== null && (
        <span className="absolute inset-0 flex animate-[digit-out_0.35s_ease-in_forwards] items-center justify-center">
          {prev}
        </span>
      )}
      <span
        key={cur}
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          prev !== null &&
            "animate-[digit-in_0.35s_cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        {cur}
      </span>
    </span>
  );
}

function Pair({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-center rounded-md bg-white/20 px-1.5 py-0.5 font-medium font-mono text-sm tabular-nums leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_12px_rgba(255,255,255,0.25)] ring-1 ring-white/25">
      <Digit value={Math.floor(value / 10)} />
      <Digit value={value % 10} />
    </div>
  );
}

/** Account pages, where an offer reads as "you still have to pay". */
const QUIET = ["/signin", "/account"];

/**
 * The site-wide offer bar: `BANNER_OFFER.percent` off, framed with the
 * visitor's country from `/api/price`, counting down this browser's window —
 * hours, minutes and seconds, each digit rolling like an odometer.
 *
 * The window is real (see `BANNER_OFFER`): at zero the bar goes and checkout
 * stops applying the code. The brand blue (`--primary`), bright and flat:
 * blue reads as trust and an offer should read as good news — a dark bar read
 * as a warning. Lighter than the early-bird's, with no dark vignette. Decided on the
 * client only: most pages are prerendered. Dismissible for the visit.
 *
 * Always the 10% and its countdown — never the 25% intent code: while this
 * window runs, the pricing page and checkout apply the same 10% (`lib/offer.ts`).
 *
 * Not shown to a paying customer (Pro, Lifetime, Commercial — `PlanTier`): an
 * offer on the plan they already own reads as a billing mistake, and the
 * pricing page shows them no offer either. Nor on sign-in and `/account`: a
 * teammate following a Commercial invite lands on both, signed out or not yet
 * matched to the licence, and read a sales bar as "you still have to pay".
 */

export function SaleBanner() {
  const trackEvent = useTrackEvent();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const tier = session?.user?.tier ?? session?.user?.plan ?? "free";
  const [time, setTime] = useState<ReturnType<typeof left> | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `/api/price${location.search.match(/[?&]country=[^&]+/)?.[0].replace("&", "?") ?? ""}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p?.country && setCountry(p.country))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const end = bannerOfferEnds();
    setTime(left(end, Date.now()));
    const id = setInterval(() => {
      const t = left(end, Date.now());
      setTime(t);
      if (t.total <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (dismissed || status === "loading" || !time || time.total <= 0)
    return null;
  if (tier !== "free" && tier !== "starter") return null;
  if (QUIET.some((p) => pathname?.startsWith(p))) return null;
  const offer = BANNER_OFFER;

  const colon = cn(
    "self-center text-sm font-light transition-opacity duration-500",
    time.seconds % 2 === 0 ? "opacity-60" : "opacity-30",
  );
  const label =
    "text-center text-[8px] font-medium uppercase tracking-[0.15em] text-white/60";
  const units: [number, string][] = [
    [time.hours, "hrs"],
    [time.minutes, "min"],
    [time.seconds, "sec"],
  ];

  return (
    <div
      className="sticky top-0 z-40 flex h-(--fd-banner-height) items-center justify-center overflow-hidden px-10 text-white"
      style={{
        background:
          "radial-gradient(45% 180% at 50% 50%, #5b95ee 0%, transparent 75%), linear-gradient(90deg, #3a7be0, #3072db 50%, #3a7be0)",
      }}
    >
      <style>{`:root { --fd-banner-height: ${HEIGHT}; }
@keyframes digit-out { to { transform: translateY(-100%); opacity: 0; } }
@keyframes digit-in { from { transform: translateY(100%); opacity: 0; } }
@keyframes banner-shine { 0% { transform: translateX(-100%) skewX(-20deg); } 55%, 100% { transform: translateX(450%) skewX(-20deg); } }`}</style>
      {/* Dot-matrix texture over the gradient, denser at the edges so the copy stays clean. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.18) 0.75px, transparent 1.25px)",
          backgroundSize: "6px 6px",
          maskImage:
            "linear-gradient(90deg, #000 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.25) 70%, #000 100%)",
        }}
      />
      {/* The shine: a soft band of light sweeping across every few seconds. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-[banner-shine_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent motion-reduce:hidden"
      />
      <div className="relative flex items-center gap-x-6">
        <span className="hidden font-medium text-sm md:inline">
          {country
            ? `${country} has a special offer`
            : "You have a special offer"}
          <span className="hidden text-white/75 lg:inline">
            {" "}
            — {offer.percent}% off Pro, auto-applied at checkout. Ends in
          </span>
        </span>

        {/* Labels in their own grid row, so they never shift the digits off
                the bar's centre line. */}
        <div
          className="inline-grid grid-flow-col grid-rows-[auto_auto] items-center gap-x-1.5"
          role="timer"
          aria-label={`${time.hours} hours ${time.minutes} minutes left`}
        >
          {units.map(([value, name], i) => (
            <Unit
              key={name}
              value={value}
              name={name}
              last={i === units.length - 1}
              colon={colon}
              label={label}
            />
          ))}
        </div>

        <Link
          href={HREF}
          onClick={() =>
            trackEvent("cta_clicked", { cta: "sale_banner", destination: HREF })
          }
          className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-button bg-white px-3.5 font-medium text-primary text-sm shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-shadow hover:shadow-[0_0_18px_rgba(255,255,255,0.55)]"
        >
          Claim {offer.percent}%
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** A digit pair over its label, then a colon column — four grid cells. */
function Unit({
  value,
  name,
  last,
  colon,
  label,
}: {
  value: number;
  name: string;
  last: boolean;
  colon: string;
  label: string;
}) {
  return (
    <>
      <Pair value={value} />
      <span className={label}>{name}</span>
      {last ? null : (
        <>
          <span className={colon}>:</span>
          <span />
        </>
      )}
    </>
  );
}
