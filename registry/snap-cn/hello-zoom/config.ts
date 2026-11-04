import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const helloZoomConfig: ComponentConfig = {
  componentName: "HelloZoom",
  importPath: "@/components/snap-cn/hello-zoom",
  controls: {
    words: {
      type: "text",
      default: "React, Remotion, shadcn, Next.js, Vite, Tailwind, TypeScript",
      label: "Flicker words (comma-separated)",
    },
    lead: { type: "text", default: "Hello", label: "Lead word" },
    rest: { type: "text", default: "snapcn.", label: "Typed on" },
    nextWord: { type: "text", default: "npx", label: "Next card" },
    fontFamily: FONT_FAMILY_CONTROL,
    fontWeight: {
      type: "number",
      default: 700,
      min: 500,
      max: 800,
      step: 100,
      label: "Font weight",
    },
    // what the light theme resolves to; the component reads the theme when unset
    inkColor: { type: "color", default: "#141414", label: "Ink" },
    paperColor: { type: "color", default: "#faf9f6", label: "Paper" },
    speed: {
      type: "number",
      default: 1,
      min: 0.5,
      max: 2,
      step: 0.05,
      label: "Speed",
    },
  },
  durationInFrames: 75,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#141414" },
};

export default helloZoomConfig;
