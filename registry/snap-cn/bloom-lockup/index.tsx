"use client";

import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { type ReactNode, useEffect, useId, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";
import {
  BEHIND_LOGO,
  BLOOM_CARDS,
  BLOOM_DELAY,
  BLOOM_FADE,
  BLOOM_SECONDS,
  BLOOM_ZOOM,
  CARD_HALO,
  CARD_IMAGES,
  HOLD_SECONDS,
  LENS,
  LENS_FLASH,
  LENS_FROM,
  LENS_RADIUS,
  LENS_ZOOM,
  LOCKUP_CARDS,
  LOCKUP_SECONDS,
  LOGO_FADE,
  LOGO_SIZE_BLOOM,
  LOGO_SIZE_LOCKUP,
  LOGO_Y,
  SNAPCN_MARK,
  TAGLINE_FADE,
  TAGLINE_RISE,
  TAGLINE_Y,
  WORDMARK_FADE,
  WORDMARK_RISE,
  WORDMARK_Y,
} from "./data";

const { fontFamily: POPPINS } = loadPoppins("normal", {
  weights: ["600"],
  subsets: ["latin"],
});
const { fontFamily: GEIST_MONO } = loadGeistMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const STAGE_W = 1920;
const STAGE_H = 1080;
const RATE = 30;

export interface BloomLockupProps {
  /** The wordmark under the logo. */
  wordmark?: string;
  /** The line under the wordmark. */
  tagline?: string;
  /** Your mark as SVG paths, like Cut Lockup's `logo`. Defaults to the snapcn mark. */
  logo?: {
    width: number;
    height: number;
    shapes: readonly string[];
    /** Share of the tile the mark fills. */
    fill?: number;
  };
  /** Pictures for the cards; repeats if there are fewer than cards. */
  images?: readonly string[];
  /** One picture per card on the first board, in order. */
  imagesA?: readonly string[];
  /** One picture per card on the second board, in order. */
  imagesB?: readonly string[];
  wordmarkFont?: string;
  wordmarkWeight?: number;
  /** Wordmark size on a 1920x1080 stage. */
  wordmarkSize?: number;
  speed?: number;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

/** Sample a 1/30s table at a time in seconds; holds both ends. */
export const sample = (table: readonly number[], seconds: number) => {
  const x = Math.max(0, Math.min(seconds * RATE, table.length - 1));
  const i = Math.floor(x);
  const a = table[i] ?? 0;
  return a + ((table[i + 1] ?? a) - a) * (x - i);
};

/** Opacity of a bloom card at `t`: the wave leaves the logo and spreads outward. */
export const cardFade = (i: number, t: number) => {
  const k = (t - (BLOOM_DELAY[i] ?? 0)) / (BLOOM_FADE[i] ?? 0.2);
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};

/** Frames in the whole clip at `fps`. */
export const clipFrames = (fps: number) =>
  Math.ceil((BLOOM_SECONDS + LOCKUP_SECONDS + HOLD_SECONDS) * fps);

/** What a lens of strength `q` shows at `r` radii out, as a share of `r`. */
export const lensFactor = (q: number, r: number) =>
  1 / Math.sqrt(1 + q * r * r);

/** The uniform scale that leaves the least for the 8-bit map to carry. */
export const lensSplit = (q: number, rMax: number) => {
  const worst = (c: number) => {
    let m = 0;
    for (let j = 1; j <= 64; j++) {
      const r = (rMax * j) / 64;
      m = Math.max(m, r * Math.abs(lensFactor(q, r) / c - 1));
    }
    return m;
  };
  let lo = lensFactor(q, rMax);
  let hi = 1;
  for (let it = 0; it < 60; it++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (worst(a) < worst(b)) hi = b;
    else lo = a;
  }
  return (lo + hi) / 2;
};

const MAP_W = 240;
const MAP_H = 135;
type LensMap = { href: string; scale: number; split: number };

/** One displacement map per lens row, decoded before the first frame that needs it. */
const useLensMaps = () => {
  const [maps, setMaps] = useState<LensMap[] | null>(null);
  useEffect(() => {
    const handle = delayRender("bloom-lockup: lens maps");
    const cx = STAGE_W / 2;
    const cy = STAGE_H / 2;
    const rMax = Math.hypot(cx, cy) / LENS_RADIUS;
    const canvas = document.createElement("canvas");
    canvas.width = MAP_W;
    canvas.height = MAP_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      continueRender(handle);
      return;
    }
    const out = LENS.map((q) => {
      const split = lensSplit(q, rMax);
      const field: number[] = [];
      let peak = 1e-3;
      for (let j = 0; j < MAP_H; j++) {
        for (let i = 0; i < MAP_W; i++) {
          const dx = ((i + 0.5) / MAP_W) * STAGE_W - cx;
          const dy = ((j + 0.5) / MAP_H) * STAGE_H - cy;
          const g = lensFactor(q, Math.hypot(dx, dy) / LENS_RADIUS) / split - 1;
          field.push(dx * g, dy * g);
          peak = Math.max(peak, Math.abs(dx * g), Math.abs(dy * g));
        }
      }
      const scale = peak * 2.02;
      const img = ctx.createImageData(MAP_W, MAP_H);
      for (let p = 0; p < MAP_W * MAP_H; p++) {
        img.data[p * 4] = Math.round(255 * (0.5 + (field[2 * p] ?? 0) / scale));
        img.data[p * 4 + 1] = Math.round(
          255 * (0.5 + (field[2 * p + 1] ?? 0) / scale),
        );
        img.data[p * 4 + 2] = 128;
        img.data[p * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return { href: canvas.toDataURL("image/png"), scale, split };
    });
    Promise.all(
      out.map((m) => {
        const im = new Image();
        im.src = m.href;
        return im.decode().catch(() => undefined);
      }),
    ).then(() => {
      setMaps(out);
      continueRender(handle);
    });
  }, []);
  return maps;
};

/** Type at a fraction of a device row: two copies added by the fraction between. */
const Line: React.FC<{
  y: number;
  opacity: number;
  px: number;
  children: ReactNode;
}> = ({ y, opacity, px, children }) => {
  if (opacity <= 0) return null;
  const row = Math.floor(y * px);
  const f = y * px - row;
  return (
    <g opacity={opacity} style={{ isolation: "isolate" }}>
      {[
        { r: row, w: 1 - f },
        { r: row + 1, w: f },
      ].map(({ r, w }) => (
        <g
          key={r}
          transform={`translate(${STAGE_W / 2} ${(r + 1e-3) / px})`}
          style={{ opacity: w, mixBlendMode: "plus-lighter" }}
        >
          {children}
        </g>
      ))}
    </g>
  );
};

const Card: React.FC<{
  rect: readonly number[];
  src: string;
  halo: number;
  opacity: number;
  fill: string;
}> = ({ rect, src, halo, opacity, fill }) => {
  const [x = 0, y = 0, w = 0, h = 0] = rect;
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        overflow: "hidden",
        background: fill,
        boxShadow: `0 0 ${halo}px ${halo * 0.6}px rgba(0,0,0,0.05)`,
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "none",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
};

/**
 * Bloom Lockup: a wall of finished work blooms outward from your logo, cuts in
 * tight on it, then bends away through a lens and a flash as the logo rises to its wordmark. `t` is
 * seconds into the clip.
 */
export const BloomLockupScene: React.FC<BloomLockupProps & { t: number }> = ({
  t,
  wordmark = "snapcn",
  tagline = "snapcn.dev",
  logo = SNAPCN_MARK,
  images = CARD_IMAGES,
  imagesA,
  imagesB,
  wordmarkFont,
  wordmarkWeight = 600,
  wordmarkSize = 112,
  theme,
  mode,
}) => {
  const c = useSnapCnTheme(theme, mode);
  const { width, height } = useVideoConfig();
  const px = Math.max(width / STAGE_W, height / STAGE_H);
  const bloom = t < BLOOM_SECONDS;
  const b = t - BLOOM_SECONDS;
  const pick = (list: readonly string[], i: number) =>
    list[i % Math.max(1, list.length)] ?? "";

  const size = bloom ? sample(LOGO_SIZE_BLOOM, t) : sample(LOGO_SIZE_LOCKUP, b);
  const y = bloom ? STAGE_H / 2 : sample(LOGO_Y, b);
  const zoom = bloom ? sample(BLOOM_ZOOM, t) : 1 + 0.00009 * (0.55 - b) * 60;
  const lift = bloom ? 0 : -3.5 * (b - 0.4);
  const uid = useId().replace(/:/g, "");
  const maps = useLensMaps();
  const row = bloom ? -1 : Math.round((b - LENS_FROM) * RATE);
  const gone = row >= LENS.length;
  const map = row >= 0 && !gone ? (maps?.[row] ?? null) : null;
  const flash = bloom ? undefined : LENS_FLASH[row - (LENS.length - 2)];
  const logoScale =
    (size * (("fill" in logo ? logo.fill : undefined) ?? 0.56)) /
    Math.max(logo.width, logo.height);

  return (
    <AbsoluteFill style={{ background: c.background, overflow: "hidden" }}>
      {map ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
          <filter
            id={uid}
            x={0}
            y={0}
            width={STAGE_W}
            height={STAGE_H}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={map.href}
              x={0}
              y={0}
              width={STAGE_W}
              height={STAGE_H}
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={map.scale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="bent"
            />
            {flash ? (
              <>
                <feComponentTransfer in="bent" result="lit">
                  <feFuncR type="linear" slope={flash[0]} />
                  <feFuncG type="linear" slope={flash[1]} />
                  <feFuncB type="linear" slope={flash[2]} />
                </feComponentTransfer>
                <feGaussianBlur in="lit" stdDeviation={flash[3]} />
              </>
            ) : null}
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill
        style={{
          filter: map ? `url(#${uid})` : undefined,
        }}
      >
        <AbsoluteFill
          style={{
            transform: `translateY(${lift}px) scale(${
              zoom * (map ? (LENS_ZOOM[row] ?? 1) / map.split : 1)
            })`,
            transformOrigin: "50% 50%",
          }}
        >
          {bloom
            ? BLOOM_CARDS.map((rect, i) =>
                !imagesA && i === BEHIND_LOGO.bloom ? null : (
                  <Card
                    key={rect.join()}
                    rect={rect}
                    src={imagesA ? pick(imagesA, i) : pick(images, i)}
                    halo={CARD_HALO.bloom}
                    fill={c.card}
                    opacity={cardFade(i, t)}
                  />
                ),
              )
            : !gone &&
              LOCKUP_CARDS.map((rect, i) =>
                !imagesB && i === BEHIND_LOGO.lockup ? null : (
                  <Card
                    key={rect.join()}
                    rect={rect}
                    src={imagesB ? pick(imagesB, i) : pick(images, i + 7)}
                    halo={CARD_HALO.lockup}
                    fill={c.card}
                    opacity={1}
                  />
                ),
              )}
        </AbsoluteFill>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: STAGE_W / 2 - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size * 0.235,
          background: c.foreground,
          opacity: bloom ? sample(LOGO_FADE, t) : 1,
          boxShadow: `0 ${size * 0.1}px ${size * 0.34}px rgba(0,0,0,0.22)`,
        }}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          style={{ position: "absolute", inset: 0 }}
        >
          <title>{wordmark}</title>
          <g
            transform={`translate(${size / 2} ${size / 2}) scale(${logoScale}) translate(${-logo.width / 2} ${-logo.height / 2})`}
          >
            {logo.shapes.map((d) => (
              <path key={d} d={d} fill={c.card} fillRule="evenodd" />
            ))}
          </g>
        </svg>
      </div>

      {!bloom && (
        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <title>{tagline}</title>
          <Line
            y={WORDMARK_Y + sample(WORDMARK_RISE, b)}
            opacity={sample(WORDMARK_FADE, b)}
            px={px}
          >
            <text
              textAnchor="middle"
              fill={c.foreground}
              style={{
                fontFamily: resolveFont(wordmarkFont) ?? POPPINS,
                fontWeight: wordmarkWeight,
                fontSize: wordmarkSize,
                letterSpacing: "-0.02em",
                textRendering: "geometricPrecision",
              }}
            >
              {wordmark}
            </text>
          </Line>
          <Line
            y={TAGLINE_Y + sample(TAGLINE_RISE, b)}
            opacity={sample(TAGLINE_FADE, b)}
            px={px}
          >
            <text
              textAnchor="middle"
              fill={c.mutedForeground}
              style={{
                fontFamily: GEIST_MONO,
                fontSize: 40,
                textRendering: "geometricPrecision",
              }}
            >
              {tagline}
            </text>
          </Line>
        </svg>
      )}
    </AbsoluteFill>
  );
};

export const BloomLockup: React.FC<BloomLockupProps> = ({
  speed = 1,
  ...props
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <BloomLockupScene {...props} t={(frame * speed) / fps} />;
};

export default BloomLockup;
