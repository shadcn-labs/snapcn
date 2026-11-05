import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/** Four seconds: the wall blooms, cuts in on the logo, falls away to the lockup. */
export const bloomLockupConfig: ComponentConfig = {
  componentName: "BloomLockup",
  importPath: "@/components/snap-cn/bloom-lockup",
  controls: {
    wordmark: { type: "text", default: "snapcn", label: "Wordmark" },
    tagline: { type: "text", default: "snapcn.dev", label: "Tagline" },
    speed: {
      type: "number",
      default: 1,
      min: 0.25,
      max: 2,
      step: 0.05,
      label: "Speed",
    },
  },
  durationInFrames: 120,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};

export default bloomLockupConfig;
