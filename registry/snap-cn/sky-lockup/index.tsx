"use client";

import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";
import {
  CUT,
  FLIP_FROM,
  FLIP_INK,
  FLIP_PAPER,
  FLIP_WIDTH,
  LEAVE,
  LEAVE_FADE,
  LEAVE_Y,
  LETTER_FADE,
  LETTER_RISE,
  LETTERS_OFF,
  LETTERS_ON,
  LINE_CENTER,
  LINE_ON,
  LINE_PIVOT,
  LINE_SCALE,
  LINE_X,
  LINE_Y,
  LOCKUP_CENTER,
  LOCKUP_GAP,
  LOCKUP_MARK,
  LOCKUP_SIZE,
  LOCKUP_Y,
  MARK_SCALE,
  MARK_X,
  MARK_Y,
  SKY,
  SKY_ZOOM,
  SNAPCN_MARK,
  TILE_FADE,
  TILE_LINE,
  TILE_RADIUS,
  TILE_SIZE,
  TILE_STROKE,
  TYPE_SIZE,
  TYPE_TRACKING,
  WIPE,
  WIPE_LEAN,
  WIPE_STOPS,
  WORD_FADE,
  WORD_GAP,
  WORD_RISE,
} from "./data";

const { fontFamily: GEIST, waitUntilDone: geistDone } = loadGeist("normal", {
  weights: ["500"],
  subsets: ["latin"],
});
const { fontFamily: POPPINS, waitUntilDone: poppinsDone } = loadPoppins(
  "normal",
  {
    weights: ["600"],
    subsets: ["latin"],
  },
);

const STAGE_W = 1920;
const STAGE_H = 1080;
/** The line may fill this much of the stage before it scales down to fit. */
const MAX_LINE = STAGE_W * 0.86;
/** The source frames the mark rests in the lockup, and in the line. */
const LOCKUP_FRAME = 12;
const LINE_FRAME = 44;
/** The source frame the line's layout was measured on. */
const LAYOUT_FRAME = 72;

export interface SkyLockupProps {
  /** The wordmark that types on beside the mark, on the sky. */
  wordmark?: string;
  /** Your mark as SVG paths, like Cut Lockup's `logo`. Defaults to the snapcn mark. */
  logo?: { width: number; height: number; shapes: readonly string[] };
  /**
   * Or the mark as an image URL, drawn in the mark's box (`contain`) and wins
   * over `logo`. Left out, `logo`. `""` means "no logo": the snapcn mark only
   * beside the wordmark snapcn; beside any other, no mark and no tile — the
   * line closes up and the wordmark lands alone, centred.
   */
  logoSrc?: string;
  /** The words left of the mark. */
  before?: string;
  /** The words right of the mark. */
  after?: string;
  /** Any image URL. Defaults to the Portal Intro picture. */
  sky?: string;
  /** A label from `fonts.ts` or a CSS family you have loaded. Defaults to Geist. */
  fontFamily?: string;
  fontWeight?: number;
  /** Type size on a 1920x1080 stage. */
  fontSize?: number;
  /** Nudge per word, `[x, y]` in stage px, for optical spacing. */
  wordNudge?: [number, number][];
  /** Tracking per word in em. */
  wordTracking?: number[];
  /** The wordmark's own face. Defaults to Poppins, which is the snapcn logotype. */
  wordmarkFont?: string;
  wordmarkWeight?: number;
  /** Wordmark size on that stage. */
  wordmarkSize?: number;
  /** Wordmark tracking in em. */
  wordmarkTracking?: number;
  /** Space between the mark and the wordmark, in stage px. */
  wordmarkGap?: number;
  /** Mark and wordmark colour on the sky. */
  lockupColor?: string;
  speed?: number;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

/** The snapcn mark belongs beside the snapcn wordmark and nowhere else. */
const isSnapcn = (name: string) => name.trim().toLowerCase() === "snapcn";

/** Past this much upscaling a raster icon's edges go visibly soft. */
const MAX_UPSCALE = 1.5;

/**
 * How much of the mark's box an image may fill. A site icon is often 64px and
 * the box is ~74 device px at 1080p (twice that at 4K), so a raster mark is
 * capped at MAX_UPSCALE x its natural size and sits smaller, centred, rather
 * than blown up to a blur. SVGs scale freely.
 */
function useIconFit(src: string | undefined, boxPx: number): number {
  const [natural, setNatural] = useState(0);
  useEffect(() => {
    setNatural(0);
    if (!src || /\.svg(\?|#|$)|^data:image\/svg/i.test(src)) return;
    const handle = delayRender(`sky-lockup: measuring ${src}`);
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

/** Sample a measured table at a fractional index; holds both ends. */
export const sample = (table: readonly number[], at: number) => {
  const x = Math.max(0, Math.min(at, table.length - 1));
  const i = Math.floor(x);
  const a = table[i] ?? 0;
  return a + ((table[i + 1] ?? a) - a) * (x - i);
};

/** Which source frame an out frame shows. The clip runs backwards through `CUT`. */
export const sourceFrame = (frame: number) => {
  const last = CUT[CUT.length - 1];
  if (frame >= last[0]) return last[1];
  const next = CUT.findIndex(([f]) => f > Math.max(0, frame));
  const [f0, s0] = CUT[next - 1];
  const [f1, s1] = CUT[next];
  return s0 + ((Math.max(0, frame) - f0) / (f1 - f0)) * (s1 - s0);
};

/** `count` beats spread evenly from `from` to `to`. */
export const beats = (count: number, from: number, to: number) => {
  const step = count > 1 ? (to - from) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => from + i * step);
};

/** Where each word starts, on the frames the measured line keys them. */
export const wordBeats = (count: number, at: readonly number[]) =>
  Array.from(
    { length: count },
    (_, i) =>
      (at[Math.min(i, at.length - 1)] ?? 0) +
      Math.max(0, i - at.length + 1) * LINE_ON.step,
  );

/** Left edge of every word, in px from the centre of the tile. */
export const layoutLine = (
  before: readonly number[],
  after: readonly number[],
  gap: number,
  tile: number,
) => {
  const left: number[] = [];
  let x = -tile / 2;
  for (let i = before.length - 1; i >= 0; i--) {
    x -= gap + (before[i] ?? 0);
    left.unshift(x);
  }
  const start = left[0] ?? -tile / 2;
  const right: number[] = [];
  let y = tile / 2;
  for (const w of after) {
    y += gap;
    right.push(y);
    y += w;
  }
  return {
    before: left,
    after: right,
    centre: (start + y) / 2,
    width: y - start,
  };
};

interface Metrics {
  before: number[];
  after: number[];
  letters: number[];
  wordmark: number;
}

const measure = (
  face: string,
  weight: number,
  before: string[],
  after: string[],
  tracking: (i: number) => number,
  markFace: string,
  markWeight: number,
  markTracking: number,
  wordmark: string,
): Metrics => {
  const P = 100;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("sky-lockup: no 2d context");
  const em = (text: string, f: string, w: number, track: number) => {
    ctx.font = `${w} ${P}px ${f}`;
    ctx.letterSpacing = `${track * P}px`;
    return ctx.measureText(text).width / P - track;
  };
  const chars = Array.from(wordmark);
  return {
    before: before.map((w, i) => em(w, face, weight, tracking(i))),
    after: after.map((w, i) =>
      em(w, face, weight, tracking(before.length + i)),
    ),
    letters: chars.map((_, i) =>
      i === 0
        ? 0
        : em(
            chars.slice(0, i + 1).join(""),
            markFace,
            markWeight,
            markTracking,
          ) - em(chars[i] ?? "", markFace, markWeight, markTracking),
    ),
    wordmark: em(wordmark, markFace, markWeight, markTracking),
  };
};

/**
 * Type at a fraction of a device pixel. Chrome rounds a baseline to a whole device
 * row, which turns a slow rise into a staircase, so the word is painted on the two
 * rows around `y` and added by the fraction between them. The scale pivots on the
 * baseline, so neither copy can climb the grid.
 */
const Word: React.FC<{
  x: number;
  y: number;
  scale: number;
  opacity: number;
  px: number;
  children: ReactNode;
}> = ({ x, y, scale, opacity, px, children }) => {
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
          transform={`translate(${x} ${(r + 1e-3) / px}) scale(${scale})`}
          style={{ opacity: w, mixBlendMode: "plus-lighter" }}
        >
          {children}
        </g>
      ))}
    </g>
  );
};

/**
 * Sky Lockup: a finished sentence takes itself apart word by word, the white page
 * washes off to a soft sky, and the mark that sat in the middle of the sentence
 * slides over, turns white and picks up its wordmark. One clock drives everything:
 * `source` is a frame of the recording this was measured from.
 */
export const SkyLockupScene: React.FC<SkyLockupProps & { source: number }> = ({
  source: s,
  wordmark = "snapcn",
  logo = SNAPCN_MARK,
  logoSrc,
  before = "your animations",
  after = "as one install",
  sky = SKY,
  fontFamily,
  fontWeight = 500,
  fontSize = TYPE_SIZE,
  wordNudge,
  wordTracking,
  wordmarkFont,
  wordmarkWeight = 600,
  wordmarkSize = LOCKUP_SIZE,
  wordmarkTracking = 0,
  wordmarkGap = LOCKUP_GAP,
  lockupColor = "#ffffff",
  theme,
  mode,
}) => {
  const t = useSnapCnTheme(theme, mode);
  const uid = useId().replace(/:/g, "");
  const { width, height } = useVideoConfig();
  const px = Math.max(width / STAGE_W, height / STAGE_H);
  const face = resolveFont(fontFamily) ?? resolveFont(t.fontFamily) ?? GEIST;
  const markFace = resolveFont(wordmarkFont) ?? POPPINS;
  const left = before.trim().split(/\s+/).filter(Boolean);
  const right = after.trim().split(/\s+/).filter(Boolean);
  const letters = Array.from(wordmark);
  const hasMark = logoSrc !== "" || isSnapcn(wordmark);
  const iconFit = useIconFit(logoSrc || undefined, LOCKUP_MARK * px);

  const [m, setM] = useState<Metrics | null>(null);
  const [handle] = useState(() => delayRender("sky-lockup: measuring type"));
  const text = `${left.join(" ")}\n${right.join(" ")}`;
  const tracks = wordTracking ?? [];
  const trackKey = tracks.join();
  useEffect(() => {
    let live = true;
    // measuring a fallback face measures the wrong face. `fonts.load` alone is
    // not enough: until the loaders have registered Geist and Poppins it finds
    // no matching face and resolves at once, and the canvas measures the
    // fallback — "animations" 438.8 vs 513.6 painted, so every word ran into
    // the next ("youranimations").
    Promise.all([geistDone(), poppinsDone()])
      .catch(() => undefined)
      .then(() =>
        Promise.all([
          document.fonts.load(`${fontWeight} 100px ${face}`, text),
          document.fonts.load(`${wordmarkWeight} 100px ${markFace}`, wordmark),
        ]),
      )
      .catch(() => undefined)
      .then(() => {
        if (live) {
          const [a = "", b = ""] = text.split("\n");
          setM(
            measure(
              face,
              fontWeight,
              a.split(" ").filter(Boolean),
              b.split(" ").filter(Boolean),
              (i) => Number(trackKey.split(",")[i] || TYPE_TRACKING),
              markFace,
              wordmarkWeight,
              wordmarkTracking,
              wordmark,
            ),
          );
        }
      });
    return () => {
      live = false;
    };
  }, [
    face,
    fontWeight,
    text,
    trackKey,
    markFace,
    wordmarkWeight,
    wordmarkTracking,
    wordmark,
  ]);
  useEffect(() => {
    if (m) continueRender(handle);
  }, [m, handle]);

  const tile72 = sample(TILE_SIZE, LAYOUT_FRAME);
  const lineAt = (size: number) =>
    m
      ? layoutLine(
          m.before.map((w) => w * size),
          m.after.map((w) => w * size),
          (WORD_GAP * size) / TYPE_SIZE,
          // No mark: no tile, and the halves close up to one word gap.
          hasMark ? tile72 : (-WORD_GAP * size) / TYPE_SIZE,
        )
      : null;
  const full = lineAt(fontSize);
  // Only the type gives way to a long line: the tile stays the size of the mark.
  const tileW = hasMark ? tile72 : 0;
  const fit = full ? Math.min(1, (MAX_LINE - tileW) / (full.width - tileW)) : 1;
  const rest = lineAt(fontSize * fit);

  // The measured line sat `centre` off its tile. Any other sentence stays centred on
  // the same spot, and carries the tile with it.
  const lineShift = rest
    ? LINE_CENTER - sample(MARK_X, LAYOUT_FRAME) - rest.centre
    : 0;
  // Where the wordmark starts, from the mark's centre (the lockup's left edge
  // sits LOCKUP_MARK / 2 left of it, mark or not).
  const lettersAt = hasMark ? LOCKUP_MARK / 2 + wordmarkGap : -LOCKUP_MARK / 2;
  const lockupWidth = m
    ? (hasMark ? LOCKUP_MARK + wordmarkGap : 0) + m.wordmark * wordmarkSize
    : 0;
  const lockupShift = m
    ? LOCKUP_CENTER -
      lockupWidth / 2 +
      LOCKUP_MARK / 2 -
      sample(MARK_X, LOCKUP_FRAME)
    : 0;

  // How far the mark has travelled from lockup to line, read off its own curve, so
  // a wider lockup cannot pull it into the words while they are still on screen.
  const lockupX = sample(MARK_X, LOCKUP_FRAME);
  const glide = Math.max(
    0,
    Math.min(
      1,
      (sample(MARK_X, s) - lockupX) /
        ((sample(MARK_X, LINE_FRAME) - lockupX) * 0.85),
    ),
  );
  const markX =
    sample(MARK_X, s) + lockupShift * (1 - glide) + lineShift * glide;
  const markY = sample(MARK_Y, s);
  const markScale = sample(MARK_SCALE, s);
  const logoScale = LOCKUP_MARK / Math.max(logo.width, logo.height);

  const lineScale = sample(LINE_SCALE, s);
  const lineDrift = sample(LINE_X, s);

  const zoom = 1 + SKY_ZOOM.from * Math.exp(-s / SKY_ZOOM.tau);
  const swing = sample(WIPE_LEAN, s);
  const lean = 1 + swing * swing;
  const wipe = sample(WIPE, s);
  const [uMin = 0, uMax = 0] = [
    WIPE_STOPS[0],
    WIPE_STOPS[WIPE_STOPS.length - 2],
  ];
  // Measured against the stage, so it rides with a mark that sits somewhere else.
  const flipShift = markX - sample(MARK_X, s);
  const flipPaper = sample(FLIP_PAPER, s - FLIP_FROM) + flipShift;
  const flipInk = sample(FLIP_INK, s - FLIP_FROM) + flipShift;
  const local = (x: number) => (x - markX) / (markScale * logoScale);
  const tile = sample(TILE_SIZE, s);

  const on = beats(letters.length, LETTERS_ON.from, LETTERS_ON.to);
  const off = beats(letters.length, LETTERS_OFF.to, LETTERS_OFF.from);
  const words = rest
    ? [
        ...left.map((w, i) => ({
          w,
          x: rest.before[i] ?? 0,
          at: wordBeats(left.length, LINE_ON.first)[i] ?? 0,
        })),
        ...right.map((w, i) => ({
          w,
          x: rest.after[i] ?? 0,
          at: wordBeats(right.length, LINE_ON.second)[i] ?? 0,
        })),
      ]
    : [];

  return (
    <AbsoluteFill style={{ background: t.card, overflow: "hidden" }}>
      <Img
        src={sky}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          maxWidth: "none",
          objectFit: "cover",
          transform: `scale(${zoom})`,
        }}
      />
      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0 }}
      >
        <title>{`${before} ${after}`}</title>
        <defs>
          <linearGradient
            id={`${uid}w`}
            gradientUnits="userSpaceOnUse"
            x1={wipe + uMin / lean}
            y1={STAGE_H / 2 + (swing * uMin) / lean}
            x2={wipe + uMax / lean}
            y2={STAGE_H / 2 + (swing * uMax) / lean}
          >
            {WIPE_STOPS.flatMap((u, i) =>
              i % 2
                ? []
                : [
                    <stop
                      key={u}
                      offset={(u - uMin) / (uMax - uMin)}
                      stopColor={t.card}
                      stopOpacity={WIPE_STOPS[i + 1]}
                    />,
                  ],
            )}
          </linearGradient>
          {[
            { id: "p", at: flipPaper, from: 1, to: 0, c: lockupColor },
            { id: "i", at: flipInk, from: 0, to: 1, c: t.foreground },
          ].map(({ id, at, from, to, c }) => (
            <linearGradient
              key={id}
              id={`${uid}${id}`}
              gradientUnits="userSpaceOnUse"
              x1={local(at - FLIP_WIDTH / 2) + logo.width / 2}
              x2={local(at + FLIP_WIDTH / 2) + logo.width / 2}
              y1={0}
              y2={0}
            >
              <stop offset={0} stopColor={c} stopOpacity={from} />
              <stop offset={1} stopColor={c} stopOpacity={to} />
            </linearGradient>
          ))}
        </defs>

        <rect width={STAGE_W} height={STAGE_H} fill={`url(#${uid}w)`} />

        {m &&
          letters.map((ch, i) => {
            const fade = sample(LETTER_FADE, s - (off[i] ?? 0));
            const k = s - (on[i] ?? 0);
            return (
              <Word
                // biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
                key={i}
                x={markX + lettersAt + (m.letters[i] ?? 0) * wordmarkSize}
                y={LOCKUP_Y + sample(LETTER_RISE, k)}
                scale={1}
                opacity={k < 0 ? 0 : fade}
                px={px}
              >
                <text
                  fill={lockupColor}
                  style={{
                    fontFamily: markFace,
                    fontWeight: wordmarkWeight,
                    fontSize: wordmarkSize,
                    textRendering: "geometricPrecision",
                  }}
                >
                  {ch}
                </text>
              </Word>
            );
          })}

        {hasMark && (
          <g transform={`translate(${markX} ${markY})`}>
            <rect
              x={-tile / 2}
              y={-tile / 2}
              width={tile}
              height={tile}
              rx={(tile / 2) * TILE_RADIUS}
              fill={t.card}
              stroke={mixOklch(t.border, t.card, TILE_LINE)}
              strokeWidth={TILE_STROKE}
              opacity={sample(TILE_FADE, s - FLIP_FROM)}
            />
            {logoSrc ? (
              // An image keeps its own colours: it has no paper/ink to flip.
              <g transform={`scale(${markScale})`}>
                <foreignObject
                  x={(-LOCKUP_MARK * iconFit) / 2}
                  y={(-LOCKUP_MARK * iconFit) / 2}
                  width={LOCKUP_MARK * iconFit}
                  height={LOCKUP_MARK * iconFit}
                >
                  <Img
                    src={logoSrc}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </foreignObject>
              </g>
            ) : (
              <g
                transform={`scale(${markScale * logoScale}) translate(${-logo.width / 2} ${-logo.height / 2})`}
              >
                {logo.shapes.map((d) => (
                  <path
                    key={d}
                    d={d}
                    fillRule="evenodd"
                    fill={`url(#${uid}p)`}
                  />
                ))}
                {logo.shapes.map((d) => (
                  <path
                    key={d}
                    d={d}
                    fillRule="evenodd"
                    fill={`url(#${uid}i)`}
                  />
                ))}
              </g>
            )}
          </g>
        )}

        {words.map(({ w, x, at }, i) => {
          const k = s - at;
          const gone = s - LEAVE.from - i * LEAVE.stagger;
          return (
            <Word
              key={w + at}
              x={
                LINE_PIVOT +
                lineScale *
                  (sample(MARK_X, LAYOUT_FRAME) +
                    lineShift +
                    x +
                    (wordNudge?.[i]?.[0] ?? 0) -
                    LINE_PIVOT) +
                lineDrift
              }
              y={
                LINE_Y +
                (wordNudge?.[i]?.[1] ?? 0) +
                sample(WORD_RISE, k) +
                sample(LEAVE_Y, gone) +
                (lineScale - 1) * (LINE_Y - sample(MARK_Y, LAYOUT_FRAME))
              }
              scale={lineScale * fit}
              opacity={
                k < 0 ? 0 : sample(WORD_FADE, k) * sample(LEAVE_FADE, gone)
              }
              px={px}
            >
              <text
                fill={t.foreground}
                style={{
                  fontFamily: face,
                  fontWeight,
                  fontSize: fontSize,
                  letterSpacing: `${tracks[i] ?? TYPE_TRACKING}em`,
                  textRendering: "geometricPrecision",
                }}
              >
                {w}
              </text>
            </Word>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export const SkyLockup: React.FC<SkyLockupProps> = ({
  speed = 1,
  ...props
}) => {
  const frame = useCurrentFrame() * speed;
  return <SkyLockupScene {...props} source={sourceFrame(frame)} />;
};

export default SkyLockup;
