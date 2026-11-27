import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "./tsconfig-webpack-alias.mts";

// node scripts/render-x-nov28.mts <track.mp3> — the track is muxed in afterwards, never bundled.
const AUDIO_FROM = 29.992; // keep in step with src/remotion/x-nov28-root.tsx
const track = process.argv[2];
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(os.homedir(), "Desktop/snapcn/snapcn-nov28.mp4");
const silent = path.join(os.tmpdir(), "snapcn-nov28-silent.mp4");

const serveUrl = await bundle({
  entryPoint: path.join(root, "src/remotion/x-nov28-entry.ts"),
  ignoreRegisterRootWarning: true,
  webpackOverride: (raw) => {
    const c = enableTailwind(raw);
    return {
      ...c,
      resolve: {
        ...c.resolve,
        alias: [
          ...Object.entries(c.resolve?.alias ?? {}).map(([name, alias]) => ({
            name,
            alias: alias as string,
          })),
          ...tsconfigWebpackAlias(root),
        ],
      },
    };
  },
});
const composition = await selectComposition({ serveUrl, id: "XNov28" });
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  crf: 16,
  pixelFormat: "yuv420p",
  concurrency: 6,
  outputLocation: track ? silent : out,
  onProgress: ({ progress }) =>
    process.stdout.write(`\r${(progress * 100).toFixed(0)}%`),
});
if (track) {
  const d = composition.durationInFrames / composition.fps;
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    silent,
    "-ss",
    String(AUDIO_FROM),
    "-t",
    String(d),
    "-i",
    track,
    "-af",
    `afade=t=in:d=0.01,afade=t=out:st=${d - 1.2}:d=1.2`,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "256k",
    "-shortest",
    out,
  ]);
}
console.log(`\n${out}`);
