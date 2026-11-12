import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "./tsconfig-webpack-alias.mts";

// node scripts/render-x-brandwheel.mts <out-dir> [still frames...]  — stills only if frames given.
const root = path.resolve(import.meta.dirname, "..");
const [dir, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/remotion/x-brandwheel-entry.ts"),
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
const composition = await selectComposition({ serveUrl, id: "x-brandwheel" });
if (frames.length) {
  for (const f of frames)
    await renderStill({
      serveUrl,
      composition,
      frame: +f,
      output: path.join(dir, `bw-${f}.png`),
    });
} else {
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: 16,
    pixelFormat: "yuv420p",
    concurrency: 6,
    outputLocation: path.join(dir, "brand-wheel.mp4"),
  });
}
console.log("frames", composition.durationInFrames);
