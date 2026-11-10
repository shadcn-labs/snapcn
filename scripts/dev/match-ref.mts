import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderFrames,
  selectComposition,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { decodePng } from "../../lib/motion-check/png.ts";
import { tsconfigWebpackAlias } from "../tsconfig-webpack-alias.mts";

/**
 * Diff a component against a reference recording, frame by frame, in colour.
 *
 *   node scripts/dev/match-ref.mts <slug> <reference.mov> [frames] [outDir]
 *
 * `compare-frames.mts` is the other half of this: it reduces both clips to
 * three signals and is the right tool for "is the choreography right". This one
 * answers the harder question — *is every pixel where the reference put it* —
 * and so it cannot go through an mp4 at all:
 *
 *   h264 yuv420p subsamples chroma and quantises luma, which destroys exactly
 *   the antialiasing that `alpha = (bg − px) / (bg − fill)` reads to recover a
 *   sub-pixel edge. Both sides here are lossless PNG: the reference straight out
 *   of the container, the render out of `onFrameBuffer`.
 *
 * The composition is rendered at the **reference's own dimensions**, whatever
 * the config says, so a component whose geometry is a ratio of the frame can be
 * checked against the recording it was measured from without a resample in the
 * middle of the comparison.
 *
 * Printed per frame: mean and max per-channel error, the share of pixels off by
 * more than 8/255 (the eye's floor on a flat field), and the sub-pixel
 * silhouette of the largest object in both, which is what actually tells you
 * *which way* a beat is wrong when the error goes up.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const [slug, ref, countArg, outArg, propsArg] = process.argv.slice(2);
if (!slug || !ref) {
  throw new Error(
    "usage: match-ref.mts <slug> <reference.mov> [frames] [outDir] [props.json]",
  );
}
// A component's shipped copy is its own; the recording's copy is the
// recording's. Passing the reference's strings in keeps the diff about layout
// and motion rather than about how wide the word "users" is.
const inputProps: Record<string, unknown> = propsArg
  ? JSON.parse(readFileSync(path.resolve(propsArg), "utf8"))
  : {};

/** Reference frames, lossless, in capture order. */
function refFrames(file: string): string[] {
  const dir = mkdtempSync(path.join(tmpdir(), "ref-"));
  // -vsync 0 keeps the container's own frames — no duplication, no drops — so
  // frame n here is frame n of the recording and not of a resampled timeline.
  const r = spawnSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    file,
    "-vsync",
    "0",
    path.join(dir, "f%04d.png"),
  ]);
  if (r.status !== 0)
    throw new Error(`ffmpeg: ${r.stderr?.toString().slice(0, 300)}`);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => path.join(dir, f));
}

type Px = { r: number; g: number; b: number };
type Raster = ReturnType<typeof decodePng>;
const px = (r: Raster, x: number, y: number): Px => {
  const i = (y * r.width + x) * r.channels;
  return r.channels === 1
    ? { r: r.data[i]!, g: r.data[i]!, b: r.data[i]! }
    : { r: r.data[i]!, g: r.data[i + 1]!, b: r.data[i + 2]! };
};
const luma = (p: Px) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

/** First crossing of alpha 0.5, linearly interpolated between the two samples. */
function edge(v: number[], from: number, dir: 1 | -1): number {
  for (let i = from; i >= 0 && i < v.length; i += dir) {
    const a = v[i]!;
    const b = v[i - dir] ?? 0;
    if (a >= 0.5 && b < 0.5) return i - dir * ((0.5 - b) / (a - b));
  }
  return Number.NaN;
}

/**
 * Widest row and tallest column of the darkest object on the page.
 *
 * Taking the *outer* silhouette rather than a row through the centroid is what
 * makes this immune to a label inside the shape: white type on a black pill
 * breaks a centre-row scan and does not touch the edges.
 */
function silhouette(r: Raster) {
  const X0 = Math.round(r.width * 0.35);
  const X1 = Math.round(r.width * 0.65);
  const Y0 = Math.round(r.height * 0.4);
  const Y1 = Math.round(r.height * 0.6);
  const bgL = luma(px(r, 8, 8));
  let fl = 999;
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) fl = Math.min(fl, luma(px(r, x, y)));
  const den = bgL - fl;
  if (den < 20) return null;
  const A = (x: number, y: number) =>
    Math.max(0, Math.min(1, (bgL - luma(px(r, x, y))) / den));
  let w = 0;
  let l = 0;
  let rr = 0;
  let h = 0;
  for (let y = Y0; y < Y1; y++) {
    const v: number[] = [];
    for (let x = 0; x < r.width; x++) v.push(x >= X0 && x < X1 ? A(x, y) : 0);
    const a = edge(v, X0, 1);
    const b = edge(v, X1 - 1, -1);
    if (b - a > w) {
      w = b - a;
      l = a;
      rr = b;
    }
  }
  for (let x = X0; x < X1; x++) {
    const v: number[] = [];
    for (let y = 0; y < r.height; y++) v.push(y >= Y0 && y < Y1 ? A(x, y) : 0);
    const a = edge(v, Y0, 1);
    const b = edge(v, Y1 - 1, -1);
    if (b - a > h) h = b - a;
  }
  return { w, h, cx: (l + rr) / 2 };
}

/**
 * The reference's own presentation timestamps, in seconds.
 *
 * A macOS screen capture is variable-rate — this repo's references run 33ms to
 * 50ms between frames, irregularly — so its frame *n* is not at *n/fps*.
 * Comparing index to index silently slides the two clips apart by up to a third
 * of a second by the end, which reads as "the component's timing is wrong" when
 * the timing is fine and the comparison is not. Every reference frame is matched
 * to the render frame at its own timestamp instead.
 */
function refTimes(file: string): number[] {
  const r = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_entries",
      "frame=pts_time",
      "-of",
      "csv=p=0",
      file,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`ffprobe: ${r.stderr?.slice(0, 300)}`);
  return r.stdout
    .trim()
    .split("\n")
    .map((s) => Number(s.replace(/,$/, "")))
    .filter((v) => Number.isFinite(v));
}

const refs = refFrames(path.resolve(ref));
const times = refTimes(path.resolve(ref));
const first = decodePng(readFileSync(refs[0]!));
const count = Math.min(Number(countArg ?? refs.length), refs.length);
const outDir = outArg ? path.resolve(outArg) : null;
if (outDir) mkdirSync(outDir, { recursive: true });

await ensureBrowser();
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "remotion", "dev-entry.ts"),
  // A component whose cards are `/demos/posters/*.webp` needs the app's own
  // public dir served under the bundle, or every image 404s and the diff is
  // measuring blank boxes.
  publicDir: path.join(root, "public"),
  ignoreRegisterRootWarning: true,
  webpackOverride: (raw) => {
    const config = enableTailwind(raw);
    const existing = Object.entries(config.resolve?.alias ?? {}).map(
      ([name, alias]) => ({
        name: name.replace(/\$$/, ""),
        alias: alias as string,
        onlyModule: name.endsWith("$"),
      }),
    );
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: [...existing, ...tsconfigWebpackAlias(root)],
      },
    };
  },
});
const selected = await selectComposition({ serveUrl, id: slug, inputProps });
/**
 * Reference frame n → the render frame it is *showing*.
 *
 * Floor, not round. A capture presents whatever the page had painted at that
 * instant, so a recorded frame at 0.7583s is still showing content frame 22 of
 * a 30fps page, not 23. The difference is one frame on about a tenth of a
 * variable-rate recording — and it is checkable rather than a matter of taste:
 * where a capture sampled faster than the page rendered, consecutive recorded
 * frames are *byte-identical*, and only `floor` maps every such pair to the
 * same render frame. Rounding splits them across two, and the diff reports a
 * component whose timing is right as being a frame out, twice a second.
 */
const at = (n: number) =>
  Math.min(
    selected.durationInFrames - 1,
    // The epsilon is for ffprobe's printing, not for the timing: it emits
    // 0.033333 for 1/30, which multiplies out to 0.99999 and floors to the
    // wrong frame. Timestamps land on the container's tick grid, so nothing
    // real sits within a thousandth of an integer.
    Math.floor((times[n] ?? n / selected.fps) * selected.fps + 1e-3),
  );
const composition = {
  ...selected,
  width: first.width,
  height: first.height,
  durationInFrames: Math.min(selected.durationInFrames, at(count - 1) + 1),
};

const mine = new Map<number, Uint8Array>();
await renderFrames({
  serveUrl,
  composition,
  inputProps,
  imageFormat: "png",
  outputDir: null,
  onFrameBuffer: (buffer, frame) => {
    mine.set(frame, new Uint8Array(buffer));
  },
  scale: 1,
  frameRange: null,
  concurrency: Number(process.env.REMOTION_CONCURRENCY) || 4,
  onStart: () => {},
  onFrameUpdate: () => {},
});

console.log(
  `${slug} vs ${path.basename(ref)} — ${composition.width}×${composition.height}, ${count} frames\n`,
);
console.log(
  "ref→rnd  meanΔ    maxΔ   %off>8    reference w×h @cx           render w×h @cx",
);
let sum = 0;
let worst = 0;
let worstAt = 0;
for (let n = 0; n < count; n++) {
  const a = decodePng(readFileSync(refs[n]!));
  const buf = mine.get(at(n));
  if (!buf) continue;
  if (outDir)
    writeFileSync(path.join(outDir, `m${String(n).padStart(4, "0")}.png`), buf);
  const b = decodePng(buf);
  let tot = 0;
  let mx = 0;
  let big = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const p = px(a, x, y);
      const q = px(b, x, y);
      const d =
        (Math.abs(p.r - q.r) + Math.abs(p.g - q.g) + Math.abs(p.b - q.b)) / 3;
      tot += d;
      if (d > mx) mx = d;
      if (d > 8) big++;
    }
  }
  const n2 = a.width * a.height;
  const mean = tot / n2;
  sum += mean;
  if (mean > worst) {
    worst = mean;
    worstAt = n;
  }
  const f = (s: ReturnType<typeof silhouette>) =>
    (s
      ? `${s.w.toFixed(2)}×${s.h.toFixed(2)} @${s.cx.toFixed(1)}`
      : "—"
    ).padStart(22);
  console.log(
    `${String(n).padStart(5)}→${String(at(n)).padStart(3)}  ${mean.toFixed(2).padStart(6)}  ${mx.toFixed(0).padStart(6)}  ${((100 * big) / n2).toFixed(2).padStart(7)}   ${f(silhouette(a))}  ${f(silhouette(b))}`,
  );
}
console.log(
  `\nmean over ${count} frames: ${(sum / count).toFixed(3)}   worst: ${worst.toFixed(3)} at frame ${worstAt}`,
);
