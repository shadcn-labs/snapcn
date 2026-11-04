"use client";

import { loadFont } from "@remotion/google-fonts/Inter";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * Hello Zoom — words flicker on a dark card and grow, one word lands huge on a
 * light card, the rest of its line types on, then the camera flies through a
 * letter. The type is a hole, not ink: the next card has been behind it all along.
 *
 * Every number is measured frame by frame off the reference. The scene is drawn
 * in a 1920-wide stage and scaled to the composition, so the numbers read as
 * reference px at any size.
 */

const { fontFamily: INTER } = loadFont("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const STAGE_W = 1920;

/** Piecewise-linear lookup over [frame, value] pairs, held at the ends. */
export const track = (
  pts: readonly (readonly [number, number])[],
  t: number,
) => {
  if (t <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i]!;
    const [t0, v0] = pts[i - 1]!;
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return pts[pts.length - 1]![1];
};

// --- The shot list, in frames at 30fps ---------------------------------------

/** The words share this many beats; the cut to the lead takes the last one. */
const FLICKER_BEATS = 21;
const LEAD_AT = 20;
const LINE_AT = 25;
const TYPE_FRAMES = 5;
const NEXT_AT = 49;

/** Font size and baseline below centre of each word, read across the flicker. */
const WORD_SIZE = [75.4, 93.7, 115.9, 124.9, 150.2, 186.3, 225.1];
const WORD_DROP = [20.4, 25.3, 30.2, 31.9, 40.5, 49.9, 60.1];
/** Each word sits this far off true centre in the reference, px. */
const WORD_NUDGE = [-0.3, -1.8, -2, -0.8, -0.3, -2.1, -2.9];
const WORD_TRACKING = -0.02;

const LEAD_SIZE = 433.14;
const LEAD_DROP = 156.57;
const LEAD_TRACKING = -0.047;
/** The reference sets the lead this far left of true centre, px. */
const LEAD_NUDGE = -17.7;
/** The lead starts to leave before the cut: px left of centre. */
const LEAD_DRIFT = [
  [20, 0],
  [21, 1.54],
  [22, 4.37],
  [23, 9.37],
  [24, 18],
] as const;

const LINE_SIZE = 210.38;
const LINE_TRACKING = -0.025;
/** How much of the way from its resting spot to a centred lead the line starts. */
const LINE_START = 0.6893;
/** The line's slide to rest, as the fraction of that distance still to go. */
const LINE_SLIDE = [
  [25, 1],
  [26, 0.6139],
  [27, 0.3242],
  [28, 0.183],
  [29, 0.1012],
  [30, 0.0503],
  [31, 0.0203],
  [32, 0.0047],
  [33, 0],
] as const;

/** The push through the letter, about the middle of the stage. */
const ZOOM = [
  [36, 1],
  [37, 1.0036],
  [38, 1.0155],
  [39, 1.0371],
  [40, 1.071],
  [41, 1.1213],
  [42, 1.1947],
  [43, 1.3018],
  [44, 1.4694],
  [45, 1.7476],
  [46, 2.2753],
  [47, 3.5662],
  [48, 11.7],
] as const;

/** The camera drifts off the stage's centre as it dives, px. */
const ZOOM_X = [
  [37, 0],
  [38, -0.3],
  [44, -0.64],
  [45, -0.98],
  [46, -2.27],
  [47, -1.25],
  [48, -30.9],
] as const;
const ZOOM_Y = [
  [42, 0],
  [43, 0.15],
  [45, 0.18],
  [46, 0.74],
  [47, 2.13],
  [48, 4.35],
] as const;

const NEXT_SIZE = 74;
const NEXT_DROP = 19.7;
/** The next word rushes up from nothing behind the type, then barely creeps. */
const NEXT_SCALE = [
  [41, 0],
  [42, 0.01],
  [43, 0.0576],
  [44, 0.1023],
  [45, 0.1647],
  [46, 0.262],
  [47, 0.4035],
  [48, 0.615],
  [49, 0.868],
  [50, 0.993],
  [51, 1],
  [75, 1.05],
] as const;

/** Copy never runs wider than this. */
const MAX_WIDTH = 1728;

// --- Timeline helpers --------------------------------------------------------

/** Which word of `count` is up at frame `f`. */
export const wordAt = (f: number, count: number) =>
  Math.min(count - 1, Math.floor((f * count) / FLICKER_BEATS));

/** How many characters of `length` have been typed at frame `f`. */
export const typedAt = (f: number, length: number) =>
  Math.round(
    Math.min(1, Math.max(0, Math.floor(f - LINE_AT) / TYPE_FRAMES)) * length,
  );

/**
 * The deepest point of ink between columns `from` and `to` of a raster, by
 * chamfer distance to the nearest paper. This is what the camera flies through:
 * aim at a letter's counter and it comes out the far side onto blank paper.
 * Ties go to the point nearest the middle of the span and of `midY`.
 */
export const deepestInk = (
  alpha: ArrayLike<number>,
  w: number,
  h: number,
  from: number,
  to: number,
  midY: number,
) => {
  const d = new Float32Array(w * h);
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x]! > 127)
        d[y * w + x] =
          1 +
          Math.min(
            at(x - 1, y),
            at(x, y - 1),
            at(x - 1, y - 1),
            at(x + 1, y - 1),
          );
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--)
      if (d[y * w + x]! > 0)
        d[y * w + x] = Math.min(
          d[y * w + x]!,
          1 +
            Math.min(
              at(x + 1, y),
              at(x, y + 1),
              at(x + 1, y + 1),
              at(x - 1, y + 1),
            ),
        );
  const midX = (from + to) / 2;
  let best = { x: midX, y: midY, r: 0 };
  let top = -Infinity;
  for (let y = 0; y < h; y++)
    for (let x = from; x < to; x++) {
      const r = at(x, y);
      const score = r - 0.01 * (Math.abs(x - midX) + Math.abs(y - midY));
      if (r > 0 && score > top) {
        top = score;
        best = { x, y, r };
      }
    }
  return best;
};

interface Metrics {
  /** Advance widths in em. */
  words: number[];
  lead: number;
  /** The lead at the line's tracking. */
  leadInLine: number;
  line: number;
  next: number;
  /** The point of the line the camera flies through: em right of its start, up from its baseline. */
  through: [number, number];
}

/** A canvas shapes type the way the page does, and rasters it for `deepestInk`. */
const measure = (
  face: string,
  weight: number,
  words: string[],
  lead: string,
  line: string,
  next: string,
): Metrics => {
  const P = 100; // raster px per em
  const ctx = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true })!;
  const setFont = (tracking: number) => {
    ctx.font = `${weight} ${P}px ${face}`;
    ctx.letterSpacing = `${tracking * P}px`;
  };
  const em = (text: string, tracking: number) => {
    setFont(tracking);
    return ctx.measureText(text).width / P;
  };
  const out = {
    words: words.map((w) => em(w, WORD_TRACKING)),
    lead: em(lead, LEAD_TRACKING),
    leadInLine: em(lead, LINE_TRACKING),
    line: em(line, LINE_TRACKING),
    next: em(next, WORD_TRACKING),
  };
  const w = Math.ceil(out.line * P);
  const h = 2 * P;
  const base = 1.3 * P;
  ctx.canvas.width = w;
  ctx.canvas.height = h;
  setFont(LINE_TRACKING); // resizing a canvas resets its state
  ctx.fillText(line, 0, base);
  const { data } = ctx.getImageData(0, 0, w, h);
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]!;
  // The middle of the line only: the point lands on the stage's centre, and one
  // near an end would throw the whole line off to the side.
  const p = deepestInk(
    alpha,
    w,
    h,
    Math.round(w * 0.35),
    Math.round(w * 0.65),
    base - 0.26 * P,
  );
  return { ...out, through: [p.x / P, (base - p.y) / P] };
};

/**
 * Chrome snaps a glyph's baseline to a whole device pixel, so a line moving
 * vertically climbs in steps and a resting one sits up to half a pixel off. Two
 * copies a pixel apart, summed in a group, land the baseline anywhere between.
 */
const Line = ({
  x,
  y,
  scale = 1,
  size,
  tracking,
  px,
  fill,
  anchor,
  children,
}: {
  x: number;
  y: number;
  scale?: number;
  size: number;
  tracking: number;
  px: number;
  fill: string;
  anchor?: "middle";
  children: ReactNode;
}) => {
  const row = Math.floor(y * px);
  const f = y * px - row;
  const copy = (base: number, opacity: number) => (
    <text
      transform={`translate(${x} ${base / px}) scale(${scale})`}
      fontSize={size}
      fill={fill}
      opacity={opacity}
      textAnchor={anchor}
      style={{ mixBlendMode: "plus-lighter", letterSpacing: `${tracking}em` }}
    >
      {children}
    </text>
  );
  return (
    <g style={{ isolation: "isolate" }}>
      {copy(row, 1 - f)}
      {copy(row + 1, f)}
    </g>
  );
};

export interface HelloZoomProps {
  /** The words that flicker on the first card. A comma-separated string works too. */
  words?: string[] | string;
  /** The word that lands huge on the second card. */
  lead?: string;
  /** Typed on after the lead. */
  rest?: string;
  /** What the camera finds behind the type. */
  nextWord?: string;
  /** A label from `fonts.ts` or a CSS family you have loaded. Defaults to Inter. */
  fontFamily?: string;
  fontWeight?: number;
  /** The first and last cards, and the type on the second. Defaults to `foreground`. */
  inkColor?: string;
  /** The second card, and the type on the first and last. Defaults to `background`. */
  paperColor?: string;
  /**
   * The point of the resting line the camera flies through, in em right of the
   * line's start and up from its baseline. Unset, it finds the deepest ink near the middle.
   */
  through?: [number, number];
  speed?: number;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

export const HelloZoom = ({
  words = [
    "React",
    "Remotion",
    "shadcn",
    "Next.js",
    "Vite",
    "Tailwind",
    "TypeScript",
  ],
  lead = "Hello",
  rest = "snapcn.",
  nextWord = "npx",
  fontFamily,
  fontWeight = 700,
  inkColor,
  paperColor,
  through,
  speed = 1,
  theme,
  mode,
}: HelloZoomProps) => {
  const t = useSnapCnTheme(theme, mode);
  const f = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const id = useId().replace(/:/g, "");
  const ink = inkColor ?? t.foreground;
  const paper = paperColor ?? t.background;
  const face = resolveFont(fontFamily) ?? resolveFont(t.fontFamily) ?? INTER;
  const list = (typeof words === "string" ? words.split(",") : words)
    .map((w) => w.trim())
    .filter(Boolean);
  const line = `${lead} ${rest}`;
  const joined = list.join("\n");

  const [m, setM] = useState<Metrics | null>(null);
  const [handle] = useState(() => delayRender("hello-zoom: measuring type"));
  useEffect(() => {
    let live = true;
    // measuring a fallback face measures the wrong face
    document.fonts
      .load(`${fontWeight} 100px ${face}`, joined + line + nextWord)
      .catch(() => undefined)
      .then(() => {
        if (live)
          setM(
            measure(face, fontWeight, joined.split("\n"), lead, line, nextWord),
          );
      });
    return () => {
      live = false;
    };
  }, [face, fontWeight, joined, lead, line, nextWord]);
  useEffect(() => {
    if (m) continueRender(handle);
  }, [m, handle]);

  const W = STAGE_W;
  const H = (STAGE_W * height) / width;
  const cx = W / 2;
  const cy = H / 2;
  const px = width / W;

  const type: CSSProperties = {
    fontFamily: face,
    fontWeight,
    textRendering: "geometricPrecision",
    whiteSpace: "pre",
  };
  const fit = (size: number, em: number) => Math.min(size, MAX_WIDTH / em);

  const scene = () => {
    if (!m) return null;

    const nextScale = track(NEXT_SCALE, f);
    const next = (
      <Line
        x={cx}
        y={cy + NEXT_DROP * nextScale}
        scale={nextScale}
        size={fit(NEXT_SIZE, m.next)}
        tracking={WORD_TRACKING}
        px={px}
        fill={paper}
        anchor="middle"
      >
        {nextWord}
      </Line>
    );

    // ---- 1. the flicker
    if (f < LEAD_AT) {
      const i = wordAt(f, list.length);
      const at = list.length > 1 ? (i / (list.length - 1)) * 6 : 0;
      const row = WORD_SIZE.map((v, j) => [j, v] as const);
      const drop = WORD_DROP.map((v, j) => [j, v] as const);
      const nudge = WORD_NUDGE.map((v, j) => [j, v] as const);
      return (
        <Line
          x={cx + track(nudge, at)}
          y={cy + track(drop, at)}
          size={fit(track(row, at), m.words[i]!)}
          tracking={WORD_TRACKING}
          px={px}
          fill={paper}
          anchor="middle"
        >
          {list[i]}
        </Line>
      );
    }

    // ---- 3. through the letter
    if (f >= NEXT_AT) return next;

    // ---- 2. the light card, its type a window onto the next one
    let lineType: ReactNode;
    if (f < LINE_AT) {
      const size = fit(LEAD_SIZE, m.lead);
      lineType = (
        <Line
          x={cx - (m.lead * size) / 2 + LEAD_NUDGE - track(LEAD_DRIFT, f)}
          y={cy + LEAD_DROP}
          size={size}
          tracking={LEAD_TRACKING}
          px={px}
          fill="#fff"
        >
          {lead}
        </Line>
      );
    } else {
      const [tx, ty] = through ?? m.through;
      const reach = Math.max(tx, m.line - tx);
      const size = Math.min(LINE_SIZE, MAX_WIDTH / 2 / reach);
      const rest0 = cx - tx * size;
      const start = cx - (m.leadInLine * size) / 2;
      const x = rest0 + track(LINE_SLIDE, f) * LINE_START * (start - rest0);
      const y = cy + ty * size;
      const s = track(ZOOM, f);
      const n = typedAt(f, rest.length);
      lineType = (
        <Line
          x={cx + s * (x - cx) + track(ZOOM_X, f)}
          y={cy + s * (y - cy) + track(ZOOM_Y, f)}
          scale={s}
          size={size}
          tracking={LINE_TRACKING}
          px={px}
          fill="#fff"
        >
          {n > 0 ? `${lead} ${rest.slice(0, n)}` : lead}
        </Line>
      );
    }
    return (
      <>
        <mask
          id={id}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={W}
          height={H}
        >
          {lineType}
        </mask>
        <g mask={`url(#${id})`}>
          <rect width={W} height={H} fill={ink} />
          {next}
        </g>
      </>
    );
  };

  return (
    <AbsoluteFill
      style={{ background: f >= LEAD_AT && f < NEXT_AT ? paper : ink }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, ...type }}
      >
        {scene()}
      </svg>
    </AbsoluteFill>
  );
};

export default HelloZoom;
