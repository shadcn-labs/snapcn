"use client";

import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";
import {
  CAPTIONS,
  FRAMES,
  IMAGES,
  LOGO,
  RATE,
  SNAPCN_MARK,
  TILES,
  WORDS,
} from "./data";

const { fontFamily: INTER_TIGHT } = loadInterTight("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

const STAGE_W = 1920;
const STAGE_H = 1080;
/** Layout size of a tile before its transform; big, so percentages snap to nothing. */
const UNIT = 2000;

export interface GatherLockupProps {
  /** The title: lines of words. Five words read best, the wall leaves on them. */
  lines?: readonly (readonly string[])[];
  /** Fifteen pictures: seven on the wall, four in the row, four they swap to. */
  images?: readonly string[];
  /** A caption under each of the seven tiles on the wall. */
  captions?: readonly string[];
  /** The wordmark the row turns into. */
  wordmark?: string;
  /** Your mark as SVG paths, like Cut Lockup's `logo`. Defaults to the snapcn mark. */
  logo?: {
    width: number;
    height: number;
    shapes: readonly string[];
  };
  font?: string;
  /** Wordmark colour. Defaults to the theme's foreground. */
  wordmarkColor?: string;
  /** Letter spacing of the wordmark, in em. */
  wordmarkTracking?: number;
  /** CSS background under everything. Defaults to the theme's page colour. */
  backdrop?: string;
  speed?: number;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

/** The pose in force at `frame`: the last key that has started. */
export const pose = <K extends readonly number[]>(
  keys: readonly K[],
  frame: number,
) => {
  let hit: K | undefined;
  for (const k of keys) if ((k[0] ?? 0) <= frame) hit = k;
  return hit;
};

/**
 * Letters of the wordmark at a key: the first `n` scaled from the six-letter
 * source, split before the last one shown when `split` is set.
 */
export const reveal = (word: string, n: number, split: number) => {
  const shown =
    n >= 6
      ? word.length
      : n >= 4
        ? word.length - 1
        : Math.ceil(word.length / 3);
  return split
    ? [word.slice(0, shown - 1), word.slice(shown - 1, shown)]
    : [word.slice(0, shown), ""];
};

const Title: React.FC<{
  frame: number;
  words: readonly string[];
  fill: string;
  font: string;
}> = ({ frame, words, fill, font }) => (
  <>
    {WORDS.map((w, i) => {
      const k = pose(w.keys, frame);
      const word = words[i];
      if (!k || !word || frame > w.until) return null;
      return (
        <text
          key={`${i}-${word}`}
          x={k[1]}
          y={k[2]}
          textAnchor={w.anchor}
          fill={fill}
          style={{
            fontFamily: font,
            fontWeight: 600,
            fontSize: k[3],
            letterSpacing: "-0.02em",
            textRendering: "geometricPrecision",
          }}
        >
          {word}
        </text>
      );
    })}
  </>
);

/**
 * Gather Lockup: a wall of your work under a line of type. The line falls apart
 * word by word, the wall cuts in to a row of four, then each slot swaps its
 * picture and hands over to your mark and wordmark. `t` is seconds into the clip.
 */
export const GatherLockupScene: React.FC<GatherLockupProps & { t: number }> = ({
  t,
  lines = [["Ship"], ["your", "demo"], ["in", "code"]],
  images = IMAGES,
  captions = CAPTIONS,
  wordmark = "snapcn",
  logo = SNAPCN_MARK,
  font,
  wordmarkColor,
  wordmarkTracking = -0.03,
  backdrop,
  theme,
  mode,
}) => {
  const c = useSnapCnTheme(theme, mode);
  const { width, height } = useVideoConfig();
  const frame = Math.min(FRAMES - 1, Math.floor(t * RATE + 1e-6));
  const family = resolveFont(font) ?? INTER_TIGHT;
  const px = Math.max(width / STAGE_W, height / STAGE_H);
  const words = lines.flat();
  // ponytail: width by letter count, not measured; the source wordmark has six letters
  const lockupShift = -0.28 * LOGO.wordSize * (wordmark.length - 6);
  const mark = pose(LOGO.mark, frame);
  const word = pose(LOGO.word, frame);
  const [head, tail] = word
    ? reveal(wordmark, word[1] ?? 0, word[2] ?? 0)
    : ["", ""];
  const scale = LOGO.size / Math.max(logo.width, logo.height);

  return (
    <AbsoluteFill
      style={{ background: backdrop ?? c.background, overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          left: (width - STAGE_W * px) / 2,
          top: (height - STAGE_H * px) / 2,
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${px})`,
          transformOrigin: "0 0",
        }}
      >
        {TILES.map((tile) => {
          const k = pose(tile.keys, frame);
          if (!k || frame > tile.until) return null;
          const [, pic = 0, x = 0, y = 0, w = 0, h = 0] = k;
          const [bx = 0, by = 0, bw = 0, bh = 0] = k.slice(6);
          return (
            // Unit box scaled up: left/top/width/height would snap to device pixels.
            <div
              key={tile.keys[0]?.[1]}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: UNIT,
                height: (UNIT * h) / w,
                overflow: "hidden",
                opacity: tile.opacity,
                transformOrigin: "0 0",
                transform: `translate(${x}px, ${y}px) scale(${w / UNIT})`,
              }}
            >
              <Img
                src={images[pic % Math.max(1, images.length)] ?? ""}
                style={{
                  position: "absolute",
                  left: `${((bx - x) / w) * 100}%`,
                  top: `${((by - y) / h) * 100}%`,
                  width: `${(bw / w) * 100}%`,
                  height: `${(bh / h) * 100}%`,
                  maxWidth: "none",
                  objectFit: "cover",
                }}
              />
            </div>
          );
        })}

        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          width={STAGE_W}
          height={STAGE_H}
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          {TILES.map((tile, i) => {
            const k = pose(tile.keys, frame);
            if (!k || frame > tile.until || (k[1] ?? 0) > 6) return null;
            const [, , x = 0, y = 0, , h = 0] = k;
            return (
              <g key={tile.keys[0]?.[1]} opacity={tile.opacity}>
                <circle
                  cx={x + 6}
                  cy={y + h + 18}
                  r={4.5}
                  fill={c.foreground}
                  opacity={0.5}
                />
                <text
                  x={x + 19}
                  y={y + h + 23}
                  fill={c.foreground}
                  opacity={0.45}
                  style={{
                    fontFamily: family,
                    fontSize: 15,
                    fontWeight: 500,
                    textRendering: "geometricPrecision",
                  }}
                >
                  {captions[i]}
                </text>
              </g>
            );
          })}
          <Title
            frame={frame}
            words={words}
            fill={c.foreground}
            font={family}
          />
          {mark ? (
            <g
              transform={`translate(${(mark[1] ?? 0) + lockupShift} ${mark[2] ?? 0}) scale(${scale})`}
            >
              <title>{wordmark}</title>
              {logo.shapes.map((d) => (
                <path key={d} d={d} fill={c.primary} fillRule="evenodd" />
              ))}
            </g>
          ) : null}
          {word ? (
            <text
              x={(word[3] ?? 0) + lockupShift}
              y={word[4]}
              fill={wordmarkColor ?? c.foreground}
              style={{
                fontFamily: family,
                fontWeight: 600,
                fontSize: LOGO.wordSize,
                letterSpacing: `${wordmarkTracking}em`,
                textRendering: "geometricPrecision",
              }}
            >
              {head}
              {tail ? <tspan dx={LOGO.gap}>{tail}</tspan> : null}
            </text>
          ) : null}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

export const GatherLockup: React.FC<GatherLockupProps> = ({
  speed = 1,
  ...props
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <GatherLockupScene {...props} t={(frame * speed) / fps} />;
};

export default GatherLockup;
