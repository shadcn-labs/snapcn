"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * The glow under the footer, after ruixen.com's `ruixen-gradient-footer` (its
 * gradient after Dia Browser's): blurred columns of colour pinned to the
 * bottom of the viewport that rise from the floor over the last stretch of
 * scroll, full height exactly at the end of the page. Only the glow — the
 * footer's own layout stays ours.
 *
 * In snapcn blue rather than ruixen's rainbow: navy floor → brand blue → sky →
 * near-white → transparent. Swap `STOPS` for the rainbow if wanted.
 *
 * The footer reserves `GLOW_HEIGHT` of padding under its content (site-footer.tsx)
 * so the glow lands in empty space, not over the links.
 */
export const GLOW_HEIGHT = "40vh";

const VBW = 1271;
const VBH = 599;
const BARS = 9;
const STOPS = [
  { offset: 0, color: "#0B1B4A" },
  { offset: 0.2, color: "#2458B0" },
  { offset: 0.38, color: "#1D6BFF" },
  { offset: 0.55, color: "#7FB0F5" },
  { offset: 0.72, color: "#DCEAFE" },
  { offset: 1, color: "#DCEAFE00" },
];

/** A gentle power falloff: short edges, tallest in the middle. */
const HEIGHTS = Array.from({ length: BARS }, (_, i) => {
  const mid = (BARS - 1) / 2;
  const t = Math.abs(i - mid) / mid;
  return 0.98 * VBH * (0.55 + 0.45 * (1 - t ** 1.24));
});

export function FooterGlow() {
  const uid = useId().replace(/:/g, "");
  const band = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = band.current;
    if (!el) return;
    const measure = () => {
      // offsetHeight ignores the transform, so the band measures itself.
      const h = el.offsetHeight || 1;
      const left =
        document.documentElement.scrollHeight - innerHeight - scrollY;
      setProgress(Math.max(0, Math.min(1, (h - left) / h)));
    };
    measure();
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure, { passive: true });
    return () => {
      removeEventListener("scroll", measure);
      removeEventListener("resize", measure);
    };
  }, []);

  const colW = VBW / BARS;

  return (
    <div
      ref={band}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 origin-bottom"
      style={{ height: GLOW_HEIGHT, transform: `scaleY(${progress})` }}
    >
      <svg
        className="block size-full"
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id={`g-${uid}`} x1="0" y1="1" x2="0" y2="0">
            {STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <filter id={`b-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={15} />
          </filter>
        </defs>
        {HEIGHTS.map((h, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed columns.
            key={i}
            filter={`url(#b-${uid})`}
            x={i * colW}
            y={VBH - h}
            width={colW * 1.23}
            height={h}
            fill={`url(#g-${uid})`}
          />
        ))}
      </svg>
    </div>
  );
}
