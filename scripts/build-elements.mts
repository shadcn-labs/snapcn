import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createElementPayload,
  type ElementDependency,
  staticFileRef,
} from "@remotion/studio-protocol";
import type { ControlType } from "../lib/customizer-config.ts";
import { loadConfigs } from "./lib/configs.mts";
import {
  elementSource,
  packageName,
  type RegistryFile,
} from "./lib/element-source.mts";
import {
  adoptDefaults,
  dropUnused,
  elementDefaults,
  hideLayers,
  isStatic,
  itemStarter,
  type StaticAsset,
  type Studio,
  sceneProps,
  slotKeys,
  staticAssets,
  studioItemsWrapper,
  studioWrapper,
  TAIL,
} from "./lib/element-wrapper.mts";

/**
 * Every component with a page, as a Remotion Studio Element:
 * `public/elements/<name>.json`, which the "Add to Remotion Studio" button sends
 * to a running Studio over the Studio Protocol. Plus the list of names,
 * `lib/studio-elements.json`, so a page knows whether to offer the button
 * without fetching anything.
 *
 * Built from `public/r/` after `split-pro`, so an Element can only ever be
 * source that is already public — a Pro component has left that directory by
 * the time this runs.
 *
 * Run: part of `pnpm run registry:build`, or `node scripts/build-elements.mts`.
 */

const root = process.cwd();
const PUBLIC_R = path.join(root, "public", "r");
const OUT = path.join(root, "public", "elements");
const SITE = "https://snapcn.dev";
/**
 * Neutral starter content. An Element is copied into somebody else's project,
 * so it may not arrive wearing snapcn: the guidelines ask for no project
 * branding or footage. A placeholder mark and generic photos — declared as the
 * payload's `assets`, so Studio copies them into the project's `public/` at
 * install and the Element plays them from there, under a folder named for it,
 * instead of reaching back to this site.
 */
const asset = (slug: string, file: string, from: string): StaticAsset => ({
  staticFile: `${slug}/${file}`,
  url: `${SITE}${from}`,
});
const MARK = (slug: string) => asset(slug, "logo.png", "/logo/dummy-logo.png");
const PHOTO_FILES = [
  "438b9e6b50654a44d404fbf358c26e9f.webp",
  "5e5305b05bd405a0d89570725434099e.webp",
  "767d99bb371a54d0d36751e8cecae43c.jpg",
  "821d815affa6496c39cbdeeec7a84603.jpg",
  "937438c560ada1c83317f2c11b3454b0.jpg",
  "98f89cb9994f5c382ab964062c4039db.jpg",
  "b25b82db2892efff9be3204e860d30ee.jpg",
  "c9ebc6337aa2268ac4b357f9cb1ac547.jpg",
];
/** The eight photos, as `<slug>/photo-1.webp` … in the project. */
const PHOTOS = (slug: string) =>
  PHOTO_FILES.map((f, i) =>
    asset(slug, `photo-${i + 1}${path.extname(f)}`, `/showcase-assets/${f}`),
  );
/** A face from the site's avatars, as `<slug>/avatar-NN.jpg` in the project. */
const AVATAR = (slug: string, n: number) => {
  const nn = String(n).padStart(2, "0");
  return asset(slug, `avatar-${nn}.jpg`, `/avatars/${nn}.jpg`);
};
/**
 * A recording to start a screen with. Remotion's own test footage on
 * remotion.media, left remote: at 2 MB it is a download per install for a clip
 * the user replaces first thing.
 */
const FOOTAGE = "https://remotion.media/video.mp4";
/**
 * follower-rush's own crowd, with its photos as assets. The component points at
 * `/avatars/NN.jpg`, which exists on this site and 404s everywhere else — it
 * falls back to monograms, so it never breaks, it just loses every face.
 */
const FOLLOWERS =
  "Manon Melon Victor Shane Lisa Natasha Annie Abdull Kratos Jhone Matt Huggy Felomi Hazar Mikasa Silmon Luciano Nova Priya Theo Amelia Rafael Sofia Kai Jordan Nora Dana Milo Yuki Bruno Elena Omar Ivy Leo Zara Finn Maya Cole"
    .split(" ")
    .map((name, i) => ({
      name,
      avatar: AVATAR("follower-rush", (i % 24) + 1),
    }));
/** logo-drift's measured field — positions, sizes, drifts, entries, paint — renamed. */
const DRIFT_TILES = [
  ["Ma", "Mail", "#1f2430", "#ffffff", 163, 232, -54, 12, 109, 0.28],
  ["Dc", "Docs", "#f2f4f7", "#16181d", 128, -209, 81, 32, 122, 0.48],
  ["Ch", "Chat", "#10131a", "#7dd3fc", -384, 344, -27, -68, 200, 0.95],
  ["Ca", "Calendar", "#e7e8ea", "#16181d", 519, 45, -31, 64, 144, 1.51],
  ["Pa", "Payments", "#f1ece2", "#8a5a2b", -692, -125, 41, -71, 214, 1.55],
  ["An", "Analytics", "#2b3a36", "#ffffff", -350, -339, 65, -26, 188, 1.75],
  ["St", "Storage", "#f4703a", "#ffffff", 672, -277, 2, 81, 256, 1.76],
  ["Se", "Search", "#2f6fdb", "#ffffff", -721, 211, 9, -84, 215, 2.06],
  ["Au", "Auth", "#0b0b0d", "#ffffff", 676, 348, -65, 52, 244, 2.48],
].map(([glyph, label, background, color, x, y, vx, vy, size, at]) => ({
  glyph,
  label,
  background,
  color,
  x,
  y,
  vx,
  vy,
  size,
  at,
}));
/** A page the scene would otherwise paint, left to the footage underneath. */
const CLEAR = { background: "transparent" };
/** Every Remotion project already has these; Studio refuses them as dependencies. */
const PROVIDED = new Set(["react", "react-dom", "remotion"]);

/**
 * This site's name, anywhere in an Element: a stamp, a type name, a log prefix,
 * a URL. The build fails on one rather than ship it into someone's project.
 */
const BRAND = /snap-?cn|snapCn|SNAPCN/i;
/** The group that draws this site's mark, in every logo component that carries it. */
const MARK_GROUP =
  /<g transform="translate\(0,409\) scale\(0\.1,-0\.1\)"[^>]*>[\s\S]*?<\/g>/g;

/**
 * Pictures and footage a scene's source loads from this site — stock walls,
 * demo posters, showcase photos — swapped for the Element's neutral starter
 * media, so nothing in it reaches back here and none of it is ours. A picture
 * becomes one of the neutral photos, files of the Element's own that Studio
 * copies into the project; one built per item (`…/${slug}.webp`) picks among
 * them by its key, so a wall of posters is still a wall of different pictures.
 * Video becomes Remotion's test footage. A bare base URL is left for a `patch`.
 */
const HOSTED = /(["'`])https?:\/\/(?:media\.)?snapcn\.dev\/([^"'`]*)\1/g;
const PICTURE = /\.(webp|jpe?g|png|gif|avif)(\?|$)/i;
function rehost(
  source: string,
  slug: string,
): { source: string; files: StaticAsset[] } {
  // A base URL in a constant (`${SHOWCASE}/a.jpg`), spelled out where it is
  // used, so each picture is a whole URL; the constant goes when nothing else
  // reads it.
  for (const [line, name, base] of source.matchAll(
    /const (\w+) = "(https?:\/\/(?:media\.)?snapcn\.dev\/[^"]*)";\n/g,
  )) {
    if (PICTURE.test(base) || VIDEO_FILE.test(base)) continue;
    source = source.replaceAll(`\${${name}}`, base);
    if (!new RegExp(`\\b${name}\\b`).test(source.replace(line, ""))) {
      source = source.replace(line, "");
    }
  }
  let used = false;
  let next = 0;
  const out = source.replace(HOSTED, (m, quote: string, rest: string) => {
    if (VIDEO_FILE.test(rest)) return JSON.stringify(FOOTAGE);
    const built = quote === "`" && rest.includes("${");
    if (!built && !PICTURE.test(rest)) return m;
    used = true;
    return built
      ? `pickPhoto(\`${rest}\`)`
      : `NEUTRAL_PHOTOS[${next++ % PHOTO_FILES.length}]`;
  });
  if (!used) return { source: out, files: [] };
  const files = PHOTOS(slug);
  return {
    source: `import { staticFile as mediaFile } from "remotion";
const NEUTRAL_PHOTOS = [${files.map((f) => `mediaFile(${JSON.stringify(f.staticFile)})`).join(", ")}];
const pickPhoto = (key: string) =>
  NEUTRAL_PHOTOS[[...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % NEUTRAL_PHOTOS.length];
${out}`,
    files,
  };
}

/**
 * This site's logo as data — `SNAPCN_MARK` / `SNAPCN_LOGO`, the art a lockup
 * draws when nobody passes their own: `{ width, height, shapes }`, `{ path,
 * width, height }` or `{ viewBox, path }`, sometimes with the wordmark's glyphs
 * in it too. Redrawn as one plain rounded square in a square box, keeping the
 * object's shape, so every lockup still has a mark to animate and none of it is
 * ours. (The 464x409 `<g>` form is `MARK_GROUP`, in `neutral`.)
 */
function unbrandMarks(source: string): string {
  const head = /const SNAPCN_(?:MARK|LOGO|WORDMARK)\b[^=]*=\s*\{/g;
  let out = "";
  let from = 0;
  for (const m of source.matchAll(head)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < source.length; close++) {
      if (source[close] === "{") depth++;
      if (source[close] === "}" && --depth === 0) break;
    }
    const art = source.slice(open, close + 1);
    // The name set as outlines, used while the name is its `text`: emptied,
    // so any name — "Acme" included — is set as live text.
    if (/\btext:/.test(art)) {
      out +=
        source.slice(from, open) +
        art
          .replace(/\btext:\s*"[^"]*"/, 'text: ""')
          .replace(/\bpath:\s*"[^"]*"/, 'path: ""');
      from = close + 1;
      continue;
    }
    const num = (k: string) =>
      Number(art.match(new RegExp(`\\b${k}:\\s*([\\d.]+)`))?.[1]);
    const view = art
      .match(/viewBox:\s*"([^"]+)"/)?.[1]
      .split(/\s+/)
      .map(Number);
    const side = Math.min(
      ...(view ? [view[2], view[3]] : [num("width"), num("height")]),
    );
    const r = +(side * 0.235).toFixed(1);
    const e = +(side - r).toFixed(1);
    const square = `M${r} 0H${e}A${r} ${r} 0 0 1 ${side} ${r}V${e}A${r} ${r} 0 0 1 ${e} ${side}H${r}A${r} ${r} 0 0 1 0 ${e}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
    const body = view
      ? `{ viewBox: "0 0 ${side} ${side}", path: "${square}" }`
      : /\bshapes:/.test(art)
        ? `{ width: ${side}, height: ${side}, shapes: ["${square}"] }`
        : `{ path: "${square}", width: ${side}, height: ${side} }`;
    out += source.slice(from, open) + body;
    from = close + 1;
  }
  return out + source.slice(from);
}

/** An Element's `patch`, applied to its inlined source. */
function patched(source: string, studio: Studio): string {
  let out = source;
  for (const [from, to] of studio.patch ?? []) {
    const next = out.replace(from, to);
    if (next === out) throw new Error(`patch found nothing: ${String(from)}`);
    out = next;
  }
  return out;
}

/**
 * The inlined source without this site's name on it. The registry files carry
 * it in their stamps, in their shared theme's type names and log prefix, and
 * in comments that explain a choice by pointing at this site; none of it means
 * anything in someone else's project. Renamed, not deleted: the code is the same
 * code, and every comment still says what it said about the code.
 */
function neutral(source: string): string {
  return (
    source
      // The file stamps: `// Card Rail · snapcn — https://snapcn.dev/…`.
      .replace(/^\/\/[^\n]*snapcn[^\n]*\n/gim, "")
      // This site's mark — the 464x409 glyph every logo component here draws —
      // as a plain rounded square, painted as the mark was (text-highlight's
      // patch, for every scene that carries one).
      .replace(MARK_GROUP, (group) => {
        const fill = group.match(/fill=(\{[^}]*\}|"[^"]*")/)?.[1];
        return `<rect x="27.5" y="0" width="409" height="409" rx="96"${fill ? ` fill=${fill}` : ""} />`;
      })
      .replace(/(const SNAPCN_MARK\s*=\s*)(["`])[\s\S]*?\2/, '$1""')
      .replace(/\bSnapcnMark\b/g, "DefaultMark")
      // Copy in a string, shown on screen when nobody passes their own: the
      // name a hand-made entry would use, not "the library". Never a URL.
      .replace(/"([^"\n:]*)"/g, (m, text: string) =>
        BRAND.test(text)
          ? `"${NEUTRAL_COPY.reduce((t, [re, to]) => t.replace(re, to), text)}"`
          : m,
      )
      .replace(/\[snap-cn-ui\] ?/g, "")
      .replace(/SNAPCN_/g, "DEFAULT_")
      .replace(/\bSnapCn/g, "Kit")
      .replace(/\buseSnapCn/g, "useKit")
      .replace(/\bsnapCn/g, "kit")
      .replace(/\bSnapMark\b/g, "DefaultMark")
      // What is left is prose in comments. A URL is never rewritten: one in
      // code is a real reference, and the build stops on it instead.
      .replace(/\bsnap-cn-ui\b/g, "the shared theme")
      .replace(/\bsnapcn's\b(?!\.dev)/gi, "the library's")
      .replace(/\bsnapcn\b(?!\.dev)/gi, "the library")
  );
}

type Item = {
  name: string;
  title?: string;
  type?: string;
  files?: RegistryFile[];
  devDependencies?: string[];
};

/**
 * The components hand-fitted as Elements: text treatments, captions and frames
 * that sit on top of somebody else's footage, cropped to their ink and with
 * objects of their own. Every other component with a page is an Element too,
 * as a whole scene (`scene()`); an entry here is how one gets more than that.
 * See `Studio` for what each field answers.
 */
const ELEMENTS: Record<string, Studio> = {
  "answer-highlight": {
    box: [720, 320],
    // Sized off the frame's height: laid out at its stage, cropped to the card.
    stage: [960, 540],
    controls: [
      "question",
      "answer",
      "statement",
      "word",
      "questionColor",
      "answerColor",
      "pillColor",
      "accentColor",
      "fontFamily",
      "speed",
    ],
    props: { paperColor: "transparent" },
  },
  "cursor-track": {
    box: [1280, 720],
    // The cursor enters from off-frame; here that edge is the box's.
    clip: true,
    // No `variant`: arrow and dot are two cursors, and an Inspector control
    // must not switch between visual styles (the Element guidelines).
    controls: ["size", "color", "outlineColor", "ringColor", "speed"],
  },
  "karaoke-captions": {
    box: [1280, 160],
    // The line sits a set distance off the bottom: cropped to it.
    stage: [1280, 320],
    controls: [
      "text",
      "emphasize",
      "accentColor",
      "fontSize",
      "emphasisScale",
      "fontFamily",
      "speed",
    ],
    // Sized off the short side by default, which is the strip's height here.
    // The karaoke look, pinned: the component's default is the plain boxed
    // caption, which paints none of accent, emphasis or font.
    props: { fontSize: 45, preset: "karaoke" },
    // A light/dark select wired to `theme`, which takes token overrides.
    drop: ["theme"],
    // Fades its own line out, and spreads the line across its own length.
    exit: false,
    durationInFrames: 150,
  },
  "laptop-frame": {
    box: [900, 600],
    controls: [
      "screenSrc",
      "notchLabel",
      "showNotch",
      "bezelColor",
      "screenColor",
      "restTilt",
      "scale",
      "floatLoop",
      "speed",
    ],
    // The zoom-to-screen finale leaves any box; it is a scene's ending.
    props: { finale: "none", notchLabel: "Recording", screenSrc: FOOTAGE },
    // Studio's picker takes one kind of file, and this one is a recording.
    assets: { screenSrc: "video" },
    labels: { screenSrc: "Screen recording" },
  },
  "phone-frame": {
    box: [380, 760],
    controls: [
      "screenSrc",
      "bezelColor",
      "screenColor",
      "scale",
      "tiltAngle",
      "showDynamicIsland",
      "floatLoop",
      "speed",
    ],
    // A phone's screen is a recording more often than a still; the scene
    // plays either, and the picker is Studio's only way to replace it.
    assets: { screenSrc: "video" },
    labels: { screenSrc: "Screen recording" },
    // `showcase` is a crane move across the frame; "" is the built-in screen.
    props: { variant: "tilt", screenSrc: "" },
  },
  "punch-lines": {
    box: [1120, 380],
    controls: [
      "script",
      "ink",
      "accentColor",
      "accentBeat",
      "fontSize",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    props: {
      ground: "transparent",
      script: "Your launch / deserves a video. | Make it. Ship it. | Today.",
      // The last card cuts out on the preview's final frame; held through the
      // tail, it is what the fade out carries away.
      holds: `48,48,${48 + TAIL}`,
    },
    items: {
      noun: "Card",
      nameFrom: "text",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.text?.trim())`,
      // Lines slide in one at a time, each on its own transform.
      outline: "content",
      fields: {
        text: {
          label: "Text (/ breaks a line)",
          type: "text",
          from: "script",
          sep: "|",
        },
      },
      // The last card holds through the Element's fade-out, whichever it is.
      build: `(o) => ({
        script: o.map((x) => clean(x.text, "|")).join("|"),
        holds: o.map((_, i) => (i === o.length - 1 ? ${48 + TAIL} : 48)).join(","),
      })`,
    },
  },
  "screen-recording": {
    box: [1280, 720],
    controls: [
      "src",
      "fit",
      "radius",
      "cutTop",
      "cutRight",
      "cutBottom",
      "cutLeft",
      "audio",
      "speed",
    ],
    // The recording's crop, renamed: Studio owns `crop*` on every layer and
    // would take these into its own Crop section, in its own units.
    alias: {
      cutTop: "cropTop",
      cutRight: "cropRight",
      cutBottom: "cropBottom",
      cutLeft: "cropLeft",
    },
    props: { backdropColor: "transparent", src: FOOTAGE },
    // The Sequence's trim, not the recording's.
    drop: ["trimBefore"],
  },
  "text-build": {
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1100, 101],
    stage: [1100, 160],
    at: [0, 37],
    controls: [
      "text",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "text-highlight": {
    box: [860, 120],
    controls: [
      "before",
      "highlight",
      "after",
      "baseColor",
      "accentColor",
      "highlightedTextColor",
      "fontSize",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    // `logo-wipe` ends on a full-frame flood of colour.
    props: { preset: "marker" },
    // logo-wipe's default mark, which this Element never draws but still
    // carries, is this site's logo: a plain rounded square instead.
    patch: [
      [
        /<g transform="translate\(0,409\) scale\(0\.1,-0\.1\)">[\s\S]*?<\/g>/,
        '<rect x="27.5" y="0" width="409" height="409" rx="96" fill={color} />',
      ],
      [
        /Default mark: the snapcn mark, the same path `public\/logo\.svg` draws\./,
        "Default mark: a rounded square.",
      ],
    ],
  },
  "text-reveal": {
    box: [820, 240],
    controls: [
      "text",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "text-rewrite": {
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1000, 113],
    at: [140, 297],
    // Scales a 16:9 stage to fit: laid out at it, cropped to the line.
    stage: [1280, 720],
    controls: [
      "headline",
      "keep",
      "append",
      "accentColor",
      "mode",
      "fontSize",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    props: {
      headline: "Or just try Acme",
      append: "Billing",
      markPath: "",
      glow: false,
      theme: { background: "transparent" },
    },
  },
  "text-select": {
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1280, 109],
    at: [0, 302],
    // Scales a 16:9 stage to fit: laid out at it, cropped to the line.
    stage: [1280, 720],
    controls: [
      "headline",
      "accentColor",
      "shineColor",
      "mode",
      "fontSize",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    props: { glow: false, theme: { background: "transparent" } },
  },
  "text-swap": {
    box: [900, 160],
    // Remotion's lint rule reads a prop named `transition` as a CSS transition:
    // the scene's own default stands, marked, and the wrapper does not repeat it.
    drop: ["transition"],
    patch: [
      [
        /\n(\s*)transition = "fly-through",/,
        '\n$1// eslint-disable-next-line @remotion/non-pure-animation -- the prop that picks the swap, not a CSS transition\n$1transition = "fly-through",',
      ],
    ],
    // The fly-through carries the old line past the camera, across the whole
    // frame; an Element keeps it inside its box.
    clip: true,
    controls: [
      "fromText",
      "toText",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "text-swell": {
    box: [1280, 180],
    controls: [
      "text",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "word-captions": {
    box: [1280, 160],
    // The line sits a set distance off the bottom: cropped to it.
    stage: [1280, 320],
    controls: [
      "words",
      "framesPerWord",
      "textColor",
      "accentColor",
      "fontSize",
      "maxWidth",
      "fontFamily",
      "speed",
    ],
    // The default "boxed" look paints neither the accent nor the font; the
    // YouTube look is the plainest one that does.
    props: { fontSize: 45, preset: "youtube" },
    // The whole transcript: 16 words at 14 frames, and a beat.
    durationInFrames: 16 * 14 + 10,
  },
  "word-flip": {
    box: [1280, 160],
    controls: [
      "prefix",
      "words",
      "suffix",
      "caret",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    props: { words: ["Modern", "Stunning", "Minimal"] },
    list: ["words"],
  },
  "word-gather": {
    box: [860, 380],
    // Scatters and sizes off its frame: laid out at it, cropped to the words.
    stage: [1065, 582],
    controls: ["text", "maxWidth", "accent", "mode", "fontFamily", "speed"],
    props: { theme: { background: "transparent" } },
  },
  "word-wheel": {
    // The scene lays out in 700 × 532; the reel's rows travel 63px above and
    // 53px below it on the way round (measured), so the box is taller than
    // the stage and the outline holds the whole turn.
    box: [700, 720],
    stage: [700, 532],
    at: [0, -94],
    controls: ["headline", "words", "spin", "mode", "fontFamily"],
    props: { headline: "Made for", theme: { background: "transparent" } },
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    clip: true,
  },
  // ── Scenes: each laid out at its 1280x720 stage and clipped to it, so
  // nothing reaches past the box; the page left transparent.
  "agent-steps": {
    // The prompt and its steps: a column at the top of the stage.
    box: [640, 440],
    stage: [1280, 720],
    at: [296, 0],
    clip: true,
    controls: [
      "query",
      "steps",
      "result",
      "inkColor",
      "stepColor",
      "accentColor",
      "pillColor",
      "fontFamily",
      "speed",
    ],
    items: {
      noun: "Step",
      nameFrom: "done",
      fields: {
        running: { label: "While running", type: "text", from: "steps" },
        done: { label: "When done (the last step never is)", type: "text" },
        icon: {
          label: "Icon when done",
          type: "enum",
          options: ["check", "globe"],
        },
      },
      build: `(o) => ({ steps: o.map((x) => clean(x.running, ";>") + " > " + clean(x.done, ";>") + (x.icon === "globe" ? " @globe" : "")).join("; ") })`,
      starter: (d) =>
        String(d.steps ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((e) => {
            const icon = /@globe$/.test(e) ? "globe" : "check";
            const body = e.replace(/@globe$/, "").trim();
            const cut = body.indexOf(">");
            return {
              running: (cut < 0 ? body : body.slice(0, cut)).trim(),
              done: (cut < 0 ? body : body.slice(cut + 1)).trim(),
              icon,
            };
          }),
    },
    props: {
      paperColor: "transparent",
      glowColor: "transparent",
      query: "A 30-second launch video for an analytics dashboard",
    },
  },
  "announce-title": {
    box: [1280, 720],
    clip: true,
    controls: [
      "eyebrow",
      "title",
      "tagline",
      "inkColor",
      "titleColor",
      "taglineColor",
      "voidColor",
      "fieldColor",
      "paperColor",
      "nightColor",
      "fontFamily",
      "speed",
    ],
    props: {
      title: "Acme 2.0",
      tagline: "Everything your team ships, in one place.",
      // An empty path leaves the line bare; the default is snapcn's mark.
      symbolPath: "",
      // Its four colour cuts, left to the footage: the lines carry the
      // sequence on their own, in ink. Set a colour and that cut comes back.
      voidColor: "transparent",
      fieldColor: "transparent",
      paperColor: "transparent",
      nightColor: "transparent",
      glowStrength: 0,
      inkColor: "#141414",
      taglineColor: "#141414",
    },
  },
  "block-wordmark": {
    // The wordmark's row, full width so a longer name still fits.
    box: [1280, 240],
    stage: [1280, 720],
    at: [0, 240],
    clip: true,
    controls: ["text", "color", "colors", "fontSize", "fontFamily", "speed"],
    props: { text: "acme", background: "transparent" },
  },
  "card-rail": {
    box: [1280, 720],
    clip: true,
    controls: ["heading", "mode", "fontFamily"],
    // A start frame; the Sequence owns `from`.
    drop: ["speed", "from"],
    items: {
      noun: "Card",
      nameFrom: "title",
      // Three cards in frame, and a flick carries the rail about one card on:
      // three flicks show six. More cards get more flicks, closer together, so
      // every card still comes past inside the Element's length.
      build: `(o) => {
        const flicks = Math.max(3, o.length - 3);
        return {
          cards: o.map(({ image, title, note, tag }) => ({ image, title, note, tag })),
          flicks,
          every: Math.min(30, Math.floor(90 / flicks)),
        };
      }`,
      starter: (d) =>
        (d.cards as Record<string, string>[]).map((c) => ({
          title: c.title ?? "",
          note: c.note ?? "",
          tag: c.tag ?? "",
          image: c.image ?? "",
        })),
      fields: {
        title: { label: "Title", type: "text", from: "cards", node: "title" },
        note: {
          label: "Small print",
          type: "text",
          from: "cards",
          node: "note",
        },
        tag: { label: "Tag", type: "text", from: "cards", node: "tag" },
        image: { label: "Image", type: "image", from: "cards", node: "src" },
      },
    },
    props: {
      heading: "Browse templates",
      cards: [
        ["Onboarding", 12],
        ["Dashboard", 8],
        ["Checkout", 5],
        ["Settings", 9],
        ["Reports", 6],
        ["Inbox", 4],
      ].map(([title, screens], i) => ({
        image: PHOTOS("card-rail")[i],
        title,
        note: `Template · ${screens} screens`,
        tag: `@acme/${String(title).toLowerCase()}`,
      })),
      theme: CLEAR,
    },
  },
  "channel-thread": {
    // The thread, which scrolls up out of the top of its stage: cropped to the
    // column it draws in over its whole run, measured, 24px clear.
    box: [950, 560],
    stage: [1280, 720],
    at: [210, 0],
    clip: true,
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    controls: ["mode", "fontFamily"],
    items: {
      noun: "Message",
      nameFrom: "text",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.text?.trim())`,
      // A line box is set solid, so descenders hang below it.
      outline: "content",
      fields: {
        text: {
          label: "Message",
          type: "text",
          from: "messages",
          node: "children",
        },
        author: { label: "Author", type: "text", from: "messages" },
        time: { label: "Time", type: "text", from: "messages" },
        avatar: { label: "Avatar", type: "image", from: "messages" },
      },
      // Consecutive messages with one author, time and avatar group themselves;
      // the scene times each arrival.
      build: `(o) => ({
        messages: o.map(({ text, author, time, avatar }) => ({ text: text ?? "", author, time, avatar })),
      })`,
      starter: (d) =>
        (d.messages as Record<string, string>[]).map((m) => ({
          text: m.text,
          author: m.author,
          time: m.time,
          avatar: m.avatar,
        })),
    },
    props: {
      mode: "light",
      messages: [
        ["rhea", "9:41 AM", "07", "Launch video by Thursday?"],
        ["rhea", "9:41 AM", "07", "We have nothing shot."],
        ["sam", "9:42 AM", "13", "Already done."],
        ["sam", "9:42 AM", "13", "Built it this morning."],
      ].map(([author, time, face, text]) => ({
        author,
        time,
        avatar: AVATAR("channel-thread", Number(face)),
        text,
      })),
      theme: CLEAR,
    },
  },
  "count-grid": {
    box: [1280, 720],
    clip: true,
    controls: ["start", "to", "noun", "mode", "speed"],
    // The number it counts from; the Sequence owns `from`.
    alias: { start: "from" },
    // Its own cards are this site's files through staticFile(): a 404 in
    // anyone else's project, and half of them are snapcn's posters.
    items: {
      noun: "Card",
      fields: {
        image: { label: "Image", type: "image", from: "cards" },
      },
    },
    props: { background: "transparent", cards: PHOTOS("count-grid") },
  },
  "follower-rush": {
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1280, 305],
    stage: [1280, 720],
    at: [0, 209],
    clip: true,
    controls: ["totalFollowers", "accentColor", "fontFamily", "speed"],
    // A light/dark select wired to `theme`, which takes token overrides.
    drop: ["theme"],
    props: { theme: CLEAR, followers: FOLLOWERS },
    items: {
      noun: "Follower",
      nameFrom: "person",
      fields: {
        // `name` is the layer's own, in Studio.
        person: { label: "Name", type: "text", from: "followers" },
        avatar: { label: "Photo", type: "image", from: "followers" },
      },
      build: `(o) => ({
        followers: o.map(({ person, avatar }) => ({ name: person ?? "", avatar: avatar || undefined })),
      })`,
      // The row holds 24 at once: 24 people, and nobody shows twice.
      starter: (d) =>
        (d.followers as { name: string; avatar: string }[])
          .slice(0, 24)
          .map(({ name, avatar }) => ({ person: name, avatar })),
    },
  },
  "hero-launch": {
    box: [1280, 720],
    clip: true,
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    controls: ["heading", "fontFamily"],
    items: {
      noun: "Card",
      fields: { image: { label: "Image", type: "image" } },
      // The left card zooms in from full frame, inside its box.
      outline: "content",
      // Two cards, left and right: one card fills both, a third has nowhere to go.
      build: `(o) => ({ image1: o[0]?.image || undefined, image2: o[1 % Math.max(o.length, 1)]?.image || undefined })`,
      // The assets themselves: `String()` of one is "[object Object]".
      starter: (d) => [{ image: d.image1 }, { image: d.image2 }],
    },
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      image1: PHOTOS("hero-launch")[3],
      image2: PHOTOS("hero-launch")[7],
      heading: "Launching today",
      theme: CLEAR,
    },
  },
  "logo-assemble": {
    // Cropped to the column the ring and the lockup draw in, measured, 24px clear.
    box: [720, 720],
    stage: [1280, 720],
    at: [280, 0],
    clip: true,
    controls: ["brandName", "middleText", "logoSrc", "fontFamily", "speed"],
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      brandName: "Acme",
      middleText: "Everything your team ships",
      logoSrc: MARK("logo-assemble"),
      background: "transparent",
      images: PHOTOS("logo-assemble"),
    },
    items: {
      noun: "Image",
      // The ring's cards cycle the images: a blank one would be a card with no picture.
      keep: `(x) => Boolean(x.image?.trim())`,
      fields: { image: { label: "Image", type: "image", from: "images" } },
      // Ten cards is the ring's density; past ten, a card per image so every image rides it.
      build: `(o) => ({ images: o.map((x) => x.image ?? ""), count: Math.max(10, o.length) })`,
    },
  },
  "logo-collapse": {
    // The row the pictures collapse into the mark on, cropped to the shots'
    // widest card, measured, 24px clear.
    box: [640, 360],
    stage: [1280, 720],
    at: [316, 180],
    clip: true,
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    controls: ["images", "mark", "wordmark", "accent", "mode", "fontFamily"],
    items: {
      noun: "Shot",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.image?.trim())`,
      fields: {
        image: {
          label: "Image",
          type: "image",
          from: "images",
          sep: "|",
          node: "src",
        },
      },
      // Each shot's hold and size by its place in the collapse; a shot past the
      // sixth holds and sits like the sixth, so it still shows.
      build: `(o) => ({
        images: o.map((x) => x.image ?? "").join("|"),
        holds: o.map((_, i) => [1, 5, 5, 4, 2, 5][i] ?? 5).join(","),
        sizes: o.map((_, i) => ["0.82x0.461", "0.72x0.405", "0.63x0.354", "0.55x0.309", "0.46x0.259", "0.36x0.203"][Math.min(i, 5)]).join(","),
      })`,
      starter: PHOTOS("logo-collapse")
        .slice(0, 6)
        .map((image) => ({ image })),
    },
    props: {
      // The shots are the items'; the stage always passes the list they build.
      images: "",
      mark: MARK("logo-collapse"),
      wordmark: "acme",
      theme: CLEAR,
    },
  },
  "logo-drift": {
    box: [1280, 720],
    clip: true,
    controls: [
      "headline",
      "fontSize",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    // Its tiles name Remotion, React, Vercel and six more: the same fitted
    // choreography, with generic app names.
    items: {
      noun: "Tile",
      nameFrom: "label",
      fields: {
        glyph: { label: "Glyph", type: "text" },
        label: { label: "Label", type: "text" },
      },
      // Each tile keeps its place and paint from the scene's own stack.
      build: `(o) => ({ tiles: o.map((x, i) => ({ ...SNAPCN_STACK[i % SNAPCN_STACK.length], glyph: x.glyph ?? "", label: x.label || undefined })) })`,
      starter: (d) =>
        (d.tiles as { glyph: string; label?: string }[]).map((t) => ({
          glyph: t.glyph,
          label: t.label ?? "",
        })),
    },
    // The wash is an accent glow over the page; on someone's footage it is a tint.
    props: { theme: CLEAR, tiles: DRIFT_TILES, glow: false },
  },
  "logo-flicker": {
    box: [1280, 720],
    clip: true,
    controls: ["brandName", "logoSrc", "fontFamily", "speed"],
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      brandName: "Acme",
      logoSrc: MARK("logo-flicker"),
      background: "transparent",
      images: PHOTOS("logo-flicker"),
    },
    // Its fallback pictures are this site's posters. The Element always passes
    // its own, from the picture fields, so the fallback is empty.
    patch: [
      [
        /\/\*\* Sample images\.[\s\S]*?const DEFAULT_IMAGES = \[[\s\S]*?\];/,
        "/** No pictures: the Element passes its own. */\nconst DEFAULT_IMAGES: string[] = [];",
      ],
    ],
    // The pictures flash two frames each: not objects to select, so numbered
    // picture fields rather than one per call site.
    slots: { prop: "images", key: "image", count: 8, label: "Image" },
  },
  "moodboard-reveal": {
    // Cropped to the band the photos and the line draw in, measured, 24px clear.
    box: [990, 720],
    stage: [1280, 720],
    at: [104, 0],
    clip: true,
    controls: [
      "leadIn",
      "emphasis",
      "tailIn",
      "heroImage",
      "darkColor",
      "lightColor",
      "fontFamily",
      "speed",
    ],
    props: {
      // Both pages left to the footage, so it crossfades nothing and draws in
      // ink; set either and that page comes back.
      darkColor: "transparent",
      lightColor: "transparent",
      heroImage: PHOTOS("moodboard-reveal")[3],
      images: PHOTOS("moodboard-reveal"),
    },
    // Eight slots swap through the photos, one object each; the hero stays
    // its own control.
    items: {
      noun: "Photo",
      fields: { image: { label: "Photo", type: "image", from: "images" } },
      keep: `(x) => Boolean(x.image?.trim())`,
    },
  },
  "orbit-gallery": {
    box: [1280, 720],
    clip: true,
    controls: [
      "title",
      "subtitle",
      "buttonLabel",
      "textColor",
      "fontFamily",
      "speed",
    ],
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      background: "transparent",
      textColor: "#141414",
      // Its own default is a set of picsum.photos URLs: another site's, and
      // random. The neutral photos every other Element starts with.
      images: PHOTOS("orbit-gallery"),
    },
    // The spiral repeats its photos to fill its slots; each photo outlines its
    // largest copy in frame.
    items: {
      noun: "Photo",
      fields: { image: { label: "Photo", type: "image", from: "images" } },
      keep: `(x) => Boolean(x.image?.trim())`,
    },
  },
  "roster-grant": {
    box: [1280, 720],
    clip: true,
    controls: ["label", "accentColor", "fontFamily", "speed"],
    drop: ["theme"],
    items: {
      noun: "Entry",
      nameFrom: "title",
      fields: {
        // `from` only marks `rows` as an item prop; `build` regroups it.
        title: { label: "Name", type: "text", from: "rows" },
        role: { label: "Role", type: "text", from: "rows" },
      },
      // The scene draws three rows: the flat list, cut into three in order.
      build: `(o) => {
        const e = o.map((x) => ({ name: x.title ?? "", role: x.role ?? "" }));
        const n = Math.ceil(e.length / 3);
        return { rows: [e.slice(0, n), e.slice(n, 2 * n), e.slice(2 * n)] };
      }`,
      // Each row pans three entries across the frame; a fourth never arrives.
      starter: (defaults) =>
        ((defaults.rows ?? []) as { name: string; role: string }[][])
          .flatMap((row) => row.slice(0, 3))
          .map((e) => ({ title: e.name, role: e.role })),
    },
    props: {
      // Its own roster is snapcn's component list.
      rows: [
        [
          { name: "Analytics", role: "Module" },
          { name: "Billing", role: "Module" },
          { name: "Inbox", role: "Add-on" },
          { name: "Reports", role: "Module" },
        ],
        [
          { name: "Calendar", role: "Add-on" },
          { name: "Checkout", role: "Module" },
          { name: "Search", role: "Add-on" },
          { name: "Settings", role: "Module" },
        ],
        [
          { name: "Onboarding", role: "Flow" },
          { name: "Profile", role: "Module" },
          { name: "Exports", role: "Add-on" },
          { name: "Teams", role: "Module" },
        ],
      ],
      theme: CLEAR,
    },
  },
  "status-cycle": {
    box: [1280, 720],
    clip: true,
    controls: [
      "prefix",
      "statuses",
      "chips",
      "fieldColor",
      "pillColor",
      "pillLabelColor",
      "prefixColor",
      "chipTextColor",
      "chipBorderColor",
      "fontFamily",
      "speed",
    ],
    props: {
      prefix: "Acme is",
      statuses: "designing, building, shipping, live",
      chips: "onboarding, dashboard, checkout, billing, reports",
      pageColor: "transparent",
      // The act-one field too: the prefix and the pill read on the footage.
      fieldColor: "transparent",
    },
    items: {
      noun: "Chip",
      nameFrom: "label",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.label?.trim())`,
      fields: {
        label: { label: "Label", type: "text", from: "chips", sep: ", " },
      },
    },
  },
  "terminal-simulator": {
    box: [1280, 720],
    clip: true,
    controls: [
      "intro",
      "background",
      "borderColor",
      "fontSize",
      "fontFamily",
      "speed",
    ],
    props: {
      // Its light terminal: a transparent page puts the intro and the output
      // on the footage, and the dark palette's white ink would vanish on it.
      mode: "light",
      theme: CLEAR,
      background: "#ffffff",
      borderColor: "#e4e4e7",
    },
    items: {
      noun: "Line",
      nameFrom: "text",
      // A row is the column's width; the outline is the text typed so far.
      outline: "content",
      fields: {
        text: { label: "Text", type: "text", from: "lines" },
        type: {
          label: "Kind",
          type: "enum",
          options: ["command", "log", "success", "error"],
        },
      },
      // A line's lead-in is its kind's: a command follows its prompt at once,
      // output takes a beat, a plain log line a longer one. The first line
      // starts as the camera lands.
      build: `(o) => ({
        lines: o.map((x, i) => {
          const type = (x.type ?? "command") as "command" | "log" | "success" | "error";
          return { text: x.text ?? "", type, delay: i === 0 ? 0 : { command: 4, success: 6, error: 6, log: 10 }[type] };
        }),
      })`,
      starter: [
        { text: "gh issue edit 42 --add-label bug", type: "command" },
        { text: "→   label added", type: "success" },
        { text: "$", type: "log" },
        { text: "One task", type: "command" },
      ],
    },
  },
  "wordmark-cut": {
    box: [1280, 720],
    clip: true,
    controls: ["word", "dotFrom", "dotTo", "fontFamily", "speed"],
    drop: ["theme"],
    props: { word: "acme.", theme: CLEAR },
  },
  "answer-stream": {
    box: [1280, 720],
    clip: true,
    controls: [
      "question",
      "answer",
      "headline",
      "model",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    props: { theme: CLEAR },
    items: {
      noun: "Card",
      nameFrom: "title",
      fields: {
        // `from` only marks `cards` as an item prop; `build` assembles the objects.
        title: { label: "Title", type: "text", from: "cards" },
        body: { label: "Body", type: "text", from: "cards" },
        // "auto" keeps the scene's own icon for the card's position.
        icon: {
          label: "Icon",
          type: "enum",
          options: ["auto", "pencil", "link", "shield", "globe"],
          from: "cards",
        },
      },
      build: `(o) => {
        const ICONS: Record<string, string> = {
          pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
          link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19",
          shield: "M12 2 4 6v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6l-8-4Z",
          globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z",
        };
        return {
          cards: o.map((x) => ({
            title: x.title ?? "",
            body: x.body ?? "",
            ...(x.icon && ICONS[x.icon] ? { icon: ICONS[x.icon] } : {}),
          })),
        };
      }`,
      // `cards` has no control, so the scene's own four are written out.
      starter: [
        {
          title: "Content",
          body: "Build pages around the exact questions buyers ask, so there is something accurate to cite.",
          icon: "auto",
        },
        {
          title: "Citations",
          body: "Run outreach to the sources that already get quoted for those questions.",
          icon: "auto",
        },
        {
          title: "Authority",
          body: "Earn links from the publishers the models already trust.",
          icon: "auto",
        },
        {
          title: "Coverage",
          body: "Place press so the name turns up wherever people go looking.",
          icon: "auto",
        },
      ],
    },
  },
  "prompt-send": {
    box: [1280, 720],
    clip: true,
    controls: [
      "text",
      "placeholder",
      "chips",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    props: { theme: CLEAR },
    items: {
      noun: "Chip",
      nameFrom: "label",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.label?.trim())`,
      fields: {
        label: {
          label: "Label",
          type: "text",
          from: "chips",
          sep: ", ",
          node: "children",
        },
      },
    },
  },
  "prompt-zoom": {
    box: [1280, 720],
    clip: true,
    controls: [
      "greeting",
      "text",
      "placeholder",
      "model",
      "effort",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    props: { theme: CLEAR },
  },
  "search-typing": {
    // The field's band; the dolly crops at the stage's sides by design.
    box: [1280, 240],
    stage: [1280, 720],
    at: [0, 245],
    clip: true,
    controls: ["text", "caret", "mode", "fontFamily", "speed"],
    props: { theme: CLEAR },
  },
  "type-morph": {
    // The line, full width so longer copy still fits.
    box: [1280, 220],
    stage: [1280, 720],
    at: [0, 230],
    clip: true,
    // `speed` and `accent`: two knobs this component never read.
    drop: ["speed", "accent"],
    controls: ["lead", "emphasis", "morphTo", "closing", "ink", "fontFamily"],
    // The component's `finally_` (`finally` is a keyword), under a plain name.
    alias: { closing: "finally_" },
    props: { background: "transparent" },
  },
};

/**
 * Pro components that ship as Elements. Their payloads are the component's
 * whole source, so they are built into `registry/.private/elements/` — beside
 * the paid registry items, never under `public/` — and handed out by
 * `app/elements/[file]/route.ts` only to an account whose plan carries the
 * components. The committed list, `lib/studio-elements-pro.json`, is names
 * only: it tells a page to offer the button, and costs nothing to publish.
 *
 * Built straight from `registry/snap-cn-pro/<name>/index.tsx` and its
 * `config.ts`, which is why a config listed here must stand on its own in
 * plain Node (no import of the component). A checkout without the pro tier
 * skips this whole section and leaves the committed list alone.
 */
const PRO_ELEMENTS: Record<string, Studio> = {
  "glass-prompt": {
    // A whole scene: it paints the frame, so it is laid out at 1280x720 and
    // clipped to it.
    box: [1280, 720],
    clip: true,
    controls: [
      "prompt",
      "backdrop",
      "fontFamily",
      "textScale",
      "ink",
      "showCaret",
      "frost",
      "rim",
      "lensZoom",
      "focus",
      "motionBlur",
      "showPointer",
      "pointer",
      "pointerFill",
      "ringScale",
      "ringBlur",
      "tileRadius",
      "print",
      "printDark",
      "printMid",
      "printLight",
      "background",
      "speed",
    ],
    // The ring's nine pictures, one object each, back of the pile first.
    items: {
      noun: "Picture",
      fields: { image: { label: "Image", type: "image" } },
      // Nine tiles: fewer pictures go round again, more are left out.
      build: `(o) => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [\`image\${i + 1}\`, o[i % Math.max(o.length, 1)]?.image || undefined]))`,
      starter: (d) =>
        Array.from({ length: 9 }, (_, i) => ({
          image: d[`image${i + 1}`],
        })),
    },
    // Its fallback pile is this site's posters. The Element always passes its
    // nine pictures, so the fallback is empty.
    patch: [
      [
        /\/\*\*\n \* snapcn's own scene posters[\s\S]*?(?:export )?const IMAGES = \[[\s\S]*?\]\.map\([^\n]*\);/,
        "/** No fallback pictures: the Element passes its own. */\nconst IMAGES: string[] = [];",
      ],
    ],
    // Starter content that is not ours: a neutral prompt and generic photos
    // instead of snapcn's own posters (the Element guidelines).
    props: {
      prompt: "Turn this week's photos into a launch reel",
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          `image${i + 1}`,
          PHOTOS("glass-prompt")[i % PHOTO_FILES.length],
        ]),
      ),
    },
  },
};
/**
 * Copy that names this site, made neutral: the Element's starter content may
 * not arrive wearing snapcn. "Acme" is what the hand-made entries above use.
 */
const NEUTRAL_COPY: readonly (readonly [RegExp, string])[] = [
  [/snapcn\.dev/gi, "acme.com"],
  [/@snapcn/gi, "@acme"],
  [/SNAPCN/g, "ACME"],
  [/snap-?cn/gi, "Acme"],
];
/** A picture or recording hosted here: it is ours, and it would load from us. */
const OURS = /^https?:\/\/(media\.)?snapcn\.dev\//;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(\?|$)/i;
/**
 * A control the Sequence owns (`name`, `from`), under its type's suffix —
 * `nameText`, `fromColor` — so the Inspector shows it instead of refusing it.
 */
const OWNED = new Set(["from", "name", "style", "layout", "hidden", "loop"]);
const SUFFIX: Partial<Record<ControlType["type"], string>> = {
  text: "Text",
  color: "Color",
  number: "Value",
  "number-input": "Value",
  boolean: "On",
  image: "Image",
  select: "Option",
};

/**
 * Every component with a page that has no entry of its own, as a whole scene:
 * laid out at 1280x720 and clipped to it, as glass-prompt is, with every
 * customizer control in the Inspector — so "Add to Remotion Studio" is on
 * every page (#87). Its copy and pictures are made neutral; a scene that needs
 * more than that (a mark in its source, objects of its own) gets an entry.
 */
function scene(
  slug: string,
  controls: Record<string, ControlType>,
  own: Partial<Studio> = {},
): Studio {
  const alias: Record<string, string> = {};
  const props: Record<string, unknown> = {};
  const drop: string[] = [...(own.drop ?? [])];
  let photo = 0;
  for (const [key, c] of Object.entries(controls)) {
    const el = OWNED.has(key) ? `${key}${SUFFIX[c.type] ?? "Value"}` : key;
    if (el !== key) alias[el] = key;
    const v = c.default;
    if (typeof v !== "string" || v === "") continue;
    const hosted = v.split("|").map((x) => x.trim());
    if (hosted.every((x) => OURS.test(x) || x.startsWith("/"))) {
      if (VIDEO_FILE.test(v)) props[el] = FOOTAGE;
      // One picture, on Studio's picker: a neutral photo of the Element's own.
      else if (c.type === "image" && hosted.length === 1) {
        props[el] = PHOTOS(slug)[photo++ % PHOTO_FILES.length];
      }
      // A list of pictures in a line of text has no picker to put a file in:
      // left out, so the scene shows its own default — made neutral by
      // `rehost` — and the copy stays editable in code.
      else drop.push(key);
    } else if (BRAND.test(v)) {
      props[el] = NEUTRAL_COPY.reduce((s, [re, to]) => s.replace(re, to), v);
    }
  }
  return {
    box: [1280, 720],
    clip: true,
    controls: Object.keys(controls)
      .filter((k) => !drop.includes(k))
      .map((k) => Object.keys(alias).find((el) => alias[el] === k) ?? k),
    ...own,
    drop,
    alias: { ...alias, ...own.alias },
    props: { ...props, ...own.props },
  };
}

/**
 * What a whole-scene Element needs beyond `scene()`'s defaults. These three
 * have a "Theme" light/dark select in their config that lands on a `theme`
 * prop typed as token overrides (a config bug: it is `mode` they read), so it
 * stays out of the Inspector rather than hand Studio a prop it would mistype.
 */
const SCENE_OWN: Record<string, Partial<Studio>> = {
  // Its label is half this site's name, which the brand check cannot see.
  "metal-chip": { props: { label: "acme" } },
  "hex-tally": { drop: ["theme"] },
  "picker-commit": { drop: ["theme"] },
  "wall-cut": { drop: ["theme"] },
};

/** Pro components that are `TransitionSeries` presentations: no Element. */
const TRANSITIONS = new Set(["pixel-peak"]);
const PRO_DIR = path.join(root, "registry", "snap-cn-pro");
const PRO_OUT = path.join(
  process.env.PRO_PRIVATE_DIR
    ? path.resolve(process.env.PRO_PRIVATE_DIR)
    : path.join(root, "registry", ".private"),
  "elements",
);

const readItem = async (file: string): Promise<Item> =>
  JSON.parse(await readFile(path.join(PUBLIC_R, file), "utf8"));

/** The version this site was built and tested against — Studio wants it exact. */
const installedVersion = async (pkg: string) =>
  JSON.parse(
    await readFile(
      path.join(root, "node_modules", pkg, "package.json"),
      "utf8",
    ),
  ).version as string;

const libItem = await readItem("snap-cn-ui.json");
/** Every registry component, by the path another component imports it from. */
const registry: Record<string, RegistryFile> = {};
for (const f of await readdir(PUBLIC_R)) {
  const it = await readItem(f);
  const main =
    it.files?.find((x) => x.path.endsWith("/index.tsx")) ?? it.files?.[0];
  if (it.type === "registry:component" && main) {
    registry[`@/components/snap-cn/${it.name}`] = main;
    // A Pro source imports a free one by its path in this repo.
    registry[`@/registry/snap-cn/${it.name}`] = main;
  }
}
const lib = libItem.files ?? [];
const configs = await loadConfigs();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

/** One Element payload: the component inlined, wrapped for the Studio, formatted. */
async function buildPayload(
  name: string,
  studio: Studio,
  item: Item,
  config: (typeof configs)[string] | undefined,
) {
  if (!config) throw new Error(`${name} has no config`);
  // The component stays as it is, under another name; its name goes to the
  // schema-enabled wrapper, which is the one export Studio imports.
  const own = config.componentName;
  // `export function X(`, or `export const X = (` / `export const X: FC<P> = (`.
  const declaration = new RegExp(
    `export (function ${own}\\(|const ${own}(?=[:\\s]))`,
    "g",
  );
  const file = item.files?.find((f) => f.content.match(declaration));
  if (!file) {
    throw new Error(`${name} has no \`export function|const ${own}\``);
  }
  // Under a name the file does not already use (the lockups export an `XScene`).
  const scene = [`${own}Scene`, `${own}Base`].find(
    (n) => !new RegExp(`\\b${n}\\b`).test(file.content),
  );
  if (!scene) throw new Error(`${name}: no free name for the scene`);
  // Its own other files, by the relative path it imports them with.
  const siblings = Object.fromEntries(
    (item.files ?? [])
      .filter((f) => f !== file)
      .map((f) => [`./${path.basename(f.path, path.extname(f.path))}`, f]),
  );
  if (file.content.match(declaration)?.length !== 1) {
    throw new Error(`${name}: expected one \`export … ${own}\``);
  }
  const renamed = file.content
    .replace(declaration, (m) =>
      m.startsWith("export function") ? `function ${scene}(` : `const ${scene}`,
    )
    // The wrapper takes the name; a default export of it would run first.
    .replace(new RegExp(`^export default ${own};\\n`, "m"), "");
  // A customizer control the scene never reads is no Inspector control, and
  // no prop: Studio would write it onto a component that does not take it.
  const reads = sceneProps(renamed, scene);
  const unread = reads
    ? Object.keys(config.controls).filter(
        (k) => !reads.has(k) && !studio.drop?.includes(k),
      )
    : [];
  if (unread.length) {
    const alias = studio.alias ?? {};
    studio = {
      ...studio,
      drop: [...(studio.drop ?? []), ...unread],
      controls: studio.controls.filter((k) => !unread.includes(alias[k] ?? k)),
    };
  }
  const defaults = elementDefaults(config.controls, studio, SITE);
  const element = elementSource(
    adoptDefaults(renamed, scene, own, studio, defaults) +
      (studio.items ? studioItemsWrapper : studioWrapper)({
        name: own,
        scene,
        title: item.title ?? name,
        studio: studio as Studio & { items: NonNullable<Studio["items"]> },
        controls: config.controls,
        defaults,
      }),
    own,
    lib,
    { ...registry, ...siblings },
  );
  if (!element) throw new Error(`${name} imports what cannot be inlined`);
  const hosted = rehost(
    unbrandMarks(patched(element.sourceCode, studio)).replace(
      // A scene that turns a root-relative path into `staticFile()` while
      // rendering would do it twice to a picture that already is one.
      "if (isLocal && getRemotionEnvironment().isRendering) {",
      'if (isLocal && !src.startsWith(staticFile("x").slice(0, -1)) && getRemotionEnvironment().isRendering) {',
    ),
    name,
  );
  // Studio shows this file and writes it into the project as-is: format it
  // the way the rest of the source is, generated wrapper included.
  const sourceCode = execFileSync(
    path.join(root, "node_modules", ".bin", "biome"),
    ["format", `--stdin-file-path=registry/snap-cn/${name}/element.tsx`],
    {
      // A stock Remotion template compiles with \`lib: ["es2015"]\`: without
      // these the DOM types the scene uses do not exist there.
      // `es2023` for what the scenes call on arrays and strings (`flat`,
      // `findLastIndex`, `padStart`), which es2015 does not have either.
      input: `/// <reference lib="dom" />\n/// <reference lib="dom.iterable" />\n/// <reference lib="es2023" />\n${dropUnused(hideLayers(neutral(hosted.source)))}`,
      encoding: "utf8",
    },
  );
  // Nothing of this site may survive into somebody else's project.
  const branded = sourceCode.match(BRAND);
  if (branded) {
    const line = sourceCode.slice(0, branded.index).split("\n").length;
    throw new Error(
      `"${branded[0]}" left in the Element, line ${line}: ${sourceCode.split("\n")[line - 1].trim().slice(0, 160)}`,
    );
  }

  const imported = [...new Set(element.modules.map(packageName))].filter(
    (pkg) => !PROVIDED.has(pkg),
  );
  // The types a package does not ship (culori's), which the registry declares
  // as devDependencies for `shadcn add`. Studio has one dependency list, and
  // without them a template's strict `tsc` rejects the import.
  const types = [
    ...new Set([
      ...(item.devDependencies ?? []),
      ...(libItem.devDependencies ?? []),
    ]),
  ].filter((t) => imported.includes(t.replace(/^@types\//, "")));
  const packages = [...imported, ...types];
  const [width, height] = studio.box;
  // Every file the Element starts with, copied into the project at install:
  // the stage's and each object's, by their path under `public/`.
  const assets = [
    ...new Map(
      [
        ...staticAssets([
          defaults,
          studio.items ? itemStarter(studio.items, defaults) : [],
        ]),
        ...hosted.files,
      ].map((a) => [a.staticFile, a]),
    ).values(),
  ];
  const payload = createElementPayload({
    displayName: item.title ?? name,
    slug: name,
    sourceCode,
    dependencies: await Promise.all(
      packages.map(
        async (pkg): Promise<ElementDependency> =>
          pkg.startsWith("@remotion/")
            ? { name: pkg as `@remotion/${string}`, version: null }
            : { name: pkg, version: await installedVersion(pkg) },
      ),
    ),
    dimensions: { width, height },
    durationInFrames: studio.durationInFrames ?? config.durationInFrames + TAIL,
    assets: assets.map((a) => ({
      path: a.staticFile,
      type: "url" as const,
      url: a.url,
    })),
    ...(studio.items
      ? // Its objects are call sites in the file, one outline each; Studio
        // puts the Sequence around it.
        { installationMode: "wrapped" as const, initialProps: null }
      : {
          installationMode: "component-owned-sequence" as const,
          // The starter content Studio writes onto the component, where the
          // Inspector edits it: the controls it shows, at the Element's values.
          initialProps: Object.fromEntries(
            [...studio.controls, ...slotKeys(studio)].flatMap((key) =>
              key in defaults
                ? [
                    [
                      key,
                      // Studio writes `staticFile(path)` on the invocation.
                      isStatic(defaults[key])
                        ? staticFileRef(defaults[key].staticFile)
                        : (defaults[key] as string | number | boolean),
                    ],
                  ]
                : [],
            ),
          ),
        }),
  });

  return payload;
}

/** Every failure, reported together: one bad scene should not hide the next. */
const failed: string[] = [];
const attempt = async (name: string, run: () => Promise<void>) => {
  try {
    await run();
  } catch (e) {
    failed.push(`${name}: ${(e as Error).message}`);
  }
};

const built: string[] = [];
// Every free component with a page (a customizer config) and a public item.
const free = Object.keys(configs).filter(
  (n) => n in ELEMENTS || existsSync(path.join(PUBLIC_R, `${n}.json`)),
);
for (const name of free) {
  await attempt(name, async () => {
    const item = await readItem(`${name}.json`);
    if (item.type !== "registry:component") return;
    const studio =
      ELEMENTS[name] ?? scene(name, configs[name].controls, SCENE_OWN[name]);
    const payload = await buildPayload(name, studio, item, configs[name]);
    await writeFile(
      path.join(OUT, `${name}.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    built.push(name);
  });
}
built.sort();

await writeFile(
  path.join(root, "lib", "studio-elements.json"),
  `${JSON.stringify(built, null, 2)}\n`,
);
console.log(`elements: built ${built.length}`);

// ── The paid half ──────────────────────────────────────────────────────────
if (existsSync(PRO_DIR)) {
  await mkdir(PRO_OUT, { recursive: true });
  const proBuilt: string[] = [];
  // Every released Pro component: the catalogue is what has a page.
  const released = JSON.parse(
    await readFile(path.join(root, "lib", "pro-catalogue.json"), "utf8"),
  ) as { name: string }[];
  for (const name of new Set(released.map((r) => r.name))) {
    if (!existsSync(path.join(PRO_DIR, name, "config.ts"))) continue;
    // A transition is a presentation between two scenes, not a layer.
    if (TRANSITIONS.has(name)) continue;
    await attempt(`pro ${name}`, async () => {
      const dir = path.join(PRO_DIR, name);
      // The component and the files it imports (`./data`), not its config or tests.
      const sources = (await readdir(dir)).filter(
        (f) => /\.tsx?$/.test(f) && f !== "config.ts",
      );
      const mod = await import(pathToFileURL(path.join(dir, "config.ts")).href);
      const config = Object.values(mod).find(
        (v): v is (typeof configs)[string] =>
          typeof v === "object" &&
          v !== null &&
          "controls" in v &&
          "componentName" in v,
      );
      const source: Item = JSON.parse(
        await readFile(path.join(PRO_DIR, "registry.json"), "utf8"),
      ).items.find((i: Item) => i.name === name);
      const item: Item = {
        name,
        title: source?.title ?? name,
        type: "registry:component",
        files: await Promise.all(
          sources.map(
            async (f) =>
              ({
                path: `${name}/${f}`,
                content: await readFile(path.join(dir, f), "utf8"),
                type: "registry:component",
                target: `components/snap-cn/${name}/${f}`,
              }) as RegistryFile,
          ),
        ),
      };
      if (!config) throw new Error("no config in config.ts");
      const studio =
        PRO_ELEMENTS[name] ?? scene(name, config.controls, SCENE_OWN[name]);
      const payload = await buildPayload(name, studio, item, config);
      await writeFile(
        path.join(PRO_OUT, `${name}.json`),
        `${JSON.stringify(payload, null, 2)}\n`,
      );
      proBuilt.push(name);
    });
  }
  proBuilt.sort();
  await writeFile(
    path.join(root, "lib", "studio-elements-pro.json"),
    `${JSON.stringify(proBuilt, null, 2)}\n`,
  );
  console.log(
    `elements: built ${proBuilt.length} pro, into ${path.relative(root, PRO_OUT)}`,
  );
} else {
  console.log("elements: no pro tier here — pro Elements left as they were");
}

if (failed.length) {
  console.error(`elements: ${failed.length} failed\n  ${failed.join("\n  ")}`);
  process.exit(1);
}
