"use client";

import { loadFont } from "@remotion/google-fonts/Inter";
import { useEffect, useId, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveFont } from "@/lib/snap-cn-ui";
import { DEFAULT_STOPS, SWEEP_FIRST, SWEEP_LAST, type SweepStop } from "./data";

/**
 * Title Sweep: a centred title lit by a warm gradient that travels across it.
 * The type never fades. It arrives and leaves because the gradient's dark ends
 * pass over it, so a title goes dark from one side and the next one is cut in
 * while the frame is black. The whole shot pulls back on one slow clock.
 *
 * The defaults are measured off a 1920x1080 reference at 30fps. The sweep is one
 * rigid gradient moved by a measured table: fast at both ends, slow through the
 * pale band.
 */

const { fontFamily: INTER } = loadFont("normal", {
  weights: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const STAGE_W = 1920;
const STAGE_H = 1080;
/** Widest a title may get, as a fraction of the stage. */
const MAX_LINE = 0.9;
/** A title longer than this many em stretches the sweep so it still crosses it. */
const REF_LINE = 7.6;
/** Frames between one title's cut and the next. */
export const TITLE_FRAMES = 36;
/** Scale lost per frame by the pull-back. */
const PULL_BACK = 0.00119;
/** The text baseline sits this far below the stage centre, em. */
const BASELINE = 0.267;

export interface TitleSweepProps {
  /** Shown in order, each cut in on black. One title is fine. */
  titles?: string[];
  /** A family from `fonts.ts`, or a CSS family you have loaded yourself. */
  fontFamily?: string;
  /** Type size, px on a 1920 stage. Long copy shrinks from here to fit. */
  fontSize?: number;
  fontWeight?: number;
  /** Letter spacing, em. */
  tracking?: number;
  /** Extra space between words, em. */
  wordSpacing?: number;
  /** Horizontal offset per title, px on a 1920 stage. */
  nudge?: number[];
  /** Size multiplier per title, for a line set a touch larger than the last. */
  titleScale?: number[];
  /** The gradient, in em from its centre. Start and end it on `background`. */
  stops?: SweepStop[];
  background?: string;
  speed?: number;
}

/** Piecewise-linear lookup in a per-frame table, held at the ends. */
export const sample = (table: readonly number[], at: number) => {
  const i = Math.min(Math.max(Math.floor(at), 0), table.length - 1);
  const from = table[i] ?? 0;
  const to = table[i + 1] ?? from;
  return from + (to - from) * Math.min(1, Math.max(0, at - i));
};

/** Which title is on screen at `f`, and how long it has been up. */
export const titleAt = (f: number, count: number) => {
  const index = Math.min(
    Math.floor(Math.max(0, f) / TITLE_FRAMES),
    Math.max(0, count - 1),
  );
  return { index, age: Math.max(0, f) - index * TITLE_FRAMES };
};

/** The last of several titles holds warm; any other title is swept off. */
export const sweepFor = (index: number, count: number) =>
  count > 1 && index === count - 1 ? SWEEP_LAST : SWEEP_FIRST;

/** Scale of the slow pull-back at `f`. */
export const pullBack = (f: number) => Math.max(0.5, 1 - PULL_BACK * f);

/** Scale that keeps a line of `lineWidth` on a stage of `stageWidth`. */
export const fitLine = (lineWidth: number, stageWidth: number) =>
  Math.min(1, (MAX_LINE * stageWidth) / Math.max(1, lineWidth));

export const TitleSweep = ({
  titles = ["snapcn Pro", "snapcn.dev"],
  fontFamily = "Inter",
  fontSize = 110.96,
  fontWeight = 500,
  tracking = -0.0165,
  wordSpacing = -0.0769,
  nudge,
  titleScale,
  stops = DEFAULT_STOPS,
  background = "#000000",
  speed = 1,
}: TitleSweepProps) => {
  const f = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const id = useId().replace(/:/g, "");
  const family = resolveFont(fontFamily) ?? INTER;

  // A width measured before the face lands is a width for the fallback, so the
  // fit waits on it; a render holds its first frame until that has re-rendered.
  const [fontTick, setFontTick] = useState(0);
  const [handle] = useState(() =>
    getRemotionEnvironment().isRendering
      ? delayRender("title-sweep: loading the face")
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

  const { index, age } = titleAt(f, titles.length);
  const text = titles[index] ?? "";

  // Advance width in em, tracking and word spacing included.
  const lineEm = useMemo(() => {
    void fontTick;
    const ctx =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
    if (!ctx) return text.length * 0.55;
    ctx.font = fontSpec;
    const spaces = text.split(" ").length - 1;
    return (
      ctx.measureText(text).width / 100 +
      text.length * tracking +
      spaces * wordSpacing
    );
  }, [fontTick, fontSpec, text, tracking, wordSpacing]);

  const fit = fitLine(lineEm * fontSize, STAGE_W);
  const size = fontSize * fit * (titleScale?.[index] ?? 1);
  const reach = Math.max(1, lineEm / REF_LINE) * size;
  const cx = STAGE_W / 2 + (nudge?.[index] ?? 0);
  const centre =
    STAGE_W / 2 + sample(sweepFor(index, titles.length), age) * reach;
  const first = stops[0]?.at ?? 0;
  const span = (stops[stops.length - 1]?.at ?? 1) - first || 1;
  const zoom = pullBack(f);
  const paint = `${id}sweep`;

  return (
    <AbsoluteFill style={{ background }}>
      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      >
        <defs>
          <linearGradient
            id={paint}
            gradientUnits="userSpaceOnUse"
            x1={centre + first * reach}
            x2={centre + (first + span) * reach}
            y1={0}
            y2={0}
          >
            {stops.map((s) => (
              <stop
                key={s.at}
                offset={(s.at - first) / span}
                stopColor={s.color}
              />
            ))}
          </linearGradient>
        </defs>
        <g transform={`translate(960 540) scale(${zoom}) translate(-960 -540)`}>
          <text
            x={cx}
            y={STAGE_H / 2 + BASELINE * size}
            textAnchor="middle"
            fill={`url(#${paint})`}
            style={{
              fontFamily: family,
              fontWeight,
              fontSize: size,
              letterSpacing: `${tracking}em`,
              wordSpacing: `${wordSpacing}em`,
              textRendering: "geometricPrecision",
            }}
          >
            {text}
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default TitleSweep;
