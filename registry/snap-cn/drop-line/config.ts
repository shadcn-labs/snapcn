import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/** 38 frames for four words: the first card 9, the middle cards 7, the last 15. */
export const dropLineConfig: ComponentConfig = {
  componentName: "DropLine",
  importPath: "@/components/snap-cn/drop-line",
  controls: {
    fontSize: {
      type: "number",
      default: 130,
      min: 48,
      max: 240,
      step: 1,
      label: "Font size",
    },
    speed: {
      type: "number",
      default: 1,
      min: 0.25,
      max: 2,
      step: 0.05,
      label: "Speed",
    },
  },
  durationInFrames: 38,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};

export default dropLineConfig;
