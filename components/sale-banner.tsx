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
const HEIGHT = "2.75rem";

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
    <div className="sticky top-0 z-40 h-(--fd-banner-height) overflow-hidden bg-primary text-primary-foreground">
      {/* Lit from above, like the reference: a touch lighter at the top edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/12 to-black/5"
      />
      <style>{`:root { --fd-banner-height: ${HEIGHT}; }
@keyframes banner-sweep { 0% { transform: translateX(-30vw); } 70%, 100% { transform: translateX(130vw); } }`}</style>
      <Link
        href={HREF}
        onClick={() =>
          trackEvent("cta_clicked", { cta: "sale_banner", destination: HREF })
        }
        className="group relative flex h-full items-center justify-center gap-3 px-10 text-sm"
      >
        <span className="hidden truncate sm:inline">
          <span className="font-semibold">Templates launch week:</span>{" "}
          <span className="text-primary-foreground/90">
            {percent}% off Pro, applied at checkout. Ends in {remaining(left)}.
          </span>
        </span>
        <span className="truncate sm:hidden">
          <span className="font-semibold">{percent}% off Pro</span>
          <span className="text-background/70"> · {remaining(left)} left</span>
        </span>
        <span
          className={cn(
            buttonVariants({ size: "sm" }),
            "h-7 bg-white/20 px-2.5 font-semibold text-primary-foreground group-hover:bg-white/30",
          )}
        >
          Claim {percent}%
        </span>
      </Link>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-0 h-24 w-40 -translate-y-1/2 animate-[banner-sweep_7s_ease-in-out_infinite] rounded-full bg-white/25 blur-2xl motion-reduce:hidden"
      />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-xs" }),
          "absolute top-1/2 right-3 -translate-y-1/2 text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground",
        )}
        aria-label="Dismiss"
      >
        <X />
      </button>
    </div>
  );
}
