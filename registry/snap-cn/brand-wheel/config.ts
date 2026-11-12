import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const brandWheelConfig: ComponentConfig = {
  componentName: "BrandWheel",
  importPath: "@/components/snap-cn/brand-wheel",
  controls: {
    lead: { type: "text", default: "launch on", label: "Lead word" },
    items: {
      type: "text",
      default: "X, YouTube, LinkedIn, Instagram, TikTok, Product Hunt",
      label: "Brands (comma separated)",
    },
    cursor: { type: "boolean", default: true, label: "Click the last one" },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Theme",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // Six rows: the strip stops at 113.6, the click rings out and the line has
  // slid away by 139. Each extra row adds 20 frames — see `brandWheelDuration`.
  durationInFrames: 139,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
