"use client";

import { Star, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { GITHUB_URL } from "@/config/site";
import { useTrackEvent } from "@/lib/analytics";
import { formatStars } from "@/lib/github";
import { CATALOGUE_PROMISE } from "@/lib/plans";

const KEY = "snapcn:nudge-seen";
const DELAY_MS = 45_000;
const PRO_HREF = "/docs/pricing?ref=nudge#plans";
/** Pricing already sells; account and studio are where a card is in the way. */
const QUIET = ["/docs/pricing", "/signin", "/account", "/studio"];

/**
 * "Liking snapcn so far?" — once per browser, bottom-right, after the visitor
 * copies an install command (proven interest) or after 45s, whichever first.
 * Get Pro is the primary action, Star the free one. Not shown to paying tiers.
 */
export function NudgeCard() {
  const trackEvent = useTrackEvent();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const tier = session?.user?.tier ?? session?.user?.plan ?? "free";

  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    const show = () => setOpen(true);
    const id = setTimeout(show, DELAY_MS);
    window.addEventListener("snapcn:installed", show);
    return () => {
      clearTimeout(id);
      window.removeEventListener("snapcn:installed", show);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("https://api.github.com/repos/shadcn-labs/snapcn")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d) =>
          typeof d?.stargazers_count === "number" &&
          setStars(d.stargazers_count),
      )
      .catch(() => {});
  }, [open]);

  if (!open || status === "loading") return null;
  if (tier !== "free" && tier !== "starter") return null;
  if (QUIET.some((p) => pathname?.startsWith(p))) return null;

  const close = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Enjoying snapcn?"
      className="fixed right-5 bottom-5 z-50 w-[19rem] max-w-[calc(100vw-2.5rem)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 rounded-[20px] bg-popover p-1.5 text-popover-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-12px_rgba(0,0,0,0.25)] duration-300 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.6)]"
    >
      <div className="relative overflow-hidden rounded-[14px] bg-muted">
        {/* ponytail: 1.5MB launch film, fetched only once the card opens. */}
        <video
          src="https://media.snapcn.dev/home/snapcn-launch.mp4"
          poster="https://media.snapcn.dev/home/snapcn-launch.jpg"
          autoPlay
          muted
          loop
          playsInline
          className="aspect-video w-full object-cover"
        />
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition-colors hover:bg-black/60"
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      </div>
      <div className="px-2.5 pt-3.5 pb-2.5">
        <p className="font-semibold text-[15px] tracking-[-0.01em]">
          Enjoying snapcn?
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground leading-[1.45]">
          Star us on GitHub, or unlock {CATALOGUE_PROMISE.components} Pro
          components and templates.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            trackEvent("cta_clicked", {
              cta: "nudge_star",
              destination: GITHUB_URL,
            });
            close();
          }}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[12px] bg-muted font-medium text-[13px] transition-colors hover:bg-accent"
        >
          <Star className="size-3.5" />
          Star
          {stars !== null && stars > 0 && (
            <span className="text-muted-foreground tabular-nums">
              {formatStars(stars)}
            </span>
          )}
        </a>
        <Link
          href={PRO_HREF}
          onClick={() => {
            trackEvent("cta_clicked", {
              cta: "nudge_pro",
              destination: PRO_HREF,
            });
            close();
          }}
          className="inline-flex h-9 items-center justify-center rounded-[12px] bg-foreground font-medium text-[13px] text-background transition-opacity hover:opacity-85"
        >
          Get Pro
        </Link>
      </div>
    </div>
  );
}
