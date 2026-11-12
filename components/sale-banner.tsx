"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";
import { bannerOfferEnds } from "@/lib/offer";
import { BANNER_OFFER } from "@/lib/plans";
import { cn } from "@/lib/utils";

const HREF = "/docs/pricing?ref=sale_banner#plans";
/** Published as `--fd-banner-height`; everything sticky offsets by it. */
const HEIGHT = "2.375rem";

/**
 * Account pages, where an offer reads as "you still have to pay" — and the
 * studio, a full-screen app where a bar costs canvas and sits on its toolbar.
 */
const QUIET = ["/signin", "/account", "/studio"];

/** "4d 21h" while days are left, then "5h 12m" — plain text, no ticking. */
function remaining(ms: number) {
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}

/**
 * The site-wide offer bar: `BANNER_OFFER.percent` off for templates launch
 * week until `BANNER_OFFER.endsAt`, when it goes and checkout stops applying
 * the code. One line on the brand blue (`--primary`), the whole bar a
 * link, a shadcn `Button` as the chip and a soft glow drifting across.
 *
 * Decided on the client only: most pages are prerendered. Dismissible for the
 * visit. Not shown to a paying customer — an offer on a plan they own reads as
 * a billing mistake — nor on sign-in and `/account` (see `QUIET`).
 */
export function SaleBanner() {
  const trackEvent = useTrackEvent();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const tier = session?.user?.tier ?? session?.user?.plan ?? "free";
  const [left, setLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const end = bannerOfferEnds();
    const tick = () => setLeft(end - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (dismissed || status === "loading" || left === null || left <= 0)
    return null;
  if (tier !== "free" && tier !== "starter") return null;
  if (QUIET.some((p) => pathname?.startsWith(p))) return null;
  const { percent } = BANNER_OFFER;

  return (
    // The primary surface, lit from above: flat across, falling top to bottom
    // (`bg-primary-gradient`, measured off the reference bar).
    <div className="sticky top-0 z-40 h-(--fd-banner-height) overflow-hidden bg-primary bg-primary-gradient text-white">
      <style>{`:root { --fd-banner-height: ${HEIGHT}; }
@keyframes banner-sweep { 0% { transform: translateX(-20vw) translateY(-50%); } 70%, 100% { transform: translateX(120vw) translateY(-50%); } }`}</style>
      {/* One soft light crossing the bar: 120px wide, ~36% white at its heart
          and gone at its edge, taller than the bar so it lifts it top to
          bottom — a radial gradient, not a blur, so it never smears. */}
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
        <span className="hidden truncate sm:inline">
          <span className="font-semibold">Templates launch week:</span>{" "}
          {percent}% off Pro, applied at checkout. Ends in {remaining(left)}.
        </span>
        <span className="truncate sm:hidden">
          <span className="font-semibold">{percent}% off Pro</span>
          <span className="text-white/80"> · {remaining(left)} left</span>
        </span>
        {/* Frosted, not filled: 20% white over the bar, no edge, no shadow. */}
        <span
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-[26px] rounded-md bg-white/20 px-2.5 font-semibold text-white hover:bg-white/30 hover:text-white group-hover:bg-white/30",
          )}
        >
          Claim {percent}%
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
