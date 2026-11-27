import type { ReactNode } from "react";
import { AbsoluteFill, Composition, registerRoot, Sequence } from "remotion";
import { AgentResult } from "@/registry/snap-cn-pro/agent-result";
import { ClearView } from "@/registry/snap-cn-pro/clear-view";
import { EchoStack } from "@/registry/snap-cn-pro/echo-stack";
import { GlassPrompt } from "@/registry/snap-cn-pro/glass-prompt";
import { GLASS_PROMPT_FRAMES } from "@/registry/snap-cn-pro/glass-prompt/config";
import { HypeReel } from "@/registry/snap-cn-pro/hype-reel";
import { LockupReveal } from "@/registry/snap-cn-pro/lockup-reveal";
import { SlamType } from "@/registry/snap-cn-pro/slam-type";

/**
 * X cut for 28 Nov, "Remotion components for Claude Code". 21s, 30fps.
 *
 * Read order: 0-1.8s four hard-cut words say what it is (big enough to read on
 * a phone, a muted autoplay has no audio to help), 1.8-7.4s the 2x2 grid shows
 * what you get, then full-screen Pro scenes, the claim, the URL. (v1 opened on
 * PromptDive: its prompt text was too small to read in the feed.)
 *
 * ## Sync
 * lnplusmusic "brand branding product music", 130.0bpm, muxed from 29.992s
 * (the bar the drums return after a -27dB break) by scripts/render-x-nov28.mts.
 * Frame 0 is that downbeat; beat k at k * B frames. Every cut sits on a beat,
 * every section on an 8-beat phrase:
 *   k0  SlamType: LAUNCH / VIDEOS / WITH / CLAUDE CODE, one word a beat
 *   k4  grid: tiles land on k4, k5, k6, k7
 *   k16 GlassPrompt  k20 ClearView  k24 AgentResult  k28 HypeReel
 *   k32 SlamType claim: REMOTION / COMPONENTS / FOR / CLAUDE CODE, 2 beats each
 *   k40 EchoStack "snapcn.dev", echoes open on k41
 *   k46 end (21.2s)
 */
const FPS = 30;
const B = (FPS * 60) / 130;
const at = (k: number) => Math.round(k * B);
const span = (a: number, b: number) => at(b) - at(a);
export const AUDIO_FROM = 29.992;
export const LENGTH = at(46);

const BLUE = "#1d6bff";
const STOPS: [number, string][] = [
  [-3, "#0b2a6b"],
  [-1.5, BLUE],
  [0, "#9fc0ff"],
  [1.5, BLUE],
  [3, "#0b2a6b"],
];
const GAP = 8;
const CELL_W = (1920 - GAP * 3) / 2;
const CELL_H = (1080 - GAP * 3) / 2;

/** Renders a fixed-size component (w x 16:9) scaled into a box. */
const Fit = ({ w, box, children }: { w: number; box: number; children: ReactNode }) => (
  <div
    style={{
      position: "absolute",
      width: w,
      height: (w * 9) / 16,
      transform: `scale(${box / w})`,
      transformOrigin: "top left",
    }}
  >
    {children}
  </div>
);

const Cell = ({ i, w = 1920, children }: { i: number; w?: number; children: ReactNode }) => (
  <Sequence from={span(4, 4 + i)} layout="none">
    <div
      style={{
        position: "absolute",
        left: GAP + (i % 2) * (CELL_W + GAP),
        top: GAP + Math.floor(i / 2) * (CELL_H + GAP),
        width: CELL_W,
        height: CELL_H,
        overflow: "hidden",
        borderRadius: 14,
        background: "#0e0e10",
      }}
    >
      <Fit w={w} box={CELL_W}>
        {children}
      </Fit>
    </div>
  </Sequence>
);

const Grid = () => (
  <AbsoluteFill style={{ background: "#0a0a0b" }}>
    <Cell i={0} w={1280}>
      <ClearView speed={1.5} />
    </Cell>
    <Cell i={1}>
      <AgentResult speed={1.6} />
    </Cell>
    <Cell i={2}>
      <HypeReel />
    </Cell>
    <Cell i={3}>
      <LockupReveal />
    </Cell>
  </AbsoluteFill>
);

const Scene = ({ k, len = 4, children }: { k: number; len?: number; children: ReactNode }) => (
  <Sequence from={at(k)} durationInFrames={span(k, k + len)}>
    {children}
  </Sequence>
);

export const XNov28 = () => (
  <AbsoluteFill style={{ background: "#0a0a0b" }}>
    <Scene k={0}>
      <SlamType
        words={[
          { text: "LAUNCH", hold: span(0, 1), size: 0.11 },
          { text: "VIDEOS", hold: span(1, 2), size: 0.13 },
          { text: "WITH", hold: span(2, 3), size: 0.16 },
          { text: "CLAUDE CODE", hold: span(3, 4), size: 0.085 },
        ]}
        stops={STOPS}
      />
    </Scene>
    <Scene k={4} len={12}>
      <Grid />
    </Scene>
    <Scene k={16}>
      <GlassPrompt speed={GLASS_PROMPT_FRAMES / span(16, 20)} />
    </Scene>
    <Scene k={20}>
      <Fit w={1280} box={1920}>
        <ClearView speed={2} headline="Launch day, handled" answer="Here’s yours" />
      </Fit>
    </Scene>
    {/* v3: RenderWall + ScreenWall (light, busy) out; dark scenes that tell the story. */}
    <Scene k={24}>
      <AgentResult speed={2.7} />
    </Scene>
    <Scene k={28}>
      <HypeReel />
    </Scene>
    {/* v3: TrendType's midnight theme drifted to purple; bookend the opening slam in brand blue. */}
    <Scene k={32} len={8}>
      <SlamType
        words={[
          { text: "REMOTION", hold: span(32, 34), size: 0.1 },
          { text: "COMPONENTS", hold: span(34, 36), size: 0.08 },
          { text: "FOR", hold: span(36, 38), size: 0.16 },
          { text: "CLAUDE CODE", hold: span(38, 40), size: 0.085 },
        ]}
        stops={STOPS}
      />
    </Scene>
    <Scene k={40} len={6}>
      <EchoStack text="snapcn.dev" palette="midnight" mode="dark" hold={span(40, 41) * 2} />
    </Scene>
  </AbsoluteFill>
);

registerRoot(() => (
  <Composition id="XNov28" component={XNov28} durationInFrames={LENGTH} fps={FPS} width={1920} height={1080} />
));
