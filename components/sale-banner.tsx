"use client";

import { X } from "lucide-react";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";
import { bannerOfferEnds, bannerOfferStarts } from "@/lib/offer";
import { BANNER_OFFER } from "@/lib/plans";
import { cn } from "@/lib/utils";

// Archivo at its widest, blackest instance: the extended poster grotesk the
// "BLACK FRIDAY" lettering wants. Not preloaded — it paints one card, in a rail.
const poster = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-poster",
  preload: false,
});

const HREF = "/docs/pricing?ref=sale_banner#plans";
/** Published as `--fd-banner-height`; everything sticky offsets by it. */
const HEIGHT = "2.375rem";

/**
 * Account pages, where an offer reads as "you still have to pay" — and the
 * studio, a full-screen app where a bar costs canvas and sits on its toolbar.
 */
const QUIET = ["/signin", "/account", "/studio"];

/** "4d 21h" while days are left, then "5h 12m" — plain text, no ticking. */
export function remaining(ms: number) {
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}

/**
 * The site-wide offer bar: Black Friday, from `BANNER_OFFER.startsAt` until
 * `BANNER_OFFER.endsAt`, when it goes and checkout stops applying the codes.
 * One line on the brand blue (`--primary`), the whole bar a link, a shadcn
 * `Button` as the chip and a soft glow drifting across. Percents, not prices:
 * regional (PPP) visitors pay less than the USD list.
 *
 * Decided on the client only: most pages are prerendered. Dismissible for the
 * visit. Not shown to a paying customer — an offer on a plan they own reads as
 * a billing mistake — nor on sign-in and `/account` (see `QUIET`).
 */
type Line = { text: string; x: number; y: number; w: number };

/**
 * Poster lettering: white type over `depth` stacked copies, each `step` further
 * down-right, filled pale blue and outlined in the brand blue — the outline of
 * every layer is what draws the ridges. Each line is pinned to its width
 * (`textLength`), so a fallback face can never overflow the box.
 */
function Lettering({
  lines,
  size,
  depth,
  step,
  rotate,
  viewBox,
  stroke,
  className,
  children,
}: {
  lines: Line[];
  size: number;
  depth: number;
  step: number;
  rotate: number;
  viewBox: [number, number];
  stroke: number;
  className?: string;
  children?: React.ReactNode;
}) {
  // `useId` carries characters a `url(#…)` reference chokes on.
  const id = useId().replace(/[^\w-]/g, "");
  const [w, h] = viewBox;
  const type = {
    fontFamily: "var(--font-poster)",
    fontWeight: 900,
    fontVariationSettings: "'wdth' 125",
    fontSize: size,
  } as const;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" x2={w}>
          <stop offset="0" stopColor="#c9d9ff" />
          <stop offset="1" stopColor="#8fb4ff" />
        </linearGradient>
      </defs>
      {children}
      <g transform={`rotate(${rotate} ${w / 2} ${h / 2})`} style={type}>
        {Array.from({ length: depth }, (_, i) => depth - i).map((k) =>
          lines.map((l) => (
            <text
              key={`${k}${l.text}`}
              x={l.x + k * step}
              y={l.y + k * step}
              textLength={l.w}
              lengthAdjust="spacingAndGlyphs"
              fill={`url(#${id})`}
              stroke="#0a2a7a"
              strokeWidth={stroke}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {l.text}
            </text>
          )),
        )}
        {lines.map((l) => (
          <text
            key={l.text}
            x={l.x}
            y={l.y}
            textLength={l.w}
            lengthAdjust="spacingAndGlyphs"
            fill="#fff"
          >
            {l.text}
          </text>
        ))}
      </g>
    </svg>
  );
}

/**
 * Milliseconds left in the sale for this visitor, or `null` when it is not
 * theirs to see: outside the window, still loading the session, or on a paid
 * plan (an offer on a plan they own reads as a billing mistake). Shared by the
 * bar and the rail's card so the two cannot disagree.
 */
export function useSaleLeft(): number | null {
  const { data: session, status } = useSession();
  const tier = session?.user?.tier ?? session?.user?.plan ?? "free";
  const [left, setLeft] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    // `?banner=preview` in dev shows the sale before its window opens (and to
    // a paying account), so it can be checked without moving the dates.
    const preview =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(location.search).get("banner") === "preview";
    setPreview(preview);
    const start = preview ? 0 : bannerOfferStarts();
    const end = bannerOfferEnds();
    const tick = () => setLeft(Date.now() < start ? 0 : end - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (status === "loading" || left === null || left <= 0) return null;
  if (!preview && tier !== "free" && tier !== "starter") return null;
  return left;
}

export function SaleBanner() {
  const trackEvent = useTrackEvent();
  const pathname = usePathname();
  const left = useSaleLeft();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || left === null) return null;
  if (QUIET.some((p) => pathname?.startsWith(p))) return null;
  const life = Math.round(BANNER_OFFER.products.lifetime.percent);
  const team = Math.round(BANNER_OFFER.products.commercial.percent);

  return (
    // The primary surface, lit from above: flat across, falling top to bottom
    // (`bg-primary-gradient`, measured off the reference bar).
    <div
      className={`${poster.variable} sticky top-0 z-40 h-(--fd-banner-height) overflow-hidden bg-primary bg-primary-gradient text-white`}
    >
      <style>{`:root { --fd-banner-height: ${HEIGHT}; }
@keyframes banner-sweep { 0% { transform: translateX(-20vw) translateY(-50%); } 70%, 100% { transform: translateX(120vw) translateY(-50%); } }`}</style>
      {/* One soft light crossing the bar: 120px wide, ~36% white at its heart
          and gone at its edge, taller than the bar so it lifts it top to
          bottom — a radial gradient, not a blur, so it never smears. */}
      {/* Black Friday's shade: the blue falls to near-black at both ends. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(0_0_0/0.55),rgb(0_0_0/0.12)_30%,rgb(0_0_0/0.12)_70%,rgb(0_0_0/0.55))]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-0 h-[200%] w-30 animate-[banner-sweep_7s_ease-in-out_infinite] bg-[radial-gradient(closest-side,rgb(255_255_255/0.36),rgb(255_255_255/0.16)_50%,transparent)] motion-reduce:hidden"
      />
      <Link
        href={HREF}
        onClick={() =>
          trackEvent("cta_clicked", { cta: "sale_banner", destination: HREF })
        }
        className="group relative flex h-full items-center justify-center gap-3 px-10 text-sm"
      >
        <Lettering
          lines={[{ text: "BLACK FRIDAY", x: 2, y: 24, w: 196 }]}
          size={24}
          depth={3}
          step={1.4}
          rotate={0}
          viewBox={[204, 32]}
          stroke={1.2}
          className="hidden h-[18px] w-auto shrink-0 sm:block"
        />
        <span className="sr-only">{BANNER_OFFER.name}:</span>
        <span className="hidden truncate sm:inline">
          Lifetime {life}% off, Commercial {team}% off, applied at checkout.
          Ends in {remaining(left)}.
        </span>
        <span className="truncate sm:hidden">
          <span className="font-semibold">Lifetime {life}% off</span>
          <span className="text-white/80"> · {remaining(left)} left</span>
        </span>
        {/* Frosted, not filled: 20% white over the bar, no edge, no shadow. */}
        <span
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-[26px] rounded-md bg-white/20 px-2.5 font-semibold text-white hover:bg-white/30 hover:text-white group-hover:bg-white/30",
          )}
        >
          Claim {life}%
        </span>
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-xs" }),
          "absolute top-1/2 right-3 -translate-y-1/2 text-white/70 hover:bg-white/15 hover:text-white",
        )}
        aria-label="Dismiss"
      >
        <X />
      </button>
    </div>
  );
}
