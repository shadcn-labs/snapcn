import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/** 38 frames for four words: the first card 9, the middle cards 7, the last 15. */
export const dropLineConfig: ComponentConfig = {
  componentName: "DropLine",
  importPath: "@/components/snap-cn/drop-line",
  controls: {
    // One card per `,`; the last drops. 9 frames for the first card, 7 for each
    // middle one, 15 for the last: `timeline(n).end` in the component.
    words: {
      type: "text",
      default: "then, ships, the, film",
      label: "Words (comma separated)",
    },
    fontSize: {
      type: "number",
      default: 130,
      min: 48,
      max: 240,
      step: 1,
      label: "Font size",
    },
    mode: {
      type: "select",
      default: "dark",
      options: ["light", "dark"],
      label: "Mode",
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
