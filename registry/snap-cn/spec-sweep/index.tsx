"use client";

import { loadFont } from "@remotion/google-fonts/Inter";
import { useEffect, useId, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";
import { BOLT, ENTRY, ICON_BOX, SWEEP } from "./data";

/**
 * Spec Sweep — one centred line that arrives word by word and then gets read
 * out by a highlight. Every word slides in on its own clock, a soft band of
 * brightness travels along the line, and an icon charges up from the bottom.
 *
 * The defaults are measured off a 1920x1080 reference: it is a single curve
 * through time (`SWEEP`), reached at each point of the line by its distance from
 * the start plus that word's entry delay, so copy of any length rides the same
 * band.
 */

const { fontFamily: INTER } = loadFont("normal", {
  weights: ["500"],
  subsets: ["latin"],
});

export type SpecSegmentRole = "lead" | "icon" | "accent" | "muted";

export interface SpecSegment {
  /** The words. Split on spaces; each word enters on its own. Unused by `icon`. */
  text?: string;
  /**
   * `lead` rides the highlight and falls back to grey behind it. `accent` stays
   * lit once the highlight has reached it. `muted` never rises past `mutedLevel`.
   * `icon` draws the `icon` path, charged with `accentColor`.
   */
  role?: SpecSegmentRole;
}

export interface SpecSweepProps {
  segments?: SpecSegment[];
  /** SVG path data of the icon, drawn in an `iconBox` viewBox. */
  icon?: string;
  /** viewBox width and height of `icon`. */
  iconBox?: [number, number];
  /** Icon height, in em. */
  iconSize?: number;
  /** Icon colour once charged. Defaults to `theme.primary`. */
  accentColor?: string;
  /** Opacity of the icon before the charge reaches it. */
  iconDim?: number;
  /** Lighter inner edge of the icon, px on a 1920 stage. 0 turns it off. */
  iconRim?: number;
  /** Colour of that edge. Defaults to `accentColor` towards white. */
  iconRimColor?: string;
  /** Frames from the icon's entry to the start of its charge, and the charge's length. */
  chargeDelay?: number;
  chargeFrames?: number;
  /** A family from `fonts.ts`, or a CSS family you have loaded yourself. */
  fontFamily?: string;
  /** Type size, px on a 1920 stage. Long copy shrinks from here to fit. */
  fontSize?: number;
  fontWeight?: number;
  /** How far a word slides in, em. */
  travel?: number;
  /** Frames between one word's entry and the next. Compressed on long copy. */
  stagger?: number;
  /** Frames the highlight takes to cross the line. */
  sweepFrames?: number;
  /** Level `muted` words are capped at. */
  mutedLevel?: number;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  speed?: number;
}

/** Widest the line may get, as a fraction of the stage: a word still sliding in stays on it. */
const MAX_LINE = 0.85;
/** The last word has landed by this frame, however long the copy. */
const LAST_ENTRY = 14;
/** Frame the highlight's centre leaves the start of the line. */
const SWEEP_START = 1.476;
/** Frames a word is ahead of the highlight at the very start of its slide. */
const SWEEP_LEAD = 6.093;
/** The text baseline sits this far below the stage centre, em. */
const BASELINE = 0.258;
/** Spacing of the sampled gradient stops, px on a 1920 stage. */
const STOP_EVERY = 8;

const chargeEase = Easing.bezier(0.166, 0.092, 0.279, 1);

const held = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ENTRY_AT = ENTRY.map((_, i) => i);
const SWEEP_AT = SWEEP.map(([at]) => at);
const SWEEP_LEVEL = SWEEP.map(([, level]) => level);

/** The fraction of `travel` a word has left, `age` frames after it entered. */
export const entryOffset = (age: number) =>
  interpolate(age, ENTRY_AT, [...ENTRY], held);

/** Level of a word at `t` frames past the highlight's centre. */
export const sweepLevel = (
  role: SpecSegmentRole,
  t: number,
  mutedLevel = 0.6,
) => {
  if (role === "accent" && t > 0) return 1;
  const level = interpolate(t, SWEEP_AT, SWEEP_LEVEL, held);
  return role === "muted" ? Math.min(level, mutedLevel) : level;
};

export interface LineItem {
  role: SpecSegmentRole;
  text: string;
  /** Left edge from the start of the line, and advance. px. */
  x: number;
  w: number;
}

/** Splits segments into words and lays them on one line. */
export const layoutLine = (
  segments: SpecSegment[],
  measure: (text: string) => number,
  iconWidth: number,
) => {
  const space = measure(" ");
  const items: LineItem[] = [];
  let x = 0;
  const push = (role: SpecSegmentRole, text: string, w: number) => {
    items.push({ role, text, x, w });
    x += w + space;
  };
  for (const s of segments) {
    if (s.role === "icon") push("icon", "", iconWidth);
    else
      for (const word of (s.text ?? "").split(/\s+/).filter(Boolean))
        push(s.role ?? "lead", word, measure(word));
  }
  return { items, width: Math.max(0, x - space) };
};

const makeMeasure = (font: string, size: number) => {
  const ctx =
    typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");
  if (!ctx) return (text: string) => text.length * 0.55 * size;
  ctx.font = font;
  return (text: string) => ctx.measureText(text).width;
};

const DEFAULT_SEGMENTS: SpecSegment[] = [
  { text: "Ship", role: "lead" },
  { role: "icon" },
  { text: "a launch film", role: "accent" },
  { text: "in", role: "muted" },
  { text: "20 minutes", role: "accent" },
];

export const SpecSweep = ({
  segments = DEFAULT_SEGMENTS,
  icon = BOLT,
  iconBox = ICON_BOX,
  iconSize = 1.452,
  accentColor,
  iconDim = 0.39,
  iconRim = 1.47,
  iconRimColor,
  chargeDelay = 11.47,
  chargeFrames = 30,
  fontFamily,
  fontSize = 85.15,
  fontWeight = 500,
  travel = 1.466,
  stagger = 2,
  sweepFrames = 54,
  mutedLevel = 0.6,
  theme,
  mode = "dark",
  speed = 1,
}: SpecSweepProps) => {
  const f = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const id = useId().replace(/:/g, "");
  const family = resolveFont(fontFamily ?? t.fontFamily) ?? INTER;
  const stage = Math.min(width / 1920, height / 1080);

  // A width measured before the face lands is a width for the fallback, so the
  // layout waits on it; a render holds its first frame until that has re-rendered.
  const [fontTick, setFontTick] = useState(0);
  const [handle] = useState(() =>
    getRemotionEnvironment().isRendering
      ? delayRender("spec-sweep: loading the face")
      : null,
  );
  const fontSpec = `${fontWeight} 100px ${family}`;
  useEffect(() => {
    let alive = true;
    document.fonts
      .load(fontSpec)
      .catch(() => [])
      .then(() => {
        if (alive) setFontTick((n) => n + 1);
      });
    return () => {
      alive = false;
    };
  }, [fontSpec]);
  useEffect(() => {
    if (fontTick > 0 && handle != null) continueRender(handle);
  }, [fontTick, handle]);

  const line = useMemo(() => {
    void fontTick;
    const place = (size: number) =>
      layoutLine(
        segments,
        makeMeasure(`${fontWeight} ${size}px ${family}`, size),
        (size * iconSize * iconBox[0]) / iconBox[1],
      );
    const size = fontSize * stage;
    const first = place(size);
    const fit = Math.min(1, (MAX_LINE * width) / Math.max(1, first.width));
    const fitted = fit < 1 ? place(size * fit) : first;
    return { ...fitted, size: size * fit, left: (width - fitted.width) / 2 };
  }, [
    fontTick,
    segments,
    fontWeight,
    family,
    iconSize,
    iconBox,
    fontSize,
    stage,
    width,
  ]);

  const { items, size, left } = line;
  const step = Math.min(stagger, LAST_ENTRY / Math.max(1, items.length - 1));
  const rate = line.width / sweepFrames; // px per frame
  const baseline = height / 2 + BASELINE * size;
  const accent = accentColor ?? t.primary;
  const rimColor = iconRimColor ?? mixOklch(accent, "#ffffff", 0.3);
  const ink = t.foreground;

  const iconH = size * iconSize;
  const iconScale = iconH / iconBox[1];

  return (
    <AbsoluteFill style={{ background: t.background }}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      >
        {items.map((item, i) => {
          const age = f - step * i;
          if (age < 0) return null;
          const off = entryOffset(age);
          const x = left + item.x + off * travel * size;

          if (item.role === "icon") {
            const charge = chargeEase(
              Math.min(1, Math.max(0, (age - chargeDelay) / chargeFrames)),
            );
            const level = iconBox[1] * (1.006 - 1.018 * charge);
            const clip = `${id}c${i}`;
            const shape = (fill: string, rim: string) => (
              <>
                <path d={icon} fill={fill} />
                {iconRim > 0 && (
                  <path
                    d={icon}
                    fill="none"
                    stroke={rim}
                    strokeWidth={(2 * iconRim * stage) / iconScale}
                    clipPath={`url(#${clip})`}
                  />
                )}
              </>
            );
            return (
              <g
                key={`${item.x}`}
                transform={`translate(${x} ${height / 2 - iconH / 2}) scale(${iconScale})`}
              >
                <clipPath id={clip}>
                  <path d={icon} />
                </clipPath>
                <clipPath id={`${clip}a`}>
                  <rect x={-9e3} y={-9e3} width={18e3} height={9e3 + level} />
                </clipPath>
                <clipPath id={`${clip}b`}>
                  <rect x={-9e3} y={level} width={18e3} height={9e3} />
                </clipPath>
                <g clipPath={`url(#${clip}a)`} opacity={iconDim}>
                  {shape(accent, rimColor)}
                </g>
                <g clipPath={`url(#${clip}b)`}>{shape(accent, rimColor)}</g>
              </g>
            );
          }

          // The highlight reaches each point of the word at its own moment, so the
          // word is painted with a gradient sampled from that one curve.
          const grad = `${id}g${i}`;
          const from = age + SWEEP_LEAD * off - SWEEP_START - item.x / rate;
          const n = Math.max(2, Math.ceil(item.w / (STOP_EVERY * stage)));
          const stops = Array.from({ length: n + 1 }, (_, k) => {
            const u = k / n;
            return (
              <stop
                key={u}
                offset={u}
                stopColor={ink}
                stopOpacity={sweepLevel(
                  item.role,
                  from - (u * item.w) / rate,
                  mutedLevel,
                )}
              />
            );
          });
          return (
            <g key={`${item.x}`}>
              <linearGradient
                id={grad}
                gradientUnits="userSpaceOnUse"
                x1={x}
                x2={x + item.w}
                y1={0}
                y2={0}
              >
                {stops}
              </linearGradient>
              <text
                x={x}
                y={baseline}
                fill={`url(#${grad})`}
                style={{
                  fontFamily: family,
                  fontWeight,
                  fontSize: size,
                  textRendering: "geometricPrecision",
                }}
              >
                {item.text}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export default SpecSweep;
