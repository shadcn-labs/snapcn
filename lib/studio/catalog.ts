/**
 * The components the studio's AI may place, and how they're described to it.
 *
 * Exactly the editor library's set — free gallery items that have a config — so
 * the AI can never put something on the timeline a person could not have added
 * by hand, and a Pro item (which has no registry entry to render) never appears.
 */

import type { ControlConfig, ControlType } from "@/lib/customizer-config";
import { GALLERY_ITEMS, slugFromHref } from "@/lib/gallery-data";
import { isHexColor } from "@/lib/video-editor/types";
import { CONFIGS } from "@/registry/__configs__";
import type { CatalogEntry, Lookup, TextLimit } from "./ops";
import { SCENES, showsImageWhole } from "./scene-data";

/**
 * Free items the studio does NOT offer, because what they put on screen is
 * snapcn's, not the user's, and no prop changes that. A launch video for
 * someone else's product that ends on the snapcn mark is a broken video.
 */
const STUDIO_EXCLUDE = new Set([
  // The snapcn logo is drawn in, with no prop to swap it (its construction
  // lines are drawn from the mark's own paths).
  "cut-lockup",
  "prompt-mark",
  // On-screen copy is fixed demo text — nothing for the user's product to say.
  "follower-rush",
  "reel-wall",
  // Wraps children; on its own it is a cursor over nothing.
  "cursor-track",
]);

/**
 * Text props whose default is demo copy that must never ship in someone
 * else's video ("npm install One Tool"). The model is told to replace them
 * and the reviewer flags any left at the default.
 */
export const MUST_REPLACE: Record<string, string[]> = {
  "terminal-simulator": ["command", "lines"],
  "drop-line": ["words"],
  "title-sweep": ["titles"],
  "count-grid": ["from", "to", "noun"],
  "spec-sweep": ["lead", "highlight", "connector", "tail"],
};

/**
 * Defaults the studio changes. The registry's default is a demo of snapcn —
 * right in the docs, wrong in a stranger's video. An empty symbol is drawn as
 * no symbol, so the title stands on its own.
 */
const DEFAULT_OVERRIDES: Record<string, Record<string, unknown>> = {
  "announce-title": { symbolPath: "" },
  // Neutral themed cards, not snapcn's demo posters, unless images are given.
  "count-grid": { cards: "" },
};

/**
 * Most characters a text prop can carry before the type leaves the frame or
 * wraps into itself. Measured 2026-11-27 on rendered frames through the
 * studio's own timeline (Geist, 4% safe margin, every 2nd frame), then taken
 * ~10% lower because wider faces hold fewer characters. `each` is a limit per
 * item of a comma list. Components that shrink to fit on their own
 * (punch-lines, announce-title) need no entry; one with no entry was not
 * measured, and the director is still told to keep display copy short.
 */
export const TEXT_LIMITS: Record<string, Record<string, TextLimit>> = {
  "text-reveal": { text: 28 },
  "text-swap": { fromText: 30, toText: 30 },
  "word-flip": { prefix: 12, suffix: 9 },
  "type-morph": { emphasis: 15, morphTo: 21, finally_: 23 },
  "check-cycle": { headline: 24, words: { each: 24 } },
  "text-build": { text: 28 },
  "hero-launch": { heading: 52 },
  // A fixed-width button: past this the label is cut inside it.
  "button-press": { label: 14, pending: 12, done: 12 },
  // Estimated from the Panelo QA render, not bisected: 43 chars ran off both
  // edges; a sentence of 41 wrapped one word onto a line of its own; a 63-char
  // tagline fit but read at 22px.
  "text-swell": { text: 28 },
  "text-highlight": { "before+highlight+after": 34 },
  "announce-title": { tagline: 48 },
  // Estimated from the Panelo render: a 65-char sentence collided with itself;
  // it is designed around one line of ~28.
  "word-gather": { text: 34 },
};

/**
 * Components whose natural length follows their copy. A board that keeps the
 * config's length for a two-card script ends on 1.6s of empty frame.
 */
export const NATURAL_FRAMES: Record<
  string,
  (props: Record<string, unknown>) => number
> = {
  // Same arithmetic as `punchLinesDuration()` — a test holds them together
  // (the component module is a client module the route can't import).
  "punch-lines": (props) => {
    const cards = String(props.script ?? "")
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean).length;
    const holds = String(props.holds ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    let total = 0;
    for (let i = 0; i < cards; i++) {
      total += Math.max(1, holds[Math.min(i, holds.length - 1)] ?? 48);
    }
    return total;
  },
  // `TITLE_FRAMES` (36) per title, the last held 4 longer — as title-sweep.
  "title-sweep": (props) => {
    const n = String(props.titles ?? "")
      .split("|")
      .filter((t) => t.trim()).length;
    return n <= 1 ? 36 : 36 * (n - 1) + 40;
  },
  // drop-line's `timeline(n).end`: first card 9, each middle 7, last 15.
  "drop-line": (props) => {
    const n = String(props.words ?? "")
      .split(",")
      .filter((w) => w.trim()).length;
    return 9 + Math.max(0, n - 2) * 7 + 15;
  },
};

function controlsFor(slug: string): ControlConfig {
  const controls = CONFIGS[slug].controls;
  const overrides = DEFAULT_OVERRIDES[slug];
  if (!overrides) return controls;
  return Object.fromEntries(
    Object.entries(controls).map(([key, c]) =>
      key in overrides
        ? [key, { ...c, default: overrides[key] } as ControlType]
        : [key, c],
    ),
  );
}

const ITEMS = GALLERY_ITEMS.filter((it) => !it.pro)
  .map((it) => ({ ...it, slug: slugFromHref(it.href) }))
  .filter((it) => Boolean(CONFIGS[it.slug]) && !STUDIO_EXCLUDE.has(it.slug));

const ENTRIES = new Map<string, CatalogEntry>(
  ITEMS.map((it) => {
    const config = CONFIGS[it.slug];
    const backdrop = config.previewBackdrop;
    return [
      it.slug,
      {
        controls: controlsFor(it.slug),
        limits: TEXT_LIMITS[it.slug],
        durationInFrames: config.durationInFrames,
        backdrop:
          backdrop?.type === "color" && isHexColor(backdrop.value)
            ? backdrop.value
            : undefined,
      },
    ];
  }),
);

export const lookup: Lookup = (slug) => ENTRIES.get(slug);

/** One control as the model reads it: `key (type …) = default`. */
function describeControl(
  key: string,
  c: ControlType,
  limit?: TextLimit,
  mustReplace = false,
): string {
  switch (c.type) {
    case "text": {
      const cap =
        typeof limit === "number"
          ? `, max ${limit} chars`
          : limit
            ? `, max ${limit.each} chars per item`
            : "";
      // Demo copy about snapcn is a placeholder to replace, not a suggestion.
      const shown =
        /snapcn/i.test(c.default) || mustReplace
          ? "(snapcn demo copy — replace)"
          : JSON.stringify(c.default.slice(0, 60));
      // The label is where a format lives ("Script (| card, / line)"); without
      // it the model writes newlines into a prop that splits on pipes.
      const label =
        c.label && c.label.toLowerCase() !== key.toLowerCase()
          ? ` "${c.label}"`
          : "";
      return `${key} (text${label}${cap}) = ${shown}`;
    }
    case "image":
      return `${key} (image https URL${c.label ? `, "${c.label}"` : ""})`;
    case "number":
    case "number-input":
      return `${key} (number ${c.min}–${c.max}) = ${c.default}`;
    case "color":
      return `${key} (hex colour) = ${c.default}`;
    case "select":
      return `${key} (one of ${c.options.join("|")}) = ${c.default}`;
    case "boolean":
      return `${key} (boolean) = ${c.default}`;
  }
}

/**
 * The catalog as prompt text. Built once per process: it only changes on
 * deploy, and a stable string is what lets the provider cache the prefix.
 */
/**
 * A component's props as the model reads them: non-colour controls in full,
 * colour keys by name only (colour is the studio's job — `look.ts`). Shared by
 * the free catalog below and the Pro catalog (`pro-catalog.ts`).
 */
export function describeControls(slug: string, all: ControlConfig): string {
  const limits = TEXT_LIMITS[slug] ?? {};
  const entries = Object.entries(all);
  const controls = entries
    .filter(([, c]) => c.type !== "color")
    .map(([key, c]) =>
      describeControl(key, c, limits[key], MUST_REPLACE[slug]?.includes(key)),
    )
    .join("; ");
  const colours = entries.filter(([, c]) => c.type === "color").map(([k]) => k);
  return `${controls}${colours.length ? `\n  colours (studio-managed; set only when the user asks for a colour): ${colours.join(", ")}` : ""}`;
}

export const CATALOG_PROMPT = ITEMS.map((it) => {
  const config = CONFIGS[it.slug];
  const limits = TEXT_LIMITS[it.slug] ?? {};
  const all = Object.entries(controlsFor(it.slug));
  // Colour is the studio's job (one measured look per video — `look.ts`), so
  // the model sees the colour keys only as names it may set on request.
  const controls = all
    .filter(([, c]) => c.type !== "color")
    .map(([key, c]) =>
      describeControl(
        key,
        c,
        limits[key],
        MUST_REPLACE[it.slug]?.includes(key),
      ),
    )
    .join("; ");
  const colours = all.filter(([, c]) => c.type === "color").map(([k]) => k);
  const secs = (config.durationInFrames / config.fps).toFixed(1);
  const scene = SCENES[it.slug];
  const modes =
    scene && !scene.dark
      ? ", light only"
      : scene && !scene.light
        ? ", dark only"
        : "";
  const hasImage = all.some(([, c]) => c.type === "image");
  const image = !hasImage
    ? ""
    : showsImageWhole(it.slug) || it.slug === "laptop-frame"
      ? ", shows a wide screenshot whole"
      : ", crops wide screenshots";
  return `- ${it.slug} — ${it.name} [${it.category}, ${secs}s${modes}${image}]: ${it.description}\n  props: ${controls}${colours.length ? `\n  colours (studio-managed; set only when the user asks for a colour): ${colours.join(", ")}` : ""}`;
}).join("\n");
