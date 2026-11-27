import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const specSweepConfig: ComponentConfig = {
  componentName: "SpecSweep",
  importPath: "@/components/snap-cn/spec-sweep",
  controls: {
    // The line reads lead [icon] highlight connector tail. Any of them may be
    // empty. Long copy shrinks to fit and its words enter faster.
    lead: { type: "text", default: "Ship", label: "Lead" },
    highlight: { type: "text", default: "a launch film", label: "Highlight" },
    connector: { type: "text", default: "in", label: "Connector (dim)" },
    tail: { type: "text", default: "20 minutes", label: "Tail" },
    accentColor: {
      type: "color",
      default: "#3577e0",
      label: "Icon",
      brand: "accent",
    },
    fontFamily: FONT_FAMILY_CONTROL,
    fontSize: {
      type: "number",
      default: 85.15,
      min: 40,
      max: 140,
      step: 1,
      label: "Type size",
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
  durationInFrames: 75,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#0a0a0b" },
};

export default specSweepConfig;
