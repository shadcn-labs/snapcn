import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/** 57 frames: the line takes itself apart, the page washes off, the logo lands. */
export const skyLockupConfig: ComponentConfig = {
  componentName: "SkyLockup",
  importPath: "@/components/snap-cn/sky-lockup",
  controls: {
    before: {
      type: "text",
      default: "your animations",
      label: "Before the mark",
    },
    after: { type: "text", default: "as one install", label: "After the mark" },
    wordmark: { type: "text", default: "snapcn", label: "Wordmark" },
    logoSrc: {
      type: "image",
      // Empty = no logo: the snapcn mark beside the wordmark snapcn, no mark
      // beside any other. A brand kit's logo lands here.
      default: "",
      label: "Logo",
      brand: "logo",
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
  durationInFrames: 57,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};

export default skyLockupConfig;
