import { converter, formatHex, parse } from "culori";
import type { Mode } from "./scene-data";

/**
 * A site's theme, read off its own CSS — never guessed.
 *
 * The first studio guessed "dark" for paneloui.com, a light site, and every
 * scene came out wrong. A shadcn/Tailwind site declares its palette as tokens:
 * `:root { --background; --primary; … }`, with a `.dark { … }` block that only
 * applies when `<html class="dark">`. So the default theme is whatever `:root`
 * says unless the html element opts into dark, and the accent is `--primary`
 * when it has colour (a near-black primary is shadcn's default, not a brand).
 *
 * Pure: takes the html and the stylesheet text, returns what it found. A site
 * that declares nothing yields nulls, and the studio falls back to light.
 */

const toOklch = converter("oklch");
const toRgb = converter("rgb");

export interface SiteTheme {
  mode: Mode | null;
  /** Brand accent hex, when the site's primary/ring/chart colour has chroma. */
  accent: string | null;
  background: string | null;
  /** Font families the page loads, most prominent first ("Inter", "Geist"). */
  fonts: string[];
}

/** The value of `--name` in the first `selector { … }` block that sets it. */
function token(css: string, selector: RegExp, name: string): string | null {
  const block = new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(block)) {
    // A declaration may repeat with a fallback first (`#f9fafb` then `lab()`);
    // the first is what every browser parses.
    const v = m[1].match(new RegExp(`--${name}\\s*:\\s*([^;]+)`));
    if (v) return v[1].trim();
  }
  return null;
}

function hexOf(value: string | null): string | null {
  if (!value) return null;
  // Bare shadcn v3 triplets: "222.2 84% 4.9%" mean hsl().
  const v = /^[\d.]+\s+[\d.]+%\s+[\d.]+%$/.test(value)
    ? `hsl(${value})`
    : value;
  const c = parse(v);
  return c ? formatHex(toRgb(c)) : null;
}

function luminance(hex: string): number {
  const c = toOklch(parse(hex));
  return c?.l ?? 0.5;
}

function chroma(hex: string): number {
  const c = toOklch(parse(hex));
  return c?.c ?? 0;
}

const ROOT = /(?:^|[}\s,]):root(?![\w-])/;
const FONT_CLASS = /\b([a-z]+(?:_[a-z]+)*)_[0-9a-f]{6,}-module__/g;

export function readSiteTheme(html: string, css: string): SiteTheme {
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  const htmlDark =
    /\bclass\s*=\s*["'][^"']*\bdark\b/i.test(htmlTag) ||
    /\bdata-theme\s*=\s*["']dark["']/i.test(htmlTag) ||
    /<meta[^>]+name=["']color-scheme["'][^>]+content=["']dark["']/i.test(html);
  const scope = htmlDark ? /\.dark/ : ROOT;

  const background =
    hexOf(token(css, scope, "background")) ??
    (htmlDark ? null : hexOf(token(css, ROOT, "background")));
  const mode: Mode | null = htmlDark
    ? "dark"
    : background
      ? luminance(background) < 0.5
        ? "dark"
        : "light"
      : null;

  let accent: string | null = null;
  for (const name of ["primary", "ring", "brand", "accent", "chart-1"]) {
    const hex = hexOf(token(css, scope, name) ?? token(css, ROOT, name));
    if (hex && chroma(hex) > 0.06) {
      accent = hex;
      break;
    }
  }

  // next/font stamps each family into a class name: "inter_9cfd2fd2-module__…".
  const fonts: string[] = [];
  for (const m of htmlTag.matchAll(FONT_CLASS)) {
    const family = m[1]
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
    if (!/mono/i.test(family) && !fonts.includes(family)) fonts.push(family);
  }
  return { mode, accent, background, fonts };
}
