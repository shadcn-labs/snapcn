import {
  clampChroma,
  converter,
  formatRgb,
  interpolate,
  type Oklch,
  parse,
  type Rgb,
} from "culori";

const toRgb = converter("rgb");
const toOklch = converter("oklch");

const BLACK: Rgb = { mode: "rgb", r: 0, g: 0, b: 0, alpha: 1 };

/**
 * Whether to warn. Read through `globalThis`, never a bare `process`: a Vite
 * project defines no `process`, so the bare name threw a ReferenceError on the
 * very input it meant to warn about — and a stock Remotion project has no Node
 * types, so the bare name was also a type error in every install.
 */
function isDev(): boolean {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
    .process?.env;
  return env?.NODE_ENV !== "production";
}

export function parseColor(c: string): Rgb {
  const s = c.trim();

  if (s.startsWith("var(")) {
    if (isDev()) {
      console.warn(
        `[snap-cn-ui] parseColor cannot resolve CSS variable "${s}" under Remotion's per-frame render. ` +
          "Animated colors must be concrete oklch/hex/rgb values supplied via the theme. " +
          "Falling back to the JS default.",
      );
    }
    return { ...BLACK };
  }

  const rgb = toRgb(parse(s));
  if (!rgb) {
    if (isDev()) {
      console.warn(
        `[snap-cn-ui] parseColor could not parse "${s}"; using black.`,
      );
    }
    return { ...BLACK };
  }

  return { mode: "rgb", r: rgb.r, g: rgb.g, b: rgb.b, alpha: rgb.alpha ?? 1 };
}

export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const mapped = clampChroma({ mode: "oklch", l, c, h }, "oklch", "rgb");
  return toRgb(mapped);
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const { l, c, h } = toOklch(rgb);
  return { mode: "oklch", l, c, h: Number.isFinite(h) ? h : 0 };
}

function resolveColorString(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("var(")) {
    if (isDev()) {
      console.warn(
        `[snap-cn-ui] mixOklch cannot resolve CSS variable "${trimmed}" under Remotion's per-frame render. ` +
          "Animated colors must be concrete oklch/hex/rgb values supplied via the theme. " +
          "Falling back to the JS default.",
      );
    }
    return "#000";
  }
  if (!parse(trimmed)) {
    if (isDev()) {
      console.warn(
        `[snap-cn-ui] mixOklch could not parse "${trimmed}"; using black.`,
      );
    }
    return "#000";
  }
  return trimmed;
}

// A near-gray still carries a hue (#faf9f6 is h≈91), and oklch interpolation
// sweeps it toward the other colour's hue: off-white → blue passed through
// green (#82d6af at 0.42). Grays have no real hue, so drop it and let culori
// borrow the other end's.
function hueless(color: string): Oklch {
  const o = toOklch(resolveColorString(color)) as Oklch;
  return o.c < 0.02 ? { ...o, h: undefined } : o;
}

export function mixOklch(a: string, b: string, t: number): string {
  const mixed = clampChroma(
    interpolate([hueless(a), hueless(b)], "oklch")(t),
    "oklch",
    "rgb",
  );
  return toCss(toRgb(mixed));
}

export function toCss(color: Rgb): string {
  return formatRgb(color);
}

/**
 * A token at partial opacity — for scrims, veils and inner washes.
 *
 * A scrim written as a literal `rgba(0,0,0,0.4)` is lit for a light surface and
 * does nothing on a dark one; `withAlpha(t.foreground, 0.4)` follows the theme
 * and a user's override. Resolves through `parseColor`, so it inherits the same
 * `var()` guard — an unresolvable token degrades to black rather than an
 * invalid colour string mid-render.
 */
export function withAlpha(color: string, alpha: number): string {
  const { r, g, b } = parseColor(color);
  return formatRgb({ mode: "rgb", r, g, b, alpha });
}
