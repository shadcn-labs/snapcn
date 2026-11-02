import type { ReactNode } from "react";
import { AbsoluteFill, Composition, Loop, registerRoot } from "remotion";
import { PortalIntro } from "@/registry/snap-cn/portal-intro";
import { ReelWall } from "@/registry/snap-cn/reel-wall";
import { BlueprintCollage } from "@/registry/snap-cn-pro/blueprint-collage";
import { MarkGrid } from "@/registry/snap-cn-pro/mark-grid";

/**
 * X cut for the 29 Oct post: four components in a 2×2 grid.
 *
 * Each cell renders its component at its own authoring size and scales the
 * box down: most size themselves from `useVideoConfig()` (1920 wide here), but
 * BlueprintCollage is fixed at 1280×720. Short components loop on their own
 * length.
 */
const FPS = 30;
export const LENGTH = 21 * FPS;
const GAP = 8;
const CELL_W = (1920 - GAP * 3) / 2;
const CELL_H = (1080 - GAP * 3) / 2;

const Cell = ({
  col,
  row,
  bg,
  w = 1920,
  children,
}: {
  col: number;
  row: number;
  bg: string;
  w?: number;
  children: ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      left: GAP + col * (CELL_W + GAP),
      top: GAP + row * (CELL_H + GAP),
      width: CELL_W,
      height: CELL_H,
      overflow: "hidden",
      borderRadius: 14,
      background: bg,
    }}
  >
    <div
      style={{
        position: "absolute",
        width: w,
        height: (w * 9) / 16,
        transform: `scale(${CELL_W / w})`,
        transformOrigin: "top left",
      }}
    >
      {children}
    </div>
  </div>
);

export const XGridOct29 = () => (
  <AbsoluteFill style={{ background: "#0a0a0a" }}>
    <Cell col={0} row={0} bg="#DCDCDC" w={1280}>
      <Loop durationInFrames={56}>
        <BlueprintCollage />
      </Loop>
    </Cell>
    <Cell col={1} row={0} bg="#ffffff">
      <Loop durationInFrames={245}>
        <MarkGrid />
      </Loop>
    </Cell>
    <Cell col={1} row={1} bg="#0e0e0e">
      <ReelWall />
    </Cell>
    <Cell col={0} row={1} bg="#ffffff">
      <Loop durationInFrames={108}>
        <PortalIntro />
      </Loop>
    </Cell>
  </AbsoluteFill>
);

registerRoot(() => (
  <Composition
    id="XGridOct29"
    component={XGridOct29}
    durationInFrames={LENGTH}
    fps={FPS}
    width={1920}
    height={1080}
  />
));
