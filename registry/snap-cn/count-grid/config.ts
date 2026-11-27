import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * The component's own card faces (`OWN_CARDS` in index.tsx), as the `|` string
 * the control takes: each still interleaved with a showcase frame. Clear the
 * field for neutral cards drawn from the theme.
 */
const ART = [
  "https://media.snapcn.dev/demos/showcase/438b9e6b50654a44d404fbf358c26e9f.webp",
  "https://media.snapcn.dev/demos/showcase/5e5305b05bd405a0d89570725434099e.webp",
  "https://media.snapcn.dev/demos/showcase/767d99bb371a54d0d36751e8cecae43c.jpg",
  "https://media.snapcn.dev/demos/showcase/821d815affa6496c39cbdeeec7a84603.jpg",
  "https://media.snapcn.dev/demos/showcase/937438c560ada1c83317f2c11b3454b0.jpg",
  "https://media.snapcn.dev/demos/showcase/98f89cb9994f5c382ab964062c4039db.jpg",
  "https://media.snapcn.dev/demos/showcase/b25b82db2892efff9be3204e860d30ee.jpg",
  "https://media.snapcn.dev/demos/showcase/c9ebc6337aa2268ac4b357f9cb1ac547.jpg",
];
const STILLS = [
  "https://media.snapcn.dev/demos/posters/agent-steps.webp",
  "https://media.snapcn.dev/demos/posters/announce-title.webp",
  "https://media.snapcn.dev/demos/posters/answer-highlight.webp",
  "https://media.snapcn.dev/demos/posters/answer-stream.webp",
  "https://media.snapcn.dev/demos/posters/block-wordmark.webp",
  "https://media.snapcn.dev/demos/posters/cursor-track.webp",
  "https://media.snapcn.dev/demos/posters/follower-rush.webp",
  "https://media.snapcn.dev/demos/posters/hero-launch.webp",
  "https://media.snapcn.dev/demos/posters/karaoke-captions.webp",
  "https://media.snapcn.dev/demos/posters/laptop-frame.webp",
  "https://media.snapcn.dev/demos/posters/logo-assemble.webp",
  "https://media.snapcn.dev/demos/posters/logo-drift.webp",
  "https://media.snapcn.dev/demos/posters/logo-flicker.webp",
  "https://media.snapcn.dev/demos/posters/moodboard-reveal.webp",
  "https://media.snapcn.dev/demos/posters/orbit-gallery.webp",
  "https://media.snapcn.dev/demos/posters/phone-frame.webp",
  "https://media.snapcn.dev/demos/posters/prompt-send.webp",
  "https://media.snapcn.dev/demos/posters/prompt-zoom.webp",
  "https://media.snapcn.dev/demos/posters/punch-lines.webp",
  "https://media.snapcn.dev/demos/posters/screen-recording.webp",
  "https://media.snapcn.dev/demos/posters/search-typing.webp",
  "https://media.snapcn.dev/demos/posters/status-cycle.webp",
  "https://media.snapcn.dev/demos/posters/terminal-simulator.webp",
  "https://media.snapcn.dev/demos/posters/text-build.webp",
  "https://media.snapcn.dev/demos/posters/text-highlight.webp",
  "https://media.snapcn.dev/demos/posters/text-reveal.webp",
  "https://media.snapcn.dev/demos/posters/text-rewrite.webp",
  "https://media.snapcn.dev/demos/posters/text-select.webp",
  "https://media.snapcn.dev/demos/posters/text-swap.webp",
  "https://media.snapcn.dev/demos/posters/text-swell.webp",
  "https://media.snapcn.dev/demos/posters/type-morph.webp",
  "https://media.snapcn.dev/demos/posters/word-captions.webp",
  "https://media.snapcn.dev/demos/posters/word-flip.webp",
];
const CARDS = STILLS.flatMap((s, i) => [ART[i % ART.length], s]).join("|");

export const countGridConfig: ComponentConfig = {
  componentName: "CountGrid",
  importPath: "@/components/snap-cn/count-grid",
  controls: {
    from: { type: "text", default: "5", label: "Count before" },
    to: { type: "text", default: "500", label: "Count after" },
    noun: { type: "text", default: "clips", label: "Noun" },
    cards: {
      type: "text",
      default: CARDS,
      label: "Card images (| separated, empty = neutral)",
    },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
    speed: {
      type: "number",
      default: 1,
      min: 0.4,
      max: 2,
      step: 0.05,
      label: "Speed",
    },
  },
  durationInFrames: 47,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#FDFDFD" },
};
