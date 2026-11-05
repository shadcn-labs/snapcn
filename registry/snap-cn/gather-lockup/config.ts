import { type ComponentConfig, H, W } from "@/lib/customizer-config";

export const gatherLockupConfig: ComponentConfig = {
  componentName: "GatherLockup",
  importPath: "@/components/snap-cn/gather-lockup",
  controls: {
    wordmark: { type: "text", default: "snapcn", label: "Wordmark" },
    speed: {
      type: "number",
      default: 1,
      min: 0.25,
      max: 2,
      step: 0.05,
      label: "Speed",
    },
  },
  // The reference is 24fps and cuts between held poses — kept at 24 so every
  // frame here is a frame of the reference.
  durationInFrames: 60,
  fps: 24,
  compositionWidth: W,
  compositionHeight: H,
};

export default gatherLockupConfig;
