"use client";

import type { CSSProperties } from "react";
import { useId, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { SNAPCN_LOGO } from "./data";

/**
 * Cut Lockup — a logo in hard cuts. It lands huge on grid paper and steps down
 * in three cuts, pushes in, cuts to night where its construction lines draw
 * themselves, then a paper panel wipes up onto the resting lockup.
 *
 * Every default is measured frame by frame off a 714x390 screen recording at
 * 30fps ("ref px"); the stage maps that box onto the composition by width.
 */

export const REF_W = 714;
export const REF_H = 390;

export interface LogoArt {
  /** viewBox width/height of `shapes`. */
  width: number;
  height: number;
  /** SVG path data, one entry per shape. Each subpath is drawn as its own construction line. */
  shapes: string[];
}

export interface CutStep {
  /** Frame the cut lands on. */
  from: number;
  /** Logo width, as a multiple of the resting width (`size`). */
  scale: number;
  /** Centre offset in logo widths (the huge first cut sits off-centre). */
  x?: number;
  y?: number;
  /** Horizontal drift, logo widths per frame. */
  drift?: number;
}

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

/**
 * Split SVG path data into absolute subpaths and collect each one's anchor points
 * (segment end points) — the dots of the construction view.
 */
export const splitPath = (d: string) => {
  const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e-?\d+)?/g) ?? [];
  const subs: { d: string; dots: [number, number][]; minX: number }[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cur: { d: string[]; dots: [number, number][] } | null = null;
  const n = () => Number(toks[i++]);
  const flush = () => {
    if (cur)
      subs.push({
        d: cur.d.join(""),
        dots: cur.dots,
        minX: Math.min(...cur.dots.map((p) => p[0])),
      });
    cur = null;
  };
  const f = (v: number) => +v.toFixed(2);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i]!)) cmd = toks[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === "Z") {
      cur?.d.push("Z");
      x = sx;
      y = sy;
      flush();
      continue;
    }
    if (C === "M") {
      flush();
      x = ox + n();
      y = oy + n();
      sx = x;
      sy = y;
      cur = { d: [`M${f(x)} ${f(y)}`], dots: [[x, y]] };
      cmd = rel ? "l" : "L";
      continue;
    }
    if (!cur) cur = { d: [`M${f(x)} ${f(y)}`], dots: [[x, y]] };
    if (C === "L" || C === "T") {
      x = ox + n();
      y = oy + n();
      cur.d.push(`L${f(x)} ${f(y)}`);
    } else if (C === "H") {
      x = ox + n();
      cur.d.push(`L${f(x)} ${f(y)}`);
    } else if (C === "V") {
      y = oy + n();
      cur.d.push(`L${f(x)} ${f(y)}`);
    } else if (C === "C") {
      const p = [ox + n(), oy + n(), ox + n(), oy + n(), ox + n(), oy + n()];
      [x, y] = [p[4]!, p[5]!];
      cur.d.push(`C${p.map(f).join(" ")}`);
    } else if (C === "S" || C === "Q") {
      const p = [ox + n(), oy + n(), ox + n(), oy + n()];
      [x, y] = [p[2]!, p[3]!];
      cur.d.push(`${C}${p.map(f).join(" ")}`);
    } else if (C === "A") {
      const p = [n(), n(), n(), n(), n(), ox + n(), oy + n()];
      [x, y] = [p[5]!, p[6]!];
      cur.d.push(`A${p.join(" ")}`);
    } else {
      i++;
      continue;
    }
    // a closing segment that lands back on the start is not a new anchor
    if (Math.hypot(x - sx, y - sy) > 1e-6) cur.dots.push([x, y]);
  }
  flush();
  return subs;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface CutLockupProps {
  /** Your logo as SVG paths. Defaults to the snapcn mark + wordmark. */
  logo?: LogoArt;
  /** Resting logo width as a fraction of the frame width. */
  size?: number;

  /** Logo ink on paper. */
  ink?: string;
  /** Paper: left edge, middle, right edge. */
  paper?: [string, string, string];
  /** Grid-paper lines on the left of the paper; pitch in ref px. */
  grid?: { color: string; pitch: number; width: number };
  /** Edge roughness of the printed logo, ref px (0 = clean vector edges). */
  roughness?: number;

  /** The hard cuts on paper, in order. */
  steps?: CutStep[];
  /** Push-in before the cut to night: [frame, scale multiplier]. */
  push?: [number, number][];

  /** Night: background, construction line and anchor dot colours. */
  night?: string;
  line?: string;
  dot?: string;
  /** Frame the cut to night lands on, and the logo scale there. */
  nightAt?: number;
  nightScale?: number;
  /** Construction drawing: frames per shape, and the left-to-right spread across the logo. */
  drawFrames?: number;
  drawSpread?: number;

  /** Paper wipe: [frame, top edge as a fraction of the height]. */
  wipe?: [number, number][];
  /** Paper after the wipe, and the logo scale on it. */
  endPaper?: string;
  endScale?: number;

  speed?: number;
}

export const CutLockup = ({
  logo = SNAPCN_LOGO,
  size = 0.2335,
  ink = "#1f1f1f",
  paper = ["#f6f6f6", "#f8f8f8", "#fcfcfc"],
  grid = { color: "rgba(0,0,0,0.014)", pitch: 22, width: 1 },
  roughness = 0.35,
  steps = [
    { from: 0, scale: 9.525, x: 0.11536, y: -0.00035, drift: -0.0001655 },
    { from: 8, scale: 4.6105, x: 0.01566, y: 0.00175 },
    { from: 18, scale: 3.0057, x: -0.003 },
    { from: 28, scale: 1, x: -0.0083, y: 0.00126 },
  ],
  push = [
    [36, 1],
    [37, 1.0006],
    [38, 1.0048],
    [39, 1.0087],
    [40, 1.0162],
    [41, 1.0313],
    [42, 1.0703],
  ],
  night = "#242424",
  line = "rgba(255,255,255,0.11)",
  dot = "rgba(255,255,255,0.22)",
  nightAt = 43,
  nightScale = 1.154,
  drawFrames = 7,
  drawSpread = 22,
  wipe = [
    [91, 1],
    [92, 386 / 390],
    [93, 376 / 390],
    [94, 360 / 390],
    [95, 334 / 390],
    [96, 277 / 390],
    [97, 114 / 390],
    [98, 57 / 390],
    [99, 31 / 390],
    [100, 15 / 390],
    [101, 5 / 390],
    [102, 0],
  ],
  endPaper = "#f8f8f8",
  endScale = 1.1894,
  speed = 1,
}: CutLockupProps) => {
  const fr = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const id = useId().replace(/:/g, "");
  const u = width / REF_W; // px per ref px
  const restW = size * width;

  const subs = useMemo(
    () =>
      logo.shapes.flatMap((d) => splitPath(d)).sort((a, b) => a.minX - b.minX),
    [logo],
  );

  // Logo placement: centre offset (logo widths) and scale (× resting width).
  const place = (scale: number, x = 0, y = 0) => {
    const w = restW * scale;
    const k = w / logo.width;
    const cx = width / 2 + x * w;
    const cy = height / 2 + y * w;
    return {
      k,
      transform: `translate(${cx} ${cy}) scale(${k}) translate(${-logo.width / 2} ${-logo.height / 2})`,
    };
  };

  const rough = (
    <filter
      id={`${id}r`}
      x="-5%"
      y="-5%"
      width="110%"
      height="110%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency={0.55 / u}
        numOctaves={1}
        seed={3}
      />
      <feDisplacementMap
        in="SourceGraphic"
        scale={roughness * u * 2}
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  );
  const fillLogo = (
    scale: number,
    x: number | undefined,
    y: number | undefined,
    fill: string,
  ) => {
    const p = place(scale, x, y);
    return (
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>{rough}</defs>
        <g filter={roughness > 0 ? `url(#${id}r)` : undefined}>
          <g transform={p.transform}>
            <path d={logo.shapes.join(" ")} fill={fill} fillRule="evenodd" />
          </g>
        </g>
      </svg>
    );
  };

  const paperBg: CSSProperties = {
    background: `linear-gradient(to right, ${paper[0]}, ${paper[1]} 45%, ${paper[2]})`,
  };
  const gridBg: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 200 * u,
    backgroundImage: `repeating-linear-gradient(to right, ${grid.color} 0 ${grid.width * u}px, transparent ${grid.width * u}px ${grid.pitch * u}px), repeating-linear-gradient(to bottom, ${grid.color} 0 ${grid.width * u}px, transparent ${grid.width * u}px ${grid.pitch * u}px)`,
    maskImage: "linear-gradient(to right, #000 85%, transparent)",
    WebkitMaskImage: "linear-gradient(to right, #000 85%, transparent)",
  };

  // ---- 1. hard cuts on paper
  if (fr < nightAt) {
    let s = steps[0]!;
    for (const st of steps) if (fr >= st.from) s = st;
    const m = track(push, fr);
    const x = (s.x ?? 0) + (s.drift ?? 0) * (fr - s.from);
    return (
      <AbsoluteFill style={paperBg}>
        <div style={gridBg} />
        {fillLogo(s.scale * (fr >= push[0]![0] ? m : 1), x, s.y, ink)}
      </AbsoluteFill>
    );
  }

  // ---- 2. night: construction lines, then the paper wipes up
  const p = place(nightScale, -0.0072, 0.0005);
  const sw = u / p.k;
  const span = Math.max(...subs.map((q) => q.minX)) || 1;
  const top = track(wipe, fr);
  return (
    <AbsoluteFill style={{ background: night }}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0 }}
      >
        <g transform={p.transform}>
          {subs.map((q) => {
            const a = clamp01(
              (fr - (nightAt + 1 + (q.minX / span) * drawSpread)) / drawFrames,
            );
            if (a <= 0) return null;
            return (
              <g key={q.d}>
                <path
                  d={q.d}
                  pathLength={1}
                  fill="none"
                  stroke={line}
                  strokeWidth={sw}
                  strokeDasharray={`${a} 1`}
                />
                {q.dots.map(([dx, dy], j) =>
                  a * q.dots.length > j ? (
                    <circle key={`${dx},${dy}`} cx={dx} cy={dy} r={1.1 * sw} fill={dot} />
                  ) : null,
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {top < 1 && (
        <AbsoluteFill
          style={{
            background: endPaper,
            clipPath: `inset(${top * 100}% 0 0 0)`,
          }}
        >
          {fillLogo(endScale, -0.0072, 0.0004, ink)}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export default CutLockup;
