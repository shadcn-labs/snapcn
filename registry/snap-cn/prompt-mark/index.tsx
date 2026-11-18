"use client";

import { loadFont } from "@remotion/google-fonts/Inter";
import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { inputStyleContext } from "@/components/snap-cn/input";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

const { fontFamily: SANS } = loadFont("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

// --- The stage -------------------------------------------------------------
//
// Geometry and timing were read off a 712×402, 30fps screen recording, in its
// own pixels ("ref px"). They are multiplied out to the composition's pixels
// (`u`) before anything is laid out: laying out at ref size and scaling the box
// up lets Chrome round every left/top to a whole *ref* pixel, which is a 1.8px
// jump per frame at 720p. Everything that moves, moves by `transform`.
//
// "World" is the recording's frame 0. The camera only pans (the pill is 187px
// tall on every frame), so a world point lands on screen at `world + cam`.

const REF_W = 712;
const REF_H = 402;
/** Recorded fps: every time below is in recorded frames. */
const REF_FPS = 30;

/**
 * The pan, per recorded frame, measured by registering each frame on the last.
 * The source's one-frame 7.5px hop on the first keystroke is folded into the
 * text's position instead, so the pan starts from rest.
 */
const CAM_X = [
  0, 0, 0, 0, 0, 0, 0, 0, -0.2, -0.8, -1.9, -3.6, -5.7, -8.5, -12, -16, -20.9,
  -26.6, -33.1, -40.4, -49, -58.6, -69.6, -82.1, -96.2, -112.1, -130, -150.3,
  -173.3, -199.4, -229.1, -262.8, -300.9, -343.6, -390.9, -441.8, -494.7,
  -547.3, -597.4, -643.5, -685, -721.8, -754.2, -782.6, -807.7, -829.7, -849.1,
  -866.2, -881.2, -894.5, -906.2, -916.5, -925.6, -933.5, -940.4, -946.4,
  -951.5, -955.7, -959.3, -962.2, -964.4, -966.2, -967.3, -968, -968.2,
];
const CAM_X_END = CAM_X[CAM_X.length - 1];
/** The rise: already moving on frame 0, an exponential settle onto -35. */
const CAM_Y_END = -35;
const camY = (f: number) => CAM_Y_END * (1 - Math.exp(-0.23 * Math.max(0, f)));

/** The input pill, world ref px. Fully round ends. */
const PILL = { x: 142, y: 142, w: 1273, h: 187 };
/** The prompt line: Inter 500 at 127px, its line box's top at y 171. */
const TEXT = { x: 198.9, top: 171, size: 127, tracking: 3 };
/** The caret: a 9px bar from y 180 to 307, 9px past the last glyph. */
const CARET = { w: 9, top: 180, h: 127, gap: 9 };
/** The send button: a 168px disc, 11px inside the pill's right end. */
const SEND = { cx: 1320.2, cy: 239, d: 168 };
/** It shrinks to an 88px badge, whose mark then carries the lockup. */
const BADGE = 88;
/**
 * The lockup's proportions, as a wordmark would set them. The name is
 * lowercase, so the mark is sized and centred on its x-height (Inter: 0.546em,
 * centred 0.091em below the line box's middle at line-height 1), not its em
 * box: the mark stands as tall as a capital (1.33 x-heights), the gap is 0.24em.
 */
const WORD = { size: 64, gap: 0.24, xHeight: 0.546, xDrop: 0.091 };
const MARK_H = 1.33 * WORD.xHeight * WORD.size;
const MARK_W = (MARK_H * 464) / 409;

/** The recording's 11 keystrokes; anything longer keeps typing at 3 frames a key. */
const KEYS = [3, 6, 9, 13, 16, 19, 22, 26, 29, 32, 35];
const keyAt = (i: number) =>
  i < KEYS.length ? KEYS[i] : KEYS[KEYS.length - 1] + 3 * (i - KEYS.length + 1);

/** A moderate decelerate: arrives at rest without spending frames on nothing. */
const SETTLE = Easing.bezier(0.2, 0.6, 0.35, 1);
const IN_OUT = Easing.bezier(0.45, 0, 0.25, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Linear lookup into a per-frame table, holding its ends. */
function table(t: readonly number[], f: number): number {
  if (f <= 0) return t[0];
  if (f >= t.length - 1) return t[t.length - 1];
  const lo = Math.floor(f);
  return t[lo] + (t[lo + 1] - t[lo]) * (f - lo);
}

/** The snapcn mark — a lens body and its shutter wedge. */
function Mark({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={(size * 409) / 464}
      viewBox="0 0 464 409"
      aria-hidden
      style={{ display: "block" }}
    >
      <g transform="translate(0,409) scale(0.1,-0.1)" fill={fill}>
        <path d="M589 3805 c-167 -41 -305 -149 -380 -297 -60 -120 -59 -84 -59 -1239 0 -1004 1 -1059 19 -1112 48 -147 148 -226 331 -262 100 -20 127 -33 186 -87 53 -49 74 -109 74 -212 1 -121 42 -196 133 -244 l52 -27 980 -3 c883 -3 986 -1 1042 13 75 21 133 67 171 139 l27 51 3 315 c2 173 2 342 0 374 l-3 60 -31 -50 c-36 -59 -101 -115 -170 -146 l-49 -23 -810 -3 c-591 -2 -825 0 -865 8 -128 28 -258 121 -325 234 -65 110 -66 128 -63 826 l3 625 24 58 c44 111 147 210 270 259 l56 23 830 3 c809 2 831 2 895 -18 80 -25 149 -74 198 -142 l37 -52 3 334 c3 367 -3 418 -56 494 -30 44 -98 91 -152 106 -22 6 -457 10 -1175 9 -923 -1 -1151 -3 -1196 -14z M3800 2983 c-327 -196 -598 -361 -602 -367 -4 -6 -7 -254 -5 -550 l2 -540 145 -91 c80 -50 208 -130 285 -177 77 -47 283 -174 457 -282 174 -108 326 -196 337 -196 11 0 27 7 35 16 14 14 16 141 16 1254 0 781 -4 1248 -10 1264 -7 20 -16 26 -37 26 -18 -1 -232 -123 -623 -357z" />
      </g>
    </svg>
  );
}

interface DiscLook {
  /** Drawn at this size in px, then scaled by `scale` — never resized. */
  size: number;
  scale: number;
  fill: string;
  accent: string;
  arrow: number;
  mark: number;
  glow: number;
  ring: string;
}

/**
 * The send button and, later, the badge. One drawing, so the hand-off from the
 * camera's world to the lockup is pixel-identical.
 */
function Disc({
  size,
  scale,
  fill,
  accent,
  arrow,
  mark,
  glow,
  ring,
}: DiscLook) {
  return (
    <div
      style={{
        position: "absolute",
        left: -size / 2,
        top: -size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: fill,
        boxShadow: `inset 0 0 0 ${size * 0.012}px ${ring}`,
        overflow: "hidden",
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: glow,
          background: `radial-gradient(75% 60% at 50% 100%, ${withAlpha(accent, 0.55)} 0%, ${withAlpha(accent, 0.18)} 50%, ${withAlpha(accent, 0)} 100%)`,
        }}
      />
      {/* Send: the round-capped lucide up-arrow, drawn at disc scale. */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: arrow,
          transform: `scale(${0.5 + 0.06 * arrow})`,
        }}
      >
        <g
          fill="none"
          stroke={accent}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5" />
          <path d="M5.5 11.5L12 5l6.5 6.5" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: mark,
          transform: `scale(${0.88 + 0.12 * mark})`,
        }}
      >
        <Mark size={size * 0.5} fill={accent} />
      </div>
    </div>
  );
}

export interface PromptMarkProps {
  /** What gets typed into the prompt. About 11 characters fits the pan. */
  text?: string;
  /** The name in the closing lockup. */
  name?: string;
  theme?: Partial<SnapCnTheme>;
  /** The scene opens in this mode and flashes into the other. */
  mode?: "light" | "dark";
  fontFamily?: string;
}

/**
 * A prompt types into a pill while the camera rides the caret, pans onto the
 * send button, the arrow becomes the mark, the room flashes into the other mode
 * inside an accent bloom, and the badge settles into a logo lockup.
 */
export function PromptMark({
  text = "Ship a demo",
  name = "snapcn",
  theme,
  mode = "dark",
  fontFamily = "Default",
}: PromptMarkProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const f = (frame * REF_FPS) / fps;
  const t = useSnapCnTheme(theme, mode);
  const ui = inputStyleContext(t);
  const face = resolveFont(fontFamily) ?? SANS;
  const rendering = getRemotionEnvironment().isRendering;

  // The composition's px per ref px, and the stage's offset inside the frame.
  const u = Math.max(width / REF_W, height / REF_H);
  const ox = (width - REF_W * u) / 2;
  const oy = (height - REF_H * u) / 2;
  const camX = table(CAM_X, f);
  const cy = camY(f);
  const at = (wx: number, wy: number) => [
    (wx + camX) * u + ox,
    (wy + cy) * u + oy,
  ];

  // --- palette: the mode it opens in, and the one the flash lands in ------
  const accent = t.primary;
  const endPage = t.foreground;
  const endInk = t.background;
  const glowColor = mixOklch(t.background, accent, 0.42);

  // --- typing --------------------------------------------------------------
  const chars = Array.from(text);
  const typed = chars.filter((_, i) => f >= keyAt(i)).length;
  const lastKey = typed ? keyAt(typed - 1) : 0;
  const doneAt = keyAt(Math.max(0, chars.length - 1));
  const cool = (k: number) => interpolate(f - k, [0, 2], [0, 1], clamp);
  const caretOn = f < doneAt + 1 || Math.floor(f - lastKey) % 16 < 7;
  const pillOpacity = interpolate(f, [55, 60], [1, 0], clamp);

  // --- send → mark → badge -------------------------------------------------
  const flash = interpolate(f, [107, 118], [0, 1], clamp);
  const look: DiscLook = {
    size: SEND.d * u,
    scale: interpolate(f, [93, 116], [1, BADGE / SEND.d], {
      ...clamp,
      easing: IN_OUT,
    }),
    fill: t.foreground,
    accent,
    arrow: interpolate(f, [66, 73], [1, 0], clamp),
    mark: interpolate(f, [72, 90], [0, 1], { ...clamp, easing: SETTLE }),
    glow:
      interpolate(f, [74, 93], [0, 1], clamp) *
      interpolate(f, [100, 116], [1, 0], clamp),
    // On the flashed page the badge is page-coloured, so a hairline draws it.
    ring: withAlpha(mixOklch(endPage, endInk, 0.14), flash),
  };

  // The cursor rises from below the frame and settles under the button.
  const cursorRise = interpolate(f, [36, 64], [0, 1], {
    ...clamp,
    easing: SETTLE,
  });
  const cursorOpacity = interpolate(f, [80, 96], [1, 0], clamp);

  // --- the flash: the room lifts into the other mode inside an accent bloom
  const bloomGrow = interpolate(f, [107, 118], [0.25, 1], {
    ...clamp,
    easing: SETTLE,
  });
  const bloomOut = interpolate(f, [118, 136], [0, 1], clamp);
  const bloomOpacity =
    interpolate(f, [107, 110], [0, 1], clamp) * (1 - bloomOut);

  // --- the lockup ----------------------------------------------------------
  const p = interpolate(f, [118, 142], [0, 1], { ...clamp, easing: IN_OUT });
  const word = interpolate(f, [128, 150], [0, 1], {
    ...clamp,
    easing: SETTLE,
  });
  const inLockup = f >= 118;

  const [sx, sy] = at(SEND.cx, SEND.cy);
  // Where the camera leaves the badge; the lockup starts from exactly here.
  const restX = (SEND.cx + CAM_X_END) * u + ox;
  const restY = (SEND.cy + CAM_Y_END) * u + oy;
  const badgePx = BADGE * u;
  const markPx = MARK_W * u;
  // The badge's mark, as drawn on the disc, is half the badge wide; it grows
  // from exactly that into the lockup's mark while the disc fades out.
  const markScale = interpolate(p, [0, 1], [(0.5 * BADGE) / MARK_W, 1]);
  const discFade = interpolate(p, [0, 0.55], [1, 0], clamp);

  // The prompt line. Chrome rounds a glyph's vertical origin to a whole device
  // pixel, so a line riding the camera's rise would climb in 1px steps. Two
  // copies a pixel apart, cross-faded and summed (plus-lighter), put it exactly
  // where it belongs instead.
  const lineX = (TEXT.x + camX) * u + ox;
  const lineY = (TEXT.top + cy) * u + oy;
  const y0 = Math.floor(lineY);
  const frac = lineY - y0;
  const line: ReactNode = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        height: TEXT.size * u,
        lineHeight: `${TEXT.size * u}px`,
        fontFamily: face,
        fontSize: TEXT.size * u,
        fontWeight: 500,
        letterSpacing: TEXT.tracking * u,
        whiteSpace: "pre",
        textRendering: "geometricPrecision",
      }}
    >
      {chars.slice(0, typed).map((ch, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed string
          key={i}
          style={{ color: mixOklch(accent, ui.foreground, cool(keyAt(i))) }}
        >
          {ch}
        </span>
      ))}
      <span
        style={{
          display: "inline-block",
          width: CARET.w * u,
          height: CARET.h * u,
          marginLeft: (typed ? CARET.gap : CARET.gap + 9.5) * u,
          marginTop: (CARET.top - TEXT.top) * u,
          borderRadius: u,
          background: typed
            ? mixOklch(accent, ui.foreground, cool(lastKey))
            : accent,
          opacity: caretOn ? 1 : 0,
        }}
      />
    </div>
  );
  const [px, py] = at(PILL.x, PILL.y);

  return (
    <AbsoluteFill style={{ background: t.background, overflow: "hidden" }}>
      {/* The room: fixed to the screen, lit in the accent from the top-right. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(130% 95% at 100% 0%, ${glowColor} 0%, ${withAlpha(glowColor, 0.45)} 22%, ${withAlpha(glowColor, 0.12)} 48%, ${withAlpha(glowColor, 0)} 78%)`,
        }}
      />

      {pillOpacity > 0 ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: PILL.w * u,
              height: PILL.h * u,
              borderRadius: (PILL.h * u) / 2,
              background: mixOklch(ui.background, t.card, 0.8),
              boxShadow: `inset 0 0 0 ${Math.max(1, u)}px ${mixOklch(ui.idleBorder, ui.foreground, 0.12)}`,
              transform: `translate(${px}px, ${py}px)`,
              opacity: pillOpacity,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              isolation: "isolate",
              opacity: pillOpacity,
            }}
          >
            {[0, 1].map((k) => (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  transform: `translate(${lineX}px, ${y0 + k}px)`,
                  opacity: k ? frac : 1 - frac,
                  mixBlendMode: "plus-lighter",
                  willChange: rendering ? undefined : "transform",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* The flash and its bloom. */}
      <AbsoluteFill style={{ background: endPage, opacity: flash }} />
      {bloomOpacity > 0 ? (
        <div
          style={{
            position: "absolute",
            left: -250 * u,
            top: -270 * u,
            width: 500 * u,
            height: 540 * u,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${mixOklch(accent, t.primaryForeground, 0.12)} 0%, ${accent} 50%, ${withAlpha(accent, 0)} 100%)`,
            filter: `blur(${24 * u}px)`,
            opacity: bloomOpacity,
            transform: `translate(${restX}px, ${restY}px) scale(${bloomGrow * (1 + 0.12 * bloomOut)})`,
          }}
        />
      ) : null}

      {!inLockup ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${sx}px, ${sy}px)`,
          }}
        >
          <Disc {...look} />
        </div>
      ) : null}

      {f >= 36 && cursorOpacity > 0 ? (
        <svg
          width={26 * u}
          height={42 * u}
          viewBox="-1 -1 13 21"
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            opacity: cursorOpacity,
            transform: `translate(${sx + 29 * u}px, ${sy + (198 - 145 * cursorRise) * u}px)`,
          }}
        >
          <path
            d="M0 0V16.2L3.9 12.6L6.6 18.7L9.1 17.6L6.5 11.6H11.6Z"
            fill="#000000"
            stroke="#ffffff"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </svg>
      ) : null}

      {/* The lockup: the badge slides over and the name follows it out. */}
      {inLockup ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height: badgePx,
            display: "flex",
            justifyContent: "center",
            // A transform, not `top`: a fractional top would be rounded and
            // the badge would hop on the frame it changes hands.
            transform: `translateY(${restY - badgePx / 2}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: badgePx,
              // Percent is of this row: shifting by half of it less half the
              // badge parks the badge on the frame's centre without measuring
              // the name; the last term starts it where the camera left it.
              transform: `translateX(calc(${(1 - p) * 50}% - ${((1 - p) * markPx) / 2}px + ${(1 - p) * (restX - width / 2)}px))`,
            }}
          >
            <div
              style={{
                position: "relative",
                width: markPx,
                height: badgePx,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {discFade > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    left: markPx / 2,
                    top: badgePx / 2,
                    opacity: discFade,
                  }}
                >
                  <Disc {...look} mark={0} />
                </div>
              ) : null}
              <div style={{ transform: `scale(${markScale})` }}>
                <Mark size={markPx} fill={accent} />
              </div>
            </div>
            <span
              style={{
                marginLeft: WORD.gap * WORD.size * u,
                fontFamily: face,
                fontSize: WORD.size * u,
                fontWeight: 600,
                letterSpacing: -0.025 * WORD.size * u,
                lineHeight: 1,
                color: endInk,
                whiteSpace: "pre",
                textRendering: "geometricPrecision",
                opacity: word,
                // Lift the x-height's centre onto the mark's centre (static).
                transform: `translate(${18 * u * (1 - word)}px, ${-WORD.xDrop * WORD.size * u}px)`,
              }}
            >
              {name}
            </span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
