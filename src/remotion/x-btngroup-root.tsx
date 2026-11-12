import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Freeze,
  interpolate,
  registerRoot,
  Sequence,
  Series,
  useCurrentFrame,
} from "remotion";
import { mixOklch, type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";
import { SplitButton } from "@/registry/snap-cn/button-press";
import { CursorTrack } from "@/registry/snap-cn/cursor-track";
import { TextSwap } from "@/registry/snap-cn/text-swap";

/**
 * X post "button group" — Wed 11 Nov.
 * Text: "one primary action, the rest in a menu. claude puts 4 equal buttons
 * in a row every time."
 *
 *   Main  frame 0 IS the thumbnail: "Claude ships: 4 equal buttons" over the
 *         row. Then the row morphs in place — Share/Duplicate/Delete fly into
 *         the chevron, Save fills to primary (TextSwap swaps the label) — and
 *         the cursor opens the chevron to show where they went.
 *   End   the two side by side, held: the screenshot frame, and it loops.
 *
 * Sized for a phone: X plays this ~390px wide, so 30px+ type at 720p.
 * Motion is transform/opacity only, on button-press's own ease; the menu open
 * is shadcn's DropdownMenu (fade + zoom-95, ~150ms). The rest is snapcn
 * (SplitButton, CursorTrack, TextSwap).
 */
const { fontFamily: SANS } = loadSans("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});
const STAGE = "#FFFFFF";
const INK = "#0A0A0A";
const MUTED = "#737373";
const RED = "#dc2626";
const EASE = Easing.bezier(0.2, 0.6, 0.35, 1);
const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Geometry at 1280×720.
const H = 96;
const W = 250;
const GAP = 18;
const FONT = 32;
const CY = 410;
const ROW_X = (1280 - (4 * W + 3 * GAP)) / 2;
const CHEV = H * 0.86; // SplitButton's chevron segment
const SPLIT_X = (1280 - (W + CHEV)) / 2;
const CHEV_CX = SPLIT_X + W + CHEV / 2;
const MENU_W = 290;
const ITEM_H = 60;
const PAD = 6;
const MENU_X = SPLIT_X + W + CHEV - MENU_W; // align="end"
const MENU_Y = CY + H / 2 + 10;

const LABELS = ["Save", "Share", "Duplicate", "Delete"];

// Main timeline (frames @30fps). ~3s static at the end of Main is the read time.
const MORPH = 72; // 2.4s to read the "before"
const CLICK = 150; // after the morph has fully landed (~MORPH+46)
const AT_SHARE = CLICK + 30;
const MAIN = 236;
const END = 100;

const Outline = ({ t, label }: { t: SnapCnTheme; label: string }) => (
  <div
    style={{
      width: W,
      height: H,
      borderRadius: t.radius * (H / 36),
      border: `2px solid ${mixOklch(t.border, t.foreground, 0.12)}`,
      background: STAGE,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: INK,
    }}
  >
    {label}
  </div>
);

const Split = ({ t, press = 1 }: { t: SnapCnTheme; press?: number }) => (
  <SplitButton t={t} width={W + CHEV} height={H} press={press}>
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      Save
    </div>
  </SplitButton>
);

/** shadcn DropdownMenuContent: Share, Duplicate, separator, Delete. */
const Menu = ({
  t,
  open = 1,
  hover = -1,
}: {
  t: SnapCnTheme;
  open?: number;
  hover?: number;
}) => {
  const item = (label: string, i: number, danger = false) => (
    <div
      style={{
        height: ITEM_H,
        padding: "0 18px",
        display: "flex",
        alignItems: "center",
        borderRadius: t.radius * 1.4,
        background: hover === i ? t.accent : "transparent",
        color: danger ? RED : INK,
      }}
    >
      {label}
    </div>
  );
  return (
    <div
      style={{
        width: MENU_W,
        padding: PAD,
        borderRadius: t.radius * 2,
        border: `1.5px solid ${t.border}`,
        background: STAGE,
        boxShadow: "0 12px 32px rgba(0,0,0,0.10)",
        opacity: open,
        transform: `translateY(${(1 - open) * -8}px) scale(${0.95 + 0.05 * open})`,
        transformOrigin: "top right",
      }}
    >
      {item("Share", 0)}
      {item("Duplicate", 1)}
      <div style={{ height: 1.5, margin: "6px 0", background: t.border }} />
      {item("Delete", 2, true)}
    </div>
  );
};

const Abs = ({
  x,
  y,
  style,
  children,
}: {
  x: number;
  y: number;
  style?: CSSProperties;
  children: ReactNode;
}) => (
  <div style={{ position: "absolute", left: x, top: y, ...style }}>
    {children}
  </div>
);

const Main = () => {
  const frame = useCurrentFrame();
  const t = useSnapCnTheme(undefined, "light");
  const p = (from: number, len: number) =>
    interpolate(frame, [from, from + len], [0, 1], { ...CLAMP, easing: EASE });

  const save = p(MORPH, 28);
  const fill = p(MORPH + 26, 12);
  const open = p(CLICK + 1, 5);
  const pressP = interpolate(frame, [CLICK, CLICK + 10], [0, 1], CLAMP);
  const press = 1 - Math.sin(pressP * Math.PI) * 0.035;

  const label = (
    <TextSwap
      fromText="Claude ships: 4 equal buttons"
      toText="Fix: 1 primary, the rest in a menu"
      transition="shared-axis-y"
      fontFamily={SANS}
      fontSize={46}
      fontWeight={600}
      color={INK}
      mode="light"
    />
  );

  const path = [
    { at: 0, x: 0.86, y: 1.1, duration: 4 },
    {
      at: CLICK - 26,
      x: CHEV_CX / 1280,
      y: CY / 720,
      duration: 26,
      click: true,
    },
    {
      at: AT_SHARE - 16,
      x: (MENU_X + 120) / 1280,
      y: (MENU_Y + PAD + ITEM_H / 2 + 4) / 720,
      duration: 16,
    },
  ];

  return (
    <CursorTrack path={path} size={34} mode="light">
      <AbsoluteFill
        style={{
          background: STAGE,
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: FONT,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 150,
            height: 120,
          }}
        >
          <Sequence durationInFrames={MORPH}>
            <Freeze frame={0}>{label}</Freeze>
          </Sequence>
          <Sequence from={MORPH}>{label}</Sequence>
        </div>

        {/* Share / Duplicate / Delete fly into the chevron, 5f apart — slow enough to follow. */}
        {LABELS.slice(1).map((l, i) => {
          const k = p(MORPH + i * 5, 24);
          const cx = ROW_X + (i + 1) * (W + GAP) + W / 2;
          return (
            <Abs
              key={l}
              x={cx - W / 2}
              y={CY - H / 2}
              style={{
                transform: `translateX(${(CHEV_CX - cx) * k}px) scale(${1 - 0.7 * k})`,
                opacity: interpolate(k, [0.45, 1], [1, 0], CLAMP),
              }}
            >
              <Outline t={t} label={l} />
            </Abs>
          );
        })}

        {/* Save slides to where the split button's label sits, then fills. */}
        {fill < 1 && (
          <Abs
            x={ROW_X}
            y={CY - H / 2}
            style={{
              transform: `translateX(${(SPLIT_X - ROW_X) * save}px)`,
              opacity: 1 - fill,
            }}
          >
            <Outline t={t} label="Save" />
          </Abs>
        )}
        <Abs x={SPLIT_X} y={CY - H / 2} style={{ opacity: fill }}>
          <Split t={t} press={press} />
        </Abs>

        {frame > CLICK && (
          <Abs x={MENU_X} y={MENU_Y}>
            <Menu t={t} open={open} hover={frame >= AT_SHARE - 3 ? 0 : -1} />
          </Abs>
        )}
      </AbsoluteFill>
    </CursorTrack>
  );
};

/** Both, side by side in time order: the frame people screenshot. */
const End = () => {
  const t = useSnapCnTheme(undefined, "light");
  const tag = (text: string, y: number) => (
    <Abs
      x={0}
      y={y}
      style={{
        width: 1280,
        textAlign: "center",
        fontWeight: 600,
        color: MUTED,
        fontSize: 34,
      }}
    >
      {text}
    </Abs>
  );
  return (
    <AbsoluteFill
      style={{
        background: STAGE,
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: FONT,
      }}
    >
      {/* Same sizes as Main; the two rows stacked and centred (52→660). */}
      <AbsoluteFill>
        {tag("Claude ships", 52)}
        <AbsoluteFill
          style={{
            top: 110,
            flexDirection: "row",
            gap: GAP,
            justifyContent: "center",
          }}
        >
          {LABELS.map((l) => (
            <Outline key={l} t={t} label={l} />
          ))}
        </AbsoluteFill>
        {tag("Fix", 284)}
        <Abs x={SPLIT_X} y={342}>
          <Split t={t} />
        </Abs>
        <Abs x={MENU_X} y={342 + H + 10}>
          <Menu t={t} />
        </Abs>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const XBtnGroup = () => (
  <Series>
    <Series.Sequence durationInFrames={MAIN}>
      <Main />
    </Series.Sequence>
    <Series.Sequence durationInFrames={END}>
      <End />
    </Series.Sequence>
  </Series>
);

export function XBtnGroupRoot() {
  return (
    <Composition
      id="XBtnGroup"
      component={XBtnGroup}
      durationInFrames={MAIN + END}
      fps={30}
      width={1280}
      height={720}
    />
  );
}

registerRoot(XBtnGroupRoot);
