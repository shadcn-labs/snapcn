"use client";

import { loadFont } from "@remotion/google-fonts/InterTight";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";
import {
  BRANDS,
  type BrandMark,
  brandKey,
  CURSOR,
  ENTER,
  FADE,
  FIRST,
  FIRST_REST,
  INK,
  PITCH,
  REF_H,
  REF_W,
  STEP,
  STEP_FRAMES,
  STOP_EARLY,
  SWAP,
} from "./data";

/**
 * A lead word and a wheel of brand pills that rolls through where you ship.
 *
 * "launch on" holds the left of the line; the pill to its
 * right is one row of a column whose other rows sit above and below it, blurred
 * and fading. The column rolls a row every two thirds of a second, never quite
 * stopping, draws in as a cursor glides up, and freezes on the last brand just
 * as the cursor clicks it. A ring answers the click, then the line slides away.
 *
 * Every number in `./data` was recovered frame by frame from a recording and is
 * in that recording's pixels — the 57.45px pitch, the step curve that creeps
 * through the slot and rushes between rows, the moment focus changes hands, the
 * fade with distance, the cursor's glide. The constants below are the same
 * frame's geometry: the scene is laid out at 712 × 402 and scaled by height.
 *
 * The recording is set in SF Pro, which no render farm has. Inter Tight is the
 * nearest face a Remotion bundle can load — fingerprinted on five words against
 * the reference's ink, 2.9% RMS with -0.012em of tracking — and each size below
 * is fitted to the reference's ink height, not to a nominal point size.
 */

const { fontFamily: SANS } = loadFont("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

/* ── The lockup, in reference px ─────────────────────────────────────────── */

/** The slot's middle. Pill borders measured at 177.55 and 215.30. */
const ROW_Y = 196.43;
/** Centre of the whole lockup, lead.s left edge to pill's right (504.6). */
const ROW_X = 360.875;
const PILL_H = 38.75;
/** Border to brand box, and label's box to border, at the widest label. */
const PILL_PAD_L = 6.5;
const PILL_PAD_R = 12.86;
const MARK_H = 28;
const MARK_GAP = 10.73;
const LABEL = 22.8;
const LEAD = 30.65;
const TRACK = "-0.032em";
const LEAD_GAP = 20.05;
/**
 * Baselines, as nudges off flex centring: the lead's ink sits on 206.65 and
 * the label's on 204.9, neither of which is where centring a line box puts it.
 */
const LEAD_NUDGE = 0.31;
const LABEL_NUDGE = 0.75;

/** Rows out of focus. */
const BLUR = 2.4;
const DIM = 0.42;

/* ── Timing, in reference frames at 30fps, relative to the stop ──────────── */

/** The wheel draws in under the approaching cursor. */
const SHRINK = 0.93;
const SHRINK_AT: readonly [number, number] = [-33.6, -9.6];
const CURSOR_IN: readonly [number, number] = [-34.6, -19.6];
/** Click: the cursor presses to 0.9 and lets go. */
const PRESS: readonly [number, number, number, number] = [-2.6, -0.6, 4.4, 7.4];
/** The ring that answers the click: grows to 12.5px and fades out by +17.4. */
const RING_AT = 0.4;
const RING_W = 12.5;
const RING_FADE: readonly [number, number] = [3.4, 17.4];
const RING_ALPHA = 0.06;
/** The line leaves on an ease-in slide, fading over its last five frames. */
const EXIT_AT = 2.4;
const EXIT_FADE: readonly [number, number] = [20.4, 25.4];

type Table = readonly (readonly [number, number])[];

function read(table: Table, v: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) return 0;
  if (v <= first[0]) return first[1];
  if (v >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const hi = table[i];
    const lo = table[i - 1];
    if (hi && lo && v <= hi[0]) {
      return lo[1] + ((hi[1] - lo[1]) * (v - lo[0])) / (hi[0] - lo[0]);
    }
  }
  return last[1];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** The reference frame the strip freezes on, for a reel of `n`. */
export const stopFrame = (n: number) =>
  FIRST_REST + STEP_FRAMES * Math.max(0, n - 2) - STOP_EARLY;

/** Frames at 30fps for a reel of `n`: the roll, the click, the exit. */
export const brandWheelDuration = (n: number) =>
  Math.ceil(stopFrame(n) + EXIT_FADE[1]);

/** Rows travelled at reference frame `f`, for a reel of `n`. */
export function rollAt(f: number, n: number): number {
  if (n < 2) return 0;
  const g = Math.min(f, stopFrame(n));
  if (g < FIRST_REST) return read(FIRST, g);
  const k = (g - FIRST_REST) / STEP_FRAMES;
  const whole = Math.floor(k);
  const u = (k - whole) * STEP_FRAMES;
  const i = Math.floor(u);
  const a = STEP[i] ?? 1;
  const b = STEP[i + 1] ?? 1;
  return Math.min(n - 1, 1 + whole + a + (b - a) * (u - i));
}

/** The row in focus: it changes hands before the midpoint, at `SWAP`. */
export const focusAt = (q: number, n: number) =>
  Math.min(n - 1, Math.floor(q + 1 - SWAP));

/** Interpolates a (t, x, y) track. */
function track(v: number): readonly [number, number] {
  const first = CURSOR[0]!;
  const last = CURSOR[CURSOR.length - 1]!;
  if (v <= first[0]) return [first[1], first[2]];
  for (let i = 1; i < CURSOR.length; i++) {
    const hi = CURSOR[i]!;
    const lo = CURSOR[i - 1]!;
    if (v <= hi[0]) {
      const k = (v - lo[0]) / (hi[0] - lo[0]);
      return [lo[1] + (hi[1] - lo[1]) * k, lo[2] + (hi[2] - lo[2]) * k];
    }
  }
  return [last[1], last[2]];
}

function Mark({
  mark,
  label,
  ink,
  card,
  u,
}: {
  mark?: BrandMark;
  label: string;
  ink: string;
  card: string;
  u: number;
}) {
  const box = {
    width: (mark?.w ?? MARK_H) * u,
    height: MARK_H * u,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;
  if (!mark) {
    // A brand with no mark gets its initial on a disc, so any copy works.
    return (
      <div style={box}>
        <svg width={24 * u} height={24 * u} viewBox="0 0 24 24" aria-hidden>
          <circle cx={12} cy={12} r={12} fill={ink} />
          <text
            x={12}
            y={16.5}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill={card}
          >
            {label.charAt(0).toUpperCase()}
          </text>
        </svg>
      </div>
    );
  }
  const id = `bw-${brandKey(label)}`;
  return (
    <div style={box}>
      <svg
        width={mark.ink[0] * u}
        height={mark.ink[1] * u}
        viewBox={mark.view ?? "0 0 24 24"}
        preserveAspectRatio="none"
        aria-hidden
      >
        {mark.tile ? (
          <>
            <defs>
              <radialGradient id={id} cx="0.3" cy="1.07" r="1.3">
                {mark.tile.map((c, i, all) => (
                  <stop
                    key={c}
                    offset={0.05 + (0.85 * i) / (all.length - 1)}
                    stopColor={c}
                  />
                ))}
              </radialGradient>
            </defs>
            <rect width={24} height={24} rx={5} fill={`url(#${id})`} />
          </>
        ) : null}
        {mark.paths.map((p) => (
          <path
            key={p.d.slice(0, 32)}
            d={p.d}
            transform={p.t}
            fill={p.fill === INK ? ink : p.fill}
          />
        ))}
      </svg>
    </div>
  );
}

export interface BrandWheelProps {
  /** The word that never changes. */
  lead?: string;
  /** The reel, comma separated, top to bottom. It comes to rest on the last. */
  items?: string;
  /** The lead word. Defaults to the theme's primary. */
  accent?: string;
  /** Glide a cursor onto the last pill and click it. */
  cursor?: boolean;
  speed?: number;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  fontFamily?: string;
}

export function BrandWheel({
  lead = "launch on",
  items = "X, YouTube, LinkedIn, Instagram, TikTok, Product Hunt",
  accent,
  cursor = true,
  speed = 1,
  theme,
  mode = "light",
  fontFamily = "Default",
}: BrandWheelProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily) ?? SANS;
  const tint = accent ?? t.primary;

  const reel = items
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const n = reel.length;

  const u = height / REF_H;
  const ox = (width - REF_W * u) / 2;
  const f = (frame * speed * 30) / fps;
  const since = f - stopFrame(n);

  const q = rollAt(f, n);
  const focus = focusAt(q, n);

  const slide = read(ENTER, f) - 0.0212 * Math.max(0, since - EXIT_AT) ** 2.24;
  const gone = 1 - ramp(since, EXIT_FADE[0], EXIT_FADE[1]);
  const shrink = 1 - (1 - SHRINK) * smooth(ramp(since, ...SHRINK_AT));
  const ringW = RING_W * (1 - Math.exp(-Math.max(0, since - RING_AT) / 2.5));
  const ringA =
    since > RING_AT ? RING_ALPHA * (1 - ramp(since, ...RING_FADE)) : 0;

  const wheelIn = ramp(f, -1, 3);

  const [tx, ty] = track(since);
  const press =
    1 -
    0.1 *
      (smooth(ramp(since, PRESS[0], PRESS[1])) -
        smooth(ramp(since, PRESS[2], PRESS[3])));

  // Composite in the Player, re-rasterise in the render — see motion-quality.
  const live = getRemotionEnvironment().isRendering
    ? null
    : ({ willChange: "transform" } as const);

  const pill = (label: string, ring?: string) => (
    <div
      style={{
        boxSizing: "border-box",
        height: PILL_H * u,
        display: "flex",
        alignItems: "center",
        gap: MARK_GAP * u,
        paddingLeft: PILL_PAD_L * u,
        paddingRight: PILL_PAD_R * u,
        borderRadius: t.radius * u,
        border: `${u}px solid ${t.border}`,
        background: t.card,
        boxShadow: ring,
        color: t.cardForeground,
      }}
    >
      <Mark
        mark={BRANDS[brandKey(label)]}
        label={label}
        ink={t.cardForeground}
        card={t.card}
        u={u}
      />
      <span
        style={{
          fontSize: LABEL * u,
          lineHeight: 1,
          fontWeight: 500,
          letterSpacing: TRACK,
          transform: `translateY(${LABEL_NUDGE * u}px)`,
        }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: t.background }}>
      <div
        style={{
          position: "absolute",
          left: ox,
          top: 0,
          width: REF_W * u,
          height: REF_H * u,
          overflow: "hidden",
          fontFamily: face,
          fontWeight: 400,
          textRendering: "geometricPrecision",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: ROW_X * u,
            top: (ROW_Y - PILL_H / 2) * u,
            height: PILL_H * u,
            display: "flex",
            alignItems: "center",
            opacity: gone,
            transform: `translateX(calc(-50% + ${slide * u}px))`,
            ...live,
          }}
        >
          <div
            style={{
              marginRight: LEAD_GAP * u,
              fontSize: LEAD * u,
              lineHeight: 1,
              letterSpacing: "-0.024em",
              color: tint,
              transform: `translateY(${LEAD_NUDGE * u}px)`,
            }}
          >
            {lead}
          </div>
          {/* Every pill in one grid cell: the column is as wide as its widest
              label, so every row is the same pill and any copy fits. */}
          <div
            style={{
              display: "grid",
              height: PILL_H * u,
              opacity: wheelIn,
              transform: `scale(${shrink})`,
            }}
          >
            {reel.map((label, i) => {
              const d = (i - q) * PITCH;
              const vis = read(FADE, Math.abs(d * shrink));
              const sharp = i === focus;
              return (
                <div
                  key={`${i}-${label}`}
                  style={{
                    gridArea: "1 / 1",
                    visibility: vis > 0 ? "visible" : "hidden",
                    transform: `translateY(${d * u}px)`,
                    opacity: vis * (sharp ? 1 : DIM),
                    filter: sharp ? undefined : `blur(${BLUR * u}px)`,
                    ...live,
                  }}
                >
                  {pill(
                    label,
                    i === n - 1 && ringA > 0
                      ? `0 0 0 ${ringW * u}px ${withAlpha(t.foreground, ringA)}`
                      : undefined,
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {cursor && n > 1 ? (
          <div
            style={{
              position: "absolute",
              left: (tx - 1) * u,
              top: (ty - 1) * u,
              opacity: ramp(since, ...CURSOR_IN),
              transform: `scale(${press})`,
              transformOrigin: `${u}px ${u}px`,
            }}
          >
            {/* A macOS arrow, its tip one unit in from the corner. */}
            <svg
              width={13 * u}
              height={21 * u}
              viewBox="-1 -1 13 21"
              aria-hidden
            >
              <path
                d="M0 0V16.2L3.9 12.6L6.6 18.7L9.1 17.6L6.5 11.6H11.6Z"
                fill="#000000"
                stroke="#ffffff"
                strokeWidth={1}
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
