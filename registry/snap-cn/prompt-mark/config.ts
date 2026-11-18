import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const promptMarkConfig: ComponentConfig = {
  componentName: "PromptMark",
  importPath: "@/components/snap-cn/prompt-mark",
  controls: {
    text: { type: "text", default: "Ship a demo", label: "Prompt" },
    name: { type: "text", default: "snapcn", label: "Name" },
    mode: {
      type: "select",
      default: "dark",
      options: ["dark", "light"],
      label: "Opens in",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // Type, pan to send, the mark, the flash (125 frames, as recorded), then the
  // lockup settles by 150 and holds.
  durationInFrames: 175,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
