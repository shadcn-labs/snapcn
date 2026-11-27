"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * A sentence with a picture in it, and the picture opening into the frame.
 *
 * The lead words fade up one at a time while the line drifts in from the left.
 * Then the line re-sets with a small rounded chip in the middle of it and the
 * rest of the sentence after, and the whole thing leans in — slowly at first,
 * then fast — until the chip takes the frame. The picture lands blurred and a
 * little small and settles sharp; a title types itself in over it, lifts away,
 * and the mark and the name arrive in its place.
 *
 * Every number below was measured off a screen recording, frame by frame, and
 * the scene is built on that recording's own clock: it was captured at 30fps,
 * so frame `n` here is frame `n - 1` of the recording and every table is keyed
 * in the recording's frames.
 *
 * ## Two lines, not one line that grows
 *
 * The first line is only the lead words, centred with a trailing space. The
 * second is lead + chip + trail, centred on its own. The recording cuts between
 * them on one frame — nothing slides from one layout to the other — so the
 * scene does too.
 *
 * ## The line scales about a fixed point, not its centre
 *
 * Both lines scale about (PIVOT_X, PIVOT_Y): the second line's measured centre
 * drifts right as it grows, by exactly what a pivot 15px left of it predicts
 * (to 0.4px over 24 frames). The pivot's height is the chip's centre line, and
 * the baseline stays a fixed 7.5px below it at every scale.
 *
 * ## The chip holds its own picture
 *
 * It is not a window onto the backdrop: the chip's picture eases out a touch
 * and then dives in 2.4x on its own while the line leans in, and the backdrop
 * replaces it on the frame the chip opens. Both default to one image.
 */

/** Variable Geist: the recording's weights (450, 500) are between Google's cuts. */
const FACE = "Portal Intro Geist";
const FACE_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@5.2.8/files/geist-latin-wght-normal.woff2";
let faceLoad: Promise<unknown> | null = null;
function loadFace(): Promise<unknown> {
  if (faceLoad) return faceLoad;
  if (typeof FontFace === "undefined") {
    faceLoad = Promise.resolve();
    return faceLoad;
  }
  const face = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, {
    weight: "100 900",
  });
  document.fonts.add(face);
  // A face that fails to load leaves the fallback stack to paint.
  faceLoad = face.load().catch(() => undefined);
  return faceLoad;
}
const SANS = `"${FACE}", Geist, ui-sans-serif, system-ui, sans-serif`;

/** Absolute, so a copy of this file in another project still finds it. */
const DEFAULT_IMAGE =
  "https://media.snapcn.dev/demos/showcase/portal-intro.jpg";

/* ─────────────────────────────────────────────────────────────────────────
   The frame, in the recording's own 714 × 402 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 714;
export const REF_H = 402;
/** Recording frame `r` is composition frame `r + LEAD`. */
export const LEAD = 1;
export const DURATION = 108;

/** The point both lines scale about. */
export const PIVOT_X = 345.17;
export const PIVOT_Y = 198.93;
/** Where each line is centred, at scale 1. */
export const CENTRE_A = 357;
export const CENTRE_B = 360.27;
/** The baseline at scale 1. */
export const BASELINE = 206.46;

/** The line's type: size at scale 1, weight, tracking in em. */
export const LINE_SIZE = 26.834;
export const LINE_WEIGHT = 450;
export const LINE_TRACKING = -0.01;
/** Frames between one lead word and the next. */
export const STAGGER = 6;
/** The chip's corner, in layout px — it scales with the line. */
export const CHIP_RADIUS = 4.4;

/** The recording frames each part of the scene owns. */
export const FIRST_LINE_TO = 22;
export const SECOND_LINE_TO = 46;
export const OPEN_AT = 49;
export const TITLE_FROM = 48;
export const TITLE_TO = 70;
export const MARK_FROM = 71;
export const BRAND_FROM = 73;
export const BRAND_STAGGER = 2;

/** The title's type and where it is centred. */
export const TITLE_SIZE = 30.29;
export const TITLE_WEIGHT = 500;
export const TITLE_TRACKING = -0.02;
export const TITLE_CENTRE = 357.415;
/** The mark and name: sizes, gap, centre, and the name's drop below the mark's centre. */
export const MARK_SIZE = 29.22;
export const BRAND_SIZE = 38.19;
export const BRAND_WEIGHT = 450;
export const BRAND_TRACKING = -0.03;
export const BRAND_GAP = 3.25;
export const BRAND_CENTRE = 356.86;
export const BRAND_DROP = 10.74;
/** Where the mark settles once the recording runs out, and how fast. */
export const MARK_REST = 199;
export const MARK_SETTLE = 0.88;

/**
 * The backdrop is drawn this much larger than the frame, so that at the 0.62
 * scale it opens at there is still picture under every edge of the opening.
 */
export const BLEED = 1.5;

/* ─────────────────────────────────────────────────────────────────────────
   The measured tables, keyed in recording frames
   ───────────────────────────────────────────────────────────────────────── */

export type Table = { from: number; v: readonly number[] };

/** Linear read of a table, clamped at both ends. */
export function at(t: Table, x: number): number {
  const n = t.v.length;
  const i = x - t.from;
  if (i <= 0) return t.v[0] ?? 0;
  if (i >= n - 1) return t.v[n - 1] ?? 0;
  const i0 = Math.floor(i);
  const a = t.v[i0] ?? 0;
  const b = t.v[i0 + 1] ?? a;
  return a + (b - a) * (i - i0);
}

/** The whole line's scale, against the size it is set at. */
export const SCALE: Table = {
  from: -1,
  v: [
    0.948789, 0.948789, 0.948789, 0.949727, 0.9491, 0.94994, 0.950745, 0.950887,
    0.95062, 0.951965, 0.952448, 0.953167, 0.95334, 0.954234, 0.955356,
    0.956136, 0.957932, 0.959057, 0.961321, 0.963993, 0.96696, 0.970379,
    0.97696, 0.985827, 1.00001, 1.01553, 1.02495, 1.03178, 1.0374, 1.04274,
    1.04826, 1.05222, 1.05734, 1.06323, 1.06908, 1.07466, 1.08109, 1.08821,
    1.09531, 1.10385, 1.1126, 1.12312, 1.13474, 1.14857, 1.16463, 1.18435,
    1.21107, 1.26697,
  ],
};
/** How far the first line still has to travel right, in layout px. */
export const PAN: Table = {
  from: -1,
  v: [
    -57, -44.2, -34.069, -25.946, -20.352, -15.946, -12.41, -9.611, -7.358,
    -5.421, -3.863, -2.598, -1.655, -0.897, -0.338, 0.013, 0.226, 0.236, 0.249,
    0.225, 0.19, 0.086, 0.055, -0.045,
  ],
};
/** A word's opacity, by frames since it began. */
export const WORD_OPACITY: Table = {
  from: -1,
  v: [
    0, 0.15, 0.317, 0.457, 0.563, 0.642, 0.706, 0.754, 0.804, 0.812, 0.871,
    0.888, 0.909, 0.933, 0.949, 0.964, 0.981, 0.996, 0.988, 0.993, 0.994, 0.999,
    1, 1,
  ],
};
/** How far below its baseline a word still is, by frames since it began. */
export const WORD_RISE: Table = {
  from: -1,
  v: [
    4.58, 3.907, 3.314, 2.797, 2.348, 1.962, 1.632, 1.354, 1.12, 0.926, 0.764,
    0.629, 0.516, 0.418, 0.333, 0.261, 0.2, 0.148, 0.104, 0.066, 0.034, 0.005,
    0, 0,
  ],
};
/** The room the line makes for the chip, in layout px. */
export const SLOT: Table = {
  from: 23,
  v: [
    60.732, 65.134, 67.143, 68.482, 69.546, 70.405, 71.05, 71.649, 72.167,
    72.54, 72.803, 73.062, 73.292, 73.382, 73.481, 73.663, 74.218, 75.148,
    76.582, 78.659, 81.609, 85.948, 92.559, 109.382,
  ],
};
/** The chip's drawn width, in layout px. */
export const CHIP_W: Table = {
  from: 23,
  v: [
    44.508, 45.945, 46.76, 47.144, 47.798, 47.894, 48.001, 48.454, 48.466,
    48.546, 48.653, 48.693, 48.885, 49.032, 49.904, 51.058, 52.22, 54.09,
    56.437, 59.433, 63.447, 69.108, 77.2, 96.579,
  ],
};
/** The chip's drawn height, in layout px. */
export const CHIP_H: Table = {
  from: 23,
  v: [
    25.253, 26.036, 26.521, 26.778, 26.907, 27.012, 27.039, 27.174, 27.431,
    27.515, 27.597, 27.85, 28.043, 28.097, 28.312, 28.967, 29.719, 30.467,
    31.741, 33.415, 35.677, 38.81, 43.202, 54.168,
  ],
};
/** Where the chip sits in its slot, off centre, in layout px. */
export const CHIP_DX: Table = {
  from: 23,
  v: [
    -0.662, -1.12, -1.266, -1.491, -1.497, -1.626, -1.705, -1.681, -1.744,
    -1.766, -1.773, -1.828, -1.882, -1.924, -1.888, -1.869, -1.95, -1.931,
    -2.032, -2.236, -2.339, -2.701, -3.151, -4.166,
  ],
};
/** And off the pivot line, in layout px. */
export const CHIP_DY: Table = {
  from: 23,
  v: [
    0.241, 0.197, 0.166, 0.154, 0.169, 0.179, 0.195, 0.171, 0.192, 0.177, 0.155,
    0.17, 0.16, 0.091, 0.078, 0.107, 0.088, 0.081, 0.074, 0.113, 0.045, 0.09,
    0.022, 0.055,
  ],
};
/** The picture inside the chip, as a zoom over `cover`. */
export const CHIP_ZOOM: Table = {
  from: 23,
  v: [
    1.3053, 1.2221, 1.1553, 1.1025, 1.062, 1.0324, 1.0126, 1.002, 1, 1.0065,
    1.0215, 1.045, 1.0777, 1.12, 1.1728, 1.2372, 1.3146, 1.4068, 1.5158, 1.6442,
    1.7952, 1.9726, 2.1809, 2.4258,
  ],
};
/** The backdrop's scale once the chip has opened. */
export const BG_SCALE: Table = {
  from: 47,
  v: [
    0.6285, 0.7741, 0.8335, 0.8644, 0.8844, 0.9068, 0.9271, 0.9434, 0.9558,
    0.9633, 0.9687, 0.9745, 0.9804, 0.9861, 0.993, 0.9972, 1.0004, 1.0028,
    1.0046, 1.0061, 1.0076, 1.0073, 1.0072, 1.0069, 1.0065, 1.0053, 1.0045,
    1.0037, 1.0023, 1.0019, 1.0018, 1.0016, 1.0011, 1.001, 1.0009, 1.0006,
    1.0004, 1.0001, 1, 1,
  ],
};
/** Its drift right, in reference px. */
export const BG_X: Table = {
  from: 47,
  v: [
    18, 13.45, 9.15, 7.91, 6.79, 4.8494, 3.6476, 3.2565, 1.8995, 1.3861, 0.971,
    1.751, 1.4813, 1.494, 0.9013, 0.7599, 0.5335, 0.4651, 0.3116, 0.215, 0.12,
    0.129, 0.134, 0.143, 0.143, 0.095, 0.092, 0.061, 0.03, 0.028, 0.033, 0.03,
    0.039, 0.038, 0.032, 0.024, 0.008, -0.001, -0.002, -0,
  ],
};
/** Its drift down, in reference px. */
export const BG_Y: Table = {
  from: 47,
  v: [
    -0.68, -0.7, -0.14, 0.34, 0.36, 0.4344, 0.4116, 0.3287, 0.1941, -0.0261,
    0.0106, -0.1763, -0.3804, -0.3697, -0.3417, -0.3645, -0.2931, -0.2826,
    -0.2109, -0.209, -0.211, -0.19, -0.181, -0.158, -0.115, -0.055, -0.031,
    0.01, 0.054, 0.071, 0.065, 0.069, 0.052, 0.044, 0.036, 0.024, 0.025, 0.015,
    0.005, -0,
  ],
};
/** Its blur, in the backdrop's own px. */
export const BG_BLUR: Table = {
  from: 47,
  v: [
    14.91, 15.45, 14.33, 10.26, 6.93, 11.7455, 9.8469, 7.6187, 4.426, 3.187,
    1.9011, 1.3233, 0.6, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
};
/** The title's baseline. */
export const TITLE_Y: Table = {
  from: 48,
  v: [
    212.158, 212.105, 212.085, 212.085, 212.085, 212.085, 212.085, 212.085,
    212.085, 212.085, 212.043, 211.919, 211.741, 211.499, 211.188, 210.801,
    210.33, 209.769, 209.094, 208.213, 207.02, 205.165, 201.343,
  ],
};
/** How far below the title's baseline a letter still is, by frames since it began. */
export const LETTER_RISE: Table = {
  from: 0,
  v: [
    2.104, 1.661, 1.283, 0.964, 0.7, 0.486, 0.317, 0.187, 0.091, 0.026, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
};
/** A letter's opacity, by frames since it began. */
export const LETTER_OPACITY: Table = {
  from: 0,
  v: [
    0.372, 0.53, 0.64, 0.722, 0.791, 0.851, 0.892, 0.927, 0.953, 0.97, 0.981,
    0.988, 0.995, 0.998, 0.998, 0.995, 0.997, 1, 1, 1, 1, 0.999, 0.995,
  ],
};
/** The mark's centre line. */
export const MARK_Y: Table = {
  from: 71,
  v: [
    204.337, 203.041, 202.271, 201.782, 201.431, 201.121, 200.837, 200.584,
    200.368, 200.191, 200.046, 199.925, 199.819, 199.717, 199.612, 199.494,
  ],
};
/** The mark's opacity. */
export const MARK_OPACITY: Table = {
  from: 71,
  v: [
    0.642, 0.845, 0.916, 0.949, 0.975, 0.987, 0.998, 0.998, 0.997, 0.997, 1, 1,
    1, 0.999, 1, 1,
  ],
};
/** How far below its baseline a brand letter still is, by frames since it landed. */
export const BRAND_RISE: Table = {
  from: 0,
  v: [
    3.059, 2.205, 1.602, 1.188, 0.904, 0.693, 0.528, 0.388, 0.255, 0.13, 0.02,
    0, 0, 0,
  ],
};
/** The two frames the chip spends opening: left, top, right, bottom, radius. */
export const OPENING: Record<
  number,
  readonly [number, number, number, number, number]
> = {
  47: [108.9, 50.8, 637.35, 347.11, 13.1],
  48: [38.69, 14.06, 698.6, 383.87, 15.9],
};

/* ─────────────────────────────────────────────────────────────────────────
   Measuring type
   ───────────────────────────────────────────────────────────────────────── */

type Metrics = {
  /** Advance of each prefix of the string, so `pre[i]` is where letter i starts. */
  pre: number[];
  /** Ascent and descent, as fractions of the size. */
  asc: number;
  desc: number;
};

const FALLBACK = { asc: 0.9, desc: 0.22, char: 0.52 };

/** Prefix advances with the tracking applied, at `size` px. */
export function measure(
  text: string,
  size: number,
  weight: number,
  tracking: number,
  face: string,
): Metrics {
  const ctx =
    typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");
  if (!ctx) {
    return {
      pre: [...Array(text.length + 1).keys()].map(
        (i) => i * size * (FALLBACK.char + tracking),
      ),
      asc: FALLBACK.asc,
      desc: FALLBACK.desc,
    };
  }
  ctx.font = `${weight} ${size}px ${face}`;
  ctx.letterSpacing = `${tracking * size}px`;
  const pre = [...Array(text.length + 1).keys()].map(
    (i) => ctx.measureText(text.slice(0, i)).width,
  );
  const m = ctx.measureText("Hg");
  return {
    pre,
    asc: m.fontBoundingBoxAscent / size,
    desc: m.fontBoundingBoxDescent / size,
  };
}

/** Rewrite root-relative assets through staticFile everywhere but the Player. */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (!isLocal || getRemotionEnvironment().isPlayer) return src;
  const base = staticFile("_").slice(0, -2);
  if (base && src.startsWith(`${base}/`)) return src;
  try {
    return staticFile(src.replace(/^\/+/, ""));
  } catch {
    return src;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   The scene
   ───────────────────────────────────────────────────────────────────────── */

export interface PortalIntroProps {
  /** The words before the chip. They arrive one at a time. */
  lead?: string;
  /** The words after it, which arrive with the chip. */
  trail?: string;
  /** The picture the chip opens into. */
  image?: string;
  /** The chip's own picture, if it should differ from the backdrop. */
  chipImage?: string;
  /** The title typed over the picture. */
  title?: string;
  /** The name beside the mark. */
  brand?: string;
  /** The mark, drawn in `currentColor` in a MARK_SIZE box. Defaults to snapcn's. */
  logo?: React.ReactNode;
  /**
   * Or the mark as an image URL, when it cannot be passed as an element.
   * Left out, the snapcn mark. `""` means "no logo": the snapcn mark only
   * beside the name snapcn, and the name alone, centred, beside any other.
   */
  logoSrc?: string;
  /** The ink of the title, the mark and the name over the picture. */
  overlay?: string;
  fontFamily?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  speed?: number;
  className?: string;
}

export function PortalIntro({
  lead = "your launch video",
  trail = "in code",
  image = DEFAULT_IMAGE,
  chipImage,
  title = "Introducing",
  brand = "snapcn",
  logo,
  logoSrc,
  overlay = "#ffffff",
  fontFamily,
  theme,
  mode = "light",
  speed = 1,
  className,
}: PortalIntroProps) {
  const frame = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily) ?? SANS;
  const r = frame - LEAD;

  const [handle] = useState(() => delayRender("portal-intro: font"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFace()
      .then(() => document.fonts.ready)
      .finally(() => {
        setReady(true);
        continueRender(handle);
      });
  }, [handle]);

  const leadWords = useMemo(() => lead.split(/\s+/).filter(Boolean), [lead]);
  const trailWords = useMemo(() => trail.split(/\s+/).filter(Boolean), [trail]);

  const type = useMemo(() => {
    void ready;
    const line = (words: string[]) => {
      const text = words.join(" ");
      const m = measure(
        `${text} `,
        LINE_SIZE,
        LINE_WEIGHT,
        LINE_TRACKING,
        face,
      );
      // Where each word starts: the prefix up to it, spaces included.
      const starts: number[] = [];
      let i = 0;
      for (const w of words) {
        starts.push(m.pre[i] ?? 0);
        i += w.length + 1;
      }
      return {
        starts,
        width: m.pre[text.length] ?? 0,
        withSpace: m.pre[text.length + 1] ?? 0,
        asc: m.asc,
        desc: m.desc,
      };
    };
    return {
      lead: line(leadWords),
      trail: line(trailWords),
      title: measure(title, TITLE_SIZE, TITLE_WEIGHT, TITLE_TRACKING, face),
      brand: measure(brand, BRAND_SIZE, BRAND_WEIGHT, BRAND_TRACKING, face),
    };
  }, [ready, leadWords, trailWords, title, brand, face]);

  // `cover`, so a 16:9 composition crops the frame rather than letterboxing it.
  const k = Math.max(width / REF_W, height / REF_H);
  const ink = t.foreground;
  // The stage is one scaled layer, and Chrome snaps glyph baselines inside it —
  // so the grid the type steps on is the stage's own pixel, not the device's.
  const grid = [1, 0] as const;
  const backdrop = resolveSrc(image);
  const chipSrc = resolveSrc(chipImage ?? image);

  const s = at(SCALE, Math.min(r, SECOND_LINE_TO));
  const toX = (x: number) => PIVOT_X + s * (x - PIVOT_X);
  const toY = (y: number) => PIVOT_Y + s * (y - PIVOT_Y);

  const nodes: React.ReactNode[] = [];

  if (r < FIRST_LINE_TO + 0.5) {
    // The lead words alone, centred with their trailing space, drifting in.
    const l = type.lead;
    const x0 = CENTRE_A - l.withSpace / 2 + at(PAN, r);
    leadWords.forEach((w, i) => {
      const kk = r - STAGGER * i;
      if (kk < WORD_OPACITY.from) return;
      nodes.push(
        <Glyphs
          // biome-ignore lint/suspicious/noArrayIndexKey: a word's place in the line is its identity
          key={`a${i}`}
          text={w}
          x={toX(x0 + (l.starts[i] ?? 0))}
          baseline={toY(BASELINE + at(WORD_RISE, kk))}
          size={LINE_SIZE}
          scale={s}
          weight={LINE_WEIGHT}
          tracking={LINE_TRACKING}
          asc={l.asc}
          desc={l.desc}
          color={ink}
          opacity={at(WORD_OPACITY, kk)}
        />,
      );
    });
  }

  // Where the chip is drawn, in reference px, while it sits in the line.
  let chip: { l: number; t: number; w: number; h: number; r: number } | null =
    null;
  if (r >= FIRST_LINE_TO + 0.5 && r < SECOND_LINE_TO + 0.5) {
    const l = type.lead;
    const tr = type.trail;
    const slot = at(SLOT, r);
    const total = l.withSpace + slot + tr.width;
    const x0 = CENTRE_B - total / 2;
    const slotAt = x0 + l.withSpace;
    const trailAt = slotAt + slot;
    leadWords.forEach((w, i) => {
      nodes.push(
        <Glyphs
          // biome-ignore lint/suspicious/noArrayIndexKey: a word's place in the line is its identity
          key={`b${i}`}
          text={w}
          x={toX(x0 + (l.starts[i] ?? 0))}
          baseline={toY(BASELINE)}
          size={LINE_SIZE}
          scale={s}
          weight={LINE_WEIGHT}
          tracking={LINE_TRACKING}
          asc={l.asc}
          desc={l.desc}
          color={ink}
        />,
      );
    });
    trailWords.forEach((w, i) => {
      nodes.push(
        <Glyphs
          // biome-ignore lint/suspicious/noArrayIndexKey: a word's place in the line is its identity
          key={`c${i}`}
          text={w}
          x={toX(trailAt + (tr.starts[i] ?? 0))}
          baseline={toY(BASELINE)}
          size={LINE_SIZE}
          scale={s}
          weight={LINE_WEIGHT}
          tracking={LINE_TRACKING}
          asc={tr.asc}
          desc={tr.desc}
          color={ink}
        />,
      );
    });
    const cw = at(CHIP_W, r) * s;
    const ch = at(CHIP_H, r) * s;
    const cx = toX(slotAt + slot / 2 + at(CHIP_DX, r));
    const cy = toY(PIVOT_Y + at(CHIP_DY, r));
    chip = { l: cx - cw / 2, t: cy - ch / 2, w: cw, h: ch, r: CHIP_RADIUS * s };
  }

  // The opening: the two measured frames, then the whole frame.
  let opening: {
    l: number;
    t: number;
    w: number;
    h: number;
    r: number;
  } | null = null;
  if (r >= SECOND_LINE_TO + 0.5) {
    const o = OPENING[Math.round(r)];
    opening =
      o && r < OPEN_AT - 0.5
        ? { l: o[0], t: o[1], w: o[2] - o[0], h: o[3] - o[1], r: o[4] }
        : { l: 0, t: 0, w: REF_W, h: REF_H, r: 0 };
  }

  const iconFit = useIconFit(
    logoSrc ? resolveSrc(logoSrc) : undefined,
    MARK_SIZE * k,
  );

  const bgScale = at(BG_SCALE, r);
  const bgBlur = at(BG_BLUR, r);

  return (
    <AbsoluteFill
      className={className}
      style={{ background: t.background, overflow: "hidden" }}
    >
      <AbsoluteFill
        style={{
          width: REF_W,
          height: REF_H,
          left: (width - REF_W * k) / 2,
          top: (height - REF_H * k) / 2,
          transform: `scale(${k})`,
          transformOrigin: "top left",
          background: t.background,
          overflow: "hidden",
          fontFamily: face,
          textRendering: "geometricPrecision",
        }}
      >
        {chip ? (
          <div
            style={{
              position: "absolute",
              left: chip.l,
              top: chip.t,
              width: chip.w,
              height: chip.h,
              borderRadius: chip.r,
              overflow: "hidden",
            }}
          >
            <Img
              src={chipSrc}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${at(CHIP_ZOOM, r)})`,
              }}
            />
          </div>
        ) : null}
        {opening ? (
          <div
            style={{
              position: "absolute",
              left: opening.l,
              top: opening.t,
              width: opening.w,
              height: opening.h,
              borderRadius: opening.r,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -opening.l - (REF_W * (BLEED - 1)) / 2,
                top: -opening.t - (REF_H * (BLEED - 1)) / 2,
                width: REF_W * BLEED,
                height: REF_H * BLEED,
                transform: `translate(${at(BG_X, r)}px, ${at(BG_Y, r)}px) scale(${bgScale})`,
                filter: bgBlur > 0.05 ? `blur(${bgBlur}px)` : undefined,
              }}
            >
              <Img
                src={backdrop}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          </div>
        ) : null}
        {nodes}
        {r >= TITLE_FROM && r < TITLE_TO + 0.5 ? (
          <Title
            text={title}
            m={type.title}
            r={r}
            color={overlay}
            grid={grid}
          />
        ) : null}
        {r >= MARK_FROM ? (
          <Brand
            grid={grid}
            text={brand}
            m={type.brand}
            r={r}
            logo={
              logo ??
              (logoSrc ? (
                <Img
                  src={resolveSrc(logoSrc)}
                  style={{
                    width: `${iconFit * 100}%`,
                    height: `${iconFit * 100}%`,
                    objectFit: "contain",
                  }}
                />
              ) : logoSrc === "" && !isSnapcn(brand) ? null : (
                <SnapCnMark />
              ))
            }
            color={overlay}
          />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Pieces
   ───────────────────────────────────────────────────────────────────────── */

/** One run of text, its origin on (x, baseline), scaled about that point. */
function Glyphs({
  text,
  x,
  baseline,
  size,
  scale = 1,
  weight,
  tracking,
  asc,
  desc,
  color,
  opacity = 1,
  grid,
}: {
  text: string;
  x: number;
  baseline: number;
  size: number;
  scale?: number;
  weight: number;
  tracking: number;
  asc: number;
  desc: number;
  color: string;
  opacity?: number;
  /**
   * The pixel grid baselines snap to, as `[px per reference px, offset]`.
   * Given, the run is drawn as two copies a grid pixel apart and blended —
   * Chrome snaps a text baseline to a whole pixel, so a letter easing
   * up by fractions of one would otherwise climb in visible one-pixel steps,
   * each letter on its own frame: a tremble, not a rise.
   */
  grid?: readonly [number, number];
}) {
  // At `lineHeight: 1` the line box splits the leftover leading evenly, so the
  // baseline sits this far below the box's top.
  const rise = size * (asc + (1 - asc - desc) / 2);
  if (opacity <= 0) return null;
  if (grid && scale === 1) {
    const [k, off] = grid;
    const yd = off + (baseline - rise) * k;
    const lo = Math.floor(yd);
    const f = yd - lo;
    const copy = (top: number, o: number) => (
      <div
        style={{
          position: "absolute",
          left: x,
          top: (top - off) / k,
          width: "max-content",
          fontSize: size,
          lineHeight: 1,
          fontWeight: weight,
          letterSpacing: `${tracking}em`,
          whiteSpace: "pre",
          color,
          opacity: o,
          mixBlendMode: "plus-lighter",
        }}
      >
        {text}
      </div>
    );
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          isolation: "isolate",
          opacity,
        }}
      >
        {copy(lo, 1 - f)}
        {f > 0.001 ? copy(lo + 1, f) : null}
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: baseline - rise,
        width: "max-content",
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: `0 ${rise}px`,
        fontSize: size,
        lineHeight: 1,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        whiteSpace: "pre",
        color,
        opacity,
      }}
    >
      {text}
    </div>
  );
}

/** The title: one letter a frame, each fading up and settling as the word lifts. */
function Title({
  grid,
  text,
  m,
  r,
  color,
}: {
  grid: readonly [number, number];
  text: string;
  m: Metrics;
  r: number;
  color: string;
}) {
  const x0 = TITLE_CENTRE - (m.pre[text.length] ?? 0) / 2;
  const base = at(TITLE_Y, r);
  return (
    <>
      {[...text].map((c, i) => {
        const kk = r - TITLE_FROM - i;
        if (kk < 0 || c === " ") return null;
        return (
          <Glyphs
            // biome-ignore lint/suspicious/noArrayIndexKey: a letter's place is its identity
            key={i}
            text={c}
            x={x0 + (m.pre[i] ?? 0)}
            baseline={base + at(LETTER_RISE, kk)}
            size={TITLE_SIZE}
            weight={TITLE_WEIGHT}
            tracking={TITLE_TRACKING}
            asc={m.asc}
            desc={m.desc}
            color={color}
            opacity={at(LETTER_OPACITY, kk)}
            grid={grid}
          />
        );
      })}
    </>
  );
}

/** The mark fades up rising; the name lands a letter every other frame beside it. */
function Brand({
  grid,
  text,
  m,
  r,
  logo,
  color,
}: {
  grid: readonly [number, number];
  text: string;
  m: Metrics;
  r: number;
  logo: React.ReactNode;
  color: string;
}) {
  const last = MARK_Y.from + MARK_Y.v.length - 1;
  const y =
    r <= last
      ? at(MARK_Y, r)
      : MARK_REST + (at(MARK_Y, last) - MARK_REST) * MARK_SETTLE ** (r - last);
  const adv = m.pre[text.length] ?? 0;
  const markW = logo ? MARK_SIZE + BRAND_GAP : 0;
  const left = BRAND_CENTRE - (markW + adv) / 2;
  const textAt = left + markW;
  return (
    <>
      {logo ? (
        <div
          style={{
            position: "absolute",
            left,
            top: 0,
            // A transform, not `top`: Chrome rounds a box's top edge to the device
            // pixel, which would step the mark up a whole pixel at a time.
            transform: `translateY(${y - MARK_SIZE / 2}px)`,
            width: MARK_SIZE,
            height: MARK_SIZE,
            color,
            opacity: at(MARK_OPACITY, r),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {logo}
        </div>
      ) : null}
      {[...text].map((c, i) => {
        const kk = r - BRAND_FROM - BRAND_STAGGER * i;
        if (kk < 0 || c === " ") return null;
        return (
          <Glyphs
            // biome-ignore lint/suspicious/noArrayIndexKey: a letter's place is its identity
            key={i}
            text={c}
            x={textAt + (m.pre[i] ?? 0)}
            baseline={y + BRAND_DROP + at(BRAND_RISE, kk)}
            size={BRAND_SIZE}
            weight={BRAND_WEIGHT}
            tracking={BRAND_TRACKING}
            asc={m.asc}
            desc={m.desc}
            color={color}
            grid={grid}
          />
        );
      })}
    </>
  );
}

/** The snapcn mark belongs beside the snapcn name and nowhere else. */
const isSnapcn = (name: string) => name.trim().toLowerCase() === "snapcn";

/** Past this much upscaling a raster icon's edges go visibly soft. */
const MAX_UPSCALE = 1.5;

/**
 * How much of its box an image mark may fill. A site icon is often 64px and
 * the box is ~80 device px at 1080p (and twice that at 4K), so a raster mark
 * is capped at MAX_UPSCALE x its natural size and sits smaller, centred,
 * rather than blown up to a blur. SVGs scale freely.
 */
function useIconFit(src: string | undefined, boxPx: number): number {
  const [natural, setNatural] = useState(0);
  useEffect(() => {
    setNatural(0);
    if (!src || /\.svg(\?|#|$)|^data:image\/svg/i.test(src)) return;
    const handle = delayRender(`portal-intro: measuring ${src}`);
    const img = new Image();
    img.onload = img.onerror = () => {
      setNatural(Math.max(img.naturalWidth, img.naturalHeight));
      continueRender(handle);
    };
    img.src = src;
    return () => continueRender(handle);
  }, [src]);
  return natural > 0 ? Math.min(1, (natural * MAX_UPSCALE) / boxPx) : 1;
}

/** snapcn's mark, on `currentColor`. */
function SnapCnMark() {
  return (
    <svg
      viewBox="0 0 464 409"
      width="100%"
      height="100%"
      fill="currentColor"
      aria-hidden
    >
      <g transform="translate(0,409) scale(0.1,-0.1)">
        <path d="M589 3805 c-167 -41 -305 -149 -380 -297 -60 -120 -59 -84 -59 -1239 0 -1004 1 -1059 19 -1112 48 -147 148 -226 331 -262 100 -20 127 -33 186 -87 53 -49 74 -109 74 -212 1 -121 42 -196 133 -244 l52 -27 980 -3 c883 -3 986 -1 1042 13 75 21 133 67 171 139 l27 51 3 315 c2 173 2 342 0 374 l-3 60 -31 -50 c-36 -59 -101 -115 -170 -146 l-49 -23 -810 -3 c-591 -2 -825 0 -865 8 -128 28 -258 121 -325 234 -65 110 -66 128 -63 826 l3 625 24 58 c44 111 147 210 270 259 l56 23 830 3 c809 2 831 2 895 -18 80 -25 149 -74 198 -142 l37 -52 3 334 c3 367 -3 418 -56 494 -30 44 -98 91 -152 106 -22 6 -457 10 -1175 9 -923 -1 -1151 -3 -1196 -14z M3800 2983 c-327 -196 -598 -361 -602 -367 -4 -6 -7 -254 -5 -550 l2 -540 145 -91 c80 -50 208 -130 285 -177 77 -47 283 -174 457 -282 174 -108 326 -196 337 -196 11 0 27 7 35 16 14 14 16 141 16 1254 0 781 -4 1248 -10 1264 -7 20 -16 26 -37 26 -18 -1 -232 -123 -623 -357z" />
      </g>
    </svg>
  );
}
