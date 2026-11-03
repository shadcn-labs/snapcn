import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

export const cutLockupConfig: ComponentConfig = {
  componentName: "CutLockup",
  importPath: "@/components/snap-cn/cut-lockup",
  controls: {
    size: {
      type: "number",
      default: 0.2335,
      min: 0.1,
      max: 0.5,
      step: 0.005,
      label: "Logo width",
    },
    ink: { type: "color", default: "#1f1f1f", label: "Ink" },
    night: { type: "color", default: "#242424", label: "Night" },
    endPaper: { type: "color", default: "#f8f8f8", label: "Paper" },
    roughness: {
      type: "number",
      default: 0.35,
      min: 0,
      max: 2,
      step: 0.05,
      label: "Print roughness",
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
  durationInFrames: 108,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#f8f8f8" },
};

export default cutLockupConfig;
