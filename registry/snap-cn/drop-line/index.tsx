"use client";

import { loadFont } from "@remotion/google-fonts/Inter";
import type { ReactNode } from "react";
import { useId } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";
import { BASELINE, DOT_LINE, DROP, FONT_SIZE, HOLDS, RISE } from "./data";

const { fontFamily: inter } = loadFont("normal", { weights: ["700"] });

const STAGE_W = 1920;
const STAGE_H = 1080;
/** Words may fill this much of the stage width before they scale down to fit. */
const MAX_WIDTH = STAGE_W * 0.9;
const DOTTED = /[ij]/;

/**
 * Drop Line: words cut in place, the first rising into position, and on the last
 * card the word sinks out from under its own dot. The dot holds its position, so
 * the sentence ends on one mark left hanging. A last word with no "i" or "j" just
 * drops whole.
 */
export interface DropLineProps {
  /** One word per card; the last one drops. */
  words?: string[];
  fontFamily?: string;
  fontWeight?: number;
  /** Type size on a 1920x1080 stage. */
  fontSize?: number;
  /** Size per word on that stage, for faces that set a card differently. */
  wordSize?: number[];
  /** Horizontal nudge per word, in stage px, for optical centring. */
  wordNudge?: number[];
  /** Tracking per word in em. */
  wordTracking?: number[];
  /** Per-letter offsets per word, in em. */
  wordKerning?: number[][];
  /** The card. Defaults to the theme foreground. */
  ink?: string;
  /** The type. Defaults to the theme background. */
  paper?: string;
  speed?: number;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

/** Sample a measured table at a fractional frame; holds both ends. */
export const sample = (table: readonly number[], at: number) => {
  const x = Math.max(0, Math.min(at, table.length - 1));
  const i = Math.floor(x);
  const a = table[i] ?? 0;
  return a + ((table[i + 1] ?? a) - a) * (x - i);
};

/** Frame each word cuts in, the frame the last card ends, and when its drop table starts. */
export const timeline = (count: number) => {
  const starts = Array.from({ length: count }, (_, i) =>
    i === 0 ? 0 : HOLDS.first + (i - 1) * HOLDS.word,
  );
  const end = HOLDS.first + Math.max(0, count - 2) * HOLDS.word + HOLDS.last;
  return { starts, end, drop: end - DROP.length };
};

/** Which card is up at frame `f`. */
export const cardAt = (starts: readonly number[], f: number) =>
  starts.reduce((at, s, i) => (f >= s ? i : at), 0);

let measureCtx: CanvasRenderingContext2D | null | undefined;

const fontMeasure = (font: string) => {
  if (typeof document === "undefined") return null;
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (measureCtx) measureCtx.font = font;
  return measureCtx ?? null;
};

/**
 * A line that can sit a fraction of a pixel. Chrome rounds a baseline to a whole
 * device pixel, which turns a slow drop into a staircase, so the type is painted
 * on the two rows around `y` and added by the fraction between them.
 */
const Line: React.FC<{
  y: number;
  base: number;
  px: number;
  children: ReactNode;
}> = ({ y, base, px, children }) => {
  const row = Math.floor(y * px);
  const f = y * px - row;
  return (
    <g style={{ isolation: "isolate" }}>
      {[
        { r: row, w: 1 - f },
        { r: row + 1, w: f },
      ].map(({ r, w }) => (
        <g
          key={r}
          transform={`translate(0 ${(r + 1e-3) / px - base})`}
          style={{ opacity: w, mixBlendMode: "plus-lighter" }}
        >
          {children}
        </g>
      ))}
    </g>
  );
};

export const DropLine: React.FC<DropLineProps> = ({
  words = ["then", "ships", "the", "film"],
  fontFamily = inter,
  fontWeight = 700,
  fontSize = FONT_SIZE,
  wordSize,
  wordNudge,
  wordTracking,
  wordKerning,
  ink,
  paper,
  speed = 1,
  theme,
  mode,
}) => {
  const t = useSnapCnTheme(theme, mode);
  const uid = useId().replace(/:/g, "");
  const f = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const px = Math.max(width / STAGE_W, height / STAGE_H);
  const card = ink ?? t.foreground;
  const type = paper ?? t.background;

  const line = timeline(words.length);
  const index = cardAt(line.starts, f);
  const word = words[index] ?? "";
  const isLast = index === words.length - 1;
  const chars = Array.from(word);
  const tracking = wordTracking?.[index] ?? -0.015;

  const wanted = wordSize?.[index] ?? fontSize;
  const ctx = fontMeasure(`${fontWeight} ${wanted}px ${fontFamily}`);
  const measured =
    (ctx ? ctx.measureText(word).width : chars.length * wanted * 0.6) +
    (chars.length - 1) * tracking * wanted;
  const fit = Math.min(1, MAX_WIDTH / Math.max(1, measured));
  const size = wanted * fit;

  // Keep the type centred on the stage as `fontSize` moves away from the measured one.
  const rest = STAGE_H / 2 + (BASELINE - STAGE_H / 2) * (fontSize / FONT_SIZE);
  const fall = isLast ? sample(DROP, f - line.drop) : 0;
  const y = rest + (index === 0 ? sample(RISE, f) : 0);

  // The cut between a dot and its stem: just above the x-height, on any face.
  const dots = isLast && DOTTED.test(word);
  const xHeight = ctx?.measureText("x").actualBoundingBoxAscent;
  const dotTop = ctx?.measureText("i").actualBoundingBoxAscent;
  const dotLine =
    xHeight && dotTop
      ? rest - (xHeight + (dotTop - xHeight) * 0.15) * fit
      : rest - DOT_LINE * size;

  const letters = (show: (ch: string) => boolean) => (
    <text
      x={STAGE_W / 2 + (wordNudge?.[index] ?? 0)}
      y={rest}
      textAnchor="middle"
      fill={type}
      style={{
        fontFamily,
        fontWeight,
        fontSize: size,
        letterSpacing: `${tracking}em`,
        textRendering: "geometricPrecision",
      }}
    >
      {chars.map((ch, i) => (
        <tspan
          // biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
          key={i}
          dx={`${wordKerning?.[index]?.[i] ?? 0}em`}
          fillOpacity={show(ch) ? 1 : 0}
        >
          {ch}
        </tspan>
      ))}
    </text>
  );

  return (
    <AbsoluteFill style={{ background: card, overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0 }}
      >
        <title>{words.join(" ")}</title>
        <defs>
          <clipPath id={`${uid}a`}>
            <rect width={STAGE_W} height={dotLine} />
          </clipPath>
          <clipPath id={`${uid}b`}>
            <rect y={dotLine} width={STAGE_W} height={STAGE_H * 2} />
          </clipPath>
        </defs>
        <Line y={y + fall} base={rest} px={px}>
          {dots ? (
            <>
              {letters((ch) => !DOTTED.test(ch))}
              <g clipPath={`url(#${uid}b)`}>
                {letters((ch) => DOTTED.test(ch))}
              </g>
            </>
          ) : (
            letters(() => true)
          )}
        </Line>
        {dots && (
          <Line y={y} base={rest} px={px}>
            <g clipPath={`url(#${uid}a)`}>{letters((ch) => DOTTED.test(ch))}</g>
          </Line>
        )}
      </svg>
    </AbsoluteFill>
  );
};

export default DropLine;
