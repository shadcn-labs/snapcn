import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const titleSweepConfig: ComponentConfig = {
  componentName: "TitleSweep",
  importPath: "@/components/snap-cn/title-sweep",
  controls: {
    fontFamily: FONT_FAMILY_CONTROL,
    fontSize: {
      type: "number",
      default: 110.96,
      min: 40,
      max: 200,
      step: 1,
      label: "Type size",
    },
    fontWeight: {
      type: "number",
      default: 500,
      min: 300,
      max: 800,
      step: 100,
      label: "Weight",
    },
    background: { type: "color", default: "#000000", label: "Background" },
    speed: {
      type: "number",
      default: 1,
      min: 0.25,
      max: 2,
      step: 0.05,
      label: "Speed",
    },
  },
  durationInFrames: 76,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#000000" },
};

export default titleSweepConfig;
