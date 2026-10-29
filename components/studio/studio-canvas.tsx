"use client";

import { Player, type PlayerRef } from "@remotion/player";
import {
  Camera,
  Download,
  Expand,
  Hand,
  Loader2,
  Minus,
  MousePointer2,
  PanelRight,
  Pause,
  Play,
  Plus,
  Ruler,
  Scan,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import type { Scene } from "@/lib/studio/ops";
import { cn } from "@/lib/utils";
import {
  type AudioTrack,
  CANVAS,
  type Clip,
  totalDuration,
} from "@/lib/video-editor/types";
import { VideoTimeline } from "../video-editor/video-timeline";

/** Room above the artboard for the toolbar and the artboard's label. */
const TOP_SPACE = 92;
/** Room below it for the transport card. */
const BOTTOM_SPACE = 150;
const ZOOM_STEP = 1.25;
const SPEEDS = [1, 1.5, 2, 0.5] as const;

export function sceneName(clip: Clip, scenes: Record<string, Scene>): string {
  return (
    scenes[clip.id]?.title || ITEM_BY_SLUG.get(clip.slug)?.name || clip.slug
  );
}

/** Frame each clip starts on — the timeline is a plain sequence. */
export function clipStarts(clips: Clip[]): number[] {
  let at = 0;
  return clips.map((c) => {
    const start = at;
    at += c.durationInFrames;
    return start;
  });
}

function indexAt(starts: number[], frame: number): number {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= frame) i++;
  return i;
}

/** `00:28.40` — minutes, seconds, hundredths, the way the reference reads. */
function timecode(frame: number): string {
  const secs = frame / CANVAS.fps;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const cs = Math.floor((secs * 100) % 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * The Player's frame, subscribed where it is read.
 *
 * Only the overlay and the transport re-render at 30fps; the canvas holding
 * the `<Player>` does not, which keeps the composition from re-rendering with
 * every frame it paints.
 */
function usePlayerFrame(player: PlayerRef | null): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) =>
      setFrame(e.detail.frame);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onFrame);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onFrame);
    };
  }, [player]);
  return frame;
}

export function StudioCanvas({
  title,
  clips,
  scenes,
  selectedId,
  onSelect,
  player,
  onPlayer,
  watermark,
  font,
  audio,
  exporting,
  progress,
  onExport,
  exported,
  onDismissExported,
  inspectorOpen,
  onToggleInspector,
  onSnapshot,
}: {
  title: string;
  clips: Clip[];
  scenes: Record<string, Scene>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  player: PlayerRef | null;
  onPlayer: (player: PlayerRef | null) => void;
  watermark: boolean;
  font: string;
  audio: AudioTrack | null;
  exporting: boolean;
  progress: number;
  onExport: () => void;
  exported: boolean;
  onDismissExported: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  /** Frame under the playhead, and the dragged region as 0–1 fractions. */
  onSnapshot: (frame: number, region: Region | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"select" | "hand" | "camera">("select");
  const [rulers, setRulers] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = Math.max(
    0.05,
    Math.min(
      (size.w - 96) / CANVAS.width,
      (size.h - TOP_SPACE - BOTTOM_SPACE) / CANVAS.height,
    ),
  );
  const scale = zoom === "fit" ? fit : zoom;
  const boxW = CANVAS.width * scale;
  const boxH = CANVAS.height * scale;
  const originX = (size.w - boxW) / 2 + pan.x;
  const originY =
    TOP_SPACE +
    Math.max(0, (size.h - TOP_SPACE - BOTTOM_SPACE - boxH) / 2) +
    pan.y;

  const zoomBy = (factor: number) =>
    setZoom(Math.min(4, Math.max(0.05, scale * factor)));
  const refit = () => {
    setZoom("fit");
    setPan({ x: 0, y: 0 });
  };

  // Memoised for the same reason the editor's is: a fresh object here
  // re-renders the whole composition, soundtrack included.
  const inputProps = useMemo(
    () => ({ clips, watermark, audio, font }),
    [clips, watermark, audio, font],
  );

  const drag = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className={cn(
        "grid h-full min-h-0 min-w-0 bg-[#171717]",
        rulers
          ? "grid-cols-[24px_minmax(0,1fr)] grid-rows-[24px_minmax(0,1fr)]"
          : "grid-cols-[0_minmax(0,1fr)] grid-rows-[0_minmax(0,1fr)]",
      )}
    >
      <div className="border-r border-b border-[#232323]" />
      <div className="relative overflow-hidden border-b border-[#232323]">
        {rulers && (
          <RulerTicks axis="x" length={size.w} origin={originX} scale={scale} />
        )}
      </div>
      <div className="relative overflow-hidden border-r border-[#232323]">
        {rulers && (
          <RulerTicks axis="y" length={size.h} origin={originY} scale={scale} />
        )}
      </div>

      <div
        ref={stageRef}
        className={cn(
          "relative min-h-0 overflow-hidden",
          tool === "hand" && "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={(e) => {
          if (tool !== "hand") return;
          drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPan({
            x: e.clientX - drag.current.x,
            y: e.clientY - drag.current.y,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {/* Toolbar + export share a row that wraps, so a narrow canvas
            (chat dragged wide, inspector open) stacks them instead of
            painting one over the other. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2 *:pointer-events-auto">
          <div className="flex items-center gap-0.5 rounded-lg bg-[#222] p-1 text-[13px] text-[#cfcfcf]">
            <ToolButton
              label="Hand tool"
              active={tool === "hand"}
              onClick={() => setTool(tool === "hand" ? "select" : "hand")}
            >
              <Hand className="size-4" />
            </ToolButton>
            <ToolButton label="Fit to screen" onClick={refit}>
              <span className="px-1">Fit</span>
            </ToolButton>
            <ToolButton label="Recentre" onClick={() => setPan({ x: 0, y: 0 })}>
              <Scan className="size-4" />
            </ToolButton>
            <ToolButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
              <Minus className="size-4" />
            </ToolButton>
            <span className="w-12 text-center font-mono text-[12px] tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <ToolButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
              <Plus className="size-4" />
            </ToolButton>
            <ToolButton
              label="Select tool"
              active={tool === "select"}
              onClick={() => setTool("select")}
            >
              <MousePointer2 className="size-4" />
            </ToolButton>
            <ToolButton
              label={rulers ? "Hide rulers" : "Show rulers"}
              active={rulers}
              onClick={() => setRulers((v) => !v)}
            >
              <Ruler className="size-4" />
            </ToolButton>
            <ToolButton
              label={tool === "camera" ? "Cancel snapshot" : "Snapshot"}
              active={tool === "camera"}
              disabled={clips.length === 0}
              onClick={() => setTool(tool === "camera" ? "select" : "camera")}
            >
              <Camera className="size-4" />
            </ToolButton>
            <ToolButton
              label="Fullscreen"
              onClick={() => player?.requestFullscreen()}
            >
              <Expand className="size-4" />
            </ToolButton>
          </div>

          {/* Export */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={exporting || clips.length === 0}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#f2f2f2] px-3 text-[13px] font-medium text-[#111] transition-colors hover:bg-white disabled:opacity-45"
            >
              {exporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {Math.round(progress * 100)}%
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Export
                </>
              )}
            </button>
            <ToolButton
              label={inspectorOpen ? "Hide inspector" : "Show inspector"}
              active={inspectorOpen}
              onClick={onToggleInspector}
            >
              <PanelRight className="size-4" />
            </ToolButton>
          </div>
        </div>

        {/* Artboard */}
        <div
          className="absolute"
          style={{ left: originX, top: originY - 28, width: boxW }}
        >
          <div className="flex h-7 items-center justify-between text-[13px] text-[#a0a0a0]">
            <span className="truncate">{title}</span>
            <span className="shrink-0 tabular-nums">
              {CANVAS.width} × {CANVAS.height}
            </span>
          </div>
          <div
            className="relative bg-black"
            style={{ width: boxW, height: boxH }}
          >
            {clips.length > 0 ? (
              <Player
                ref={onPlayer}
                component={VideoTimeline}
                inputProps={inputProps}
                durationInFrames={totalDuration(clips)}
                fps={CANVAS.fps}
                compositionWidth={CANVAS.width}
                compositionHeight={CANVAS.height}
                style={{ width: "100%", height: "100%" }}
                playbackRate={speed}
                clickToPlay={false}
                doubleClickToFullscreen={false}
                spaceKeyToPlayOrPause
                loop
                acknowledgeRemotionLicense
              />
            ) : (
              <div className="grid size-full place-items-center bg-[#0f0f0f] text-[clamp(14px,3vw,40px)] tracking-tight text-[#e8e8e8]">
                snapcn.dev
              </div>
            )}
            {clips.length > 0 && (
              <SelectionOverlay
                player={player}
                clips={clips}
                selectedId={selectedId}
                onSelect={onSelect}
                passThrough={tool === "hand"}
              />
            )}
            {tool === "camera" && (
              <SnapshotOverlay
                onCapture={(region) => {
                  setTool("select");
                  onSnapshot(player?.getCurrentFrame() ?? 0, region);
                }}
              />
            )}
          </div>
          {exported && (
            <div className="mt-3 flex items-center justify-center gap-3 text-[13px] text-[#a0a0a0]">
              <span>Exported</span>
              <span className="font-mono text-[#d0d0d0]">snapcn-video.mp4</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={onDismissExported}
                className="rounded p-0.5 hover:bg-[#2a2a2a]"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Transport */}
        <div className="absolute right-3 bottom-3 left-3 z-20">
          <Transport
            player={player}
            clips={clips}
            scenes={scenes}
            selectedId={selectedId}
            speed={speed}
            onSpeed={() =>
              setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])
            }
          />
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-7 min-w-7 place-items-center rounded-md text-[#cfcfcf] transition-colors hover:bg-[#2a2a2a] disabled:pointer-events-none disabled:opacity-40",
        active && "bg-[#2e2e2e] text-white",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Ticks in composition pixels, so the numbers mean the same thing at any zoom.
 * The step is the smallest that keeps labels ~64px apart on screen.
 */
function RulerTicks({
  axis,
  length,
  origin,
  scale,
}: {
  axis: "x" | "y";
  length: number;
  origin: number;
  scale: number;
}) {
  const step =
    [25, 50, 100, 200, 250, 500, 1000, 2000].find((s) => s * scale >= 64) ??
    2000;
  const minor = step / 4;
  const from = Math.floor(-origin / scale / step) * step;
  const to = (length - origin) / scale;
  const ticks: number[] = [];
  for (let v = from; v <= to && ticks.length < 400; v += minor) ticks.push(v);

  return ticks.map((v) => {
    const pos = origin + v * scale;
    const major = v % step === 0;
    return axis === "x" ? (
      <div key={v} className="absolute top-0 bottom-0" style={{ left: pos }}>
        <div
          className={cn(
            "absolute bottom-0 w-px bg-[#3a3a3a]",
            major ? "h-2" : "h-1",
          )}
        />
        {major && (
          <span className="absolute top-1 left-1 font-mono text-[10px] text-[#6b6b6b]">
            {v}
          </span>
        )}
      </div>
    ) : (
      <div key={v} className="absolute right-0 left-0" style={{ top: pos }}>
        <div
          className={cn(
            "absolute right-0 h-px bg-[#3a3a3a]",
            major ? "w-2" : "w-1",
          )}
        />
        {major && (
          <span
            className="absolute top-1 left-1 font-mono text-[10px] text-[#6b6b6b]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {v}
          </span>
        )}
      </div>
    );
  });
}

/**
 * Click the frame to select the scene under the playhead — a scene is the
 * smallest thing the studio edits, so it is what "select" means here. The
 * selected scene gets the reference's bounds, handles and size label.
 */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Below this many screen pixels a drag is a click — same call as the reference. */
const DRAG_THRESHOLD = 6;

/**
 * The armed camera: click takes the whole frame, drag takes a region. Sits
 * above the selection overlay so neither the click nor the drag selects.
 */
function SnapshotOverlay({
  onCapture,
}: {
  onCapture: (region: Region | null) => void;
}) {
  const [box, setBox] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const point = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      px: r,
    };
  };
  const rect = box && {
    x: Math.min(box.x0, box.x1),
    y: Math.min(box.y0, box.y1),
    w: Math.abs(box.x1 - box.x0),
    h: Math.abs(box.y1 - box.y0),
  };

  return (
    <button
      type="button"
      aria-label="Click to snapshot the frame, or drag to snapshot a region"
      className="absolute inset-0 z-10 cursor-crosshair bg-[#38b2e8]/5 outline-1 outline-[#38b2e8]"
      // Keyboard press (detail 0): the whole frame. Pointer clicks are
      // handled by pointerup, which also knows whether it was a drag.
      onClick={(e) => {
        if (e.detail === 0) onCapture(null);
      }}
      onPointerDown={(e) => {
        const p = point(e);
        setBox({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!box) return;
        const p = point(e);
        setBox({ ...box, x1: p.x, y1: p.y });
      }}
      onPointerUp={(e) => {
        if (!box || !rect) return;
        const { px } = point(e);
        const dragged =
          rect.w * px.width >= DRAG_THRESHOLD ||
          rect.h * px.height >= DRAG_THRESHOLD;
        setBox(null);
        onCapture(dragged ? rect : null);
      }}
    >
      {rect && (
        <span
          className="pointer-events-none absolute border border-[#38b2e8] bg-[#38b2e8]/15"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          }}
        />
      )}
    </button>
  );
}

function SelectionOverlay({
  player,
  clips,
  selectedId,
  onSelect,
  passThrough,
}: {
  player: PlayerRef | null;
  clips: Clip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  passThrough: boolean;
}) {
  const frame = usePlayerFrame(player);
  const starts = clipStarts(clips);
  const current = clips[indexAt(starts, frame)];
  const isSelected = current && current.id === selectedId;

  return (
    <button
      type="button"
      aria-label="Select the scene under the playhead"
      className={cn("absolute inset-0", passThrough && "pointer-events-none")}
      onClick={() => current && onSelect(isSelected ? null : current.id)}
    >
      {isSelected && (
        <span className="pointer-events-none absolute inset-0 outline-1 outline-[#38b2e8]">
          {(
            [
              "-top-1 -left-1",
              "-top-1 -right-1",
              "-bottom-1 -left-1",
              "-bottom-1 -right-1",
            ] as const
          ).map((corner) => (
            <span
              key={corner}
              className={cn(
                "absolute size-2 border border-[#38b2e8] bg-[#171717]",
                corner,
              )}
            />
          ))}
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded bg-[#38b2e8] px-1.5 py-0.5 font-mono text-[11px] text-[#0b2633]">
            {CANVAS.width} × {CANVAS.height}
          </span>
        </span>
      )}
    </button>
  );
}

function Transport({
  player,
  clips,
  scenes,
  selectedId,
  speed,
  onSpeed,
}: {
  player: PlayerRef | null;
  clips: Clip[];
  scenes: Record<string, Scene>;
  selectedId: string | null;
  speed: number;
  onSpeed: () => void;
}) {
  const frame = usePlayerFrame(player);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!player) return;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    player.addEventListener("play", on);
    player.addEventListener("pause", off);
    return () => {
      player.removeEventListener("play", on);
      player.removeEventListener("pause", off);
    };
  }, [player]);

  const total = totalDuration(clips);
  const starts = clipStarts(clips);
  const current = indexAt(starts, frame);
  const selected = clips.find((c) => c.id === selectedId);

  const seekFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !player) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    player.seekTo(Math.round(ratio * (total - 1)));
  };
  const jump = (dir: -1 | 1) => {
    if (!player || clips.length === 0) return;
    // Back from mid-scene goes to that scene's start, as every player does.
    const target =
      dir === -1 && frame - starts[current] > CANVAS.fps / 2
        ? current
        : Math.min(clips.length - 1, Math.max(0, current + dir));
    player.seekTo(starts[target]);
  };

  return (
    <div className="rounded-xl bg-[#222] px-4 pt-3 pb-2.5">
      <div className="relative h-5 text-[12px]">
        {clips.map((clip, i) => (
          <span
            key={clip.id}
            className={cn(
              "absolute top-0 truncate pr-2",
              i === current ? "text-[#eeeeee]" : "text-[#8a8a8a]",
            )}
            style={{
              left: `${(starts[i] / total) * 100}%`,
              maxWidth: `${(clip.durationInFrames / total) * 100}%`,
            }}
          >
            {sceneName(clip, scenes)}
          </span>
        ))}
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={frame}
        className="relative mt-1 h-8 cursor-pointer rounded-md bg-[#2c2c2c] select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seekFromPointer(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight")
            player?.seekTo(Math.min(total - 1, frame + 1));
          if (e.key === "ArrowLeft") player?.seekTo(Math.max(0, frame - 1));
        }}
      >
        {starts.slice(1).map((s) => (
          <span
            key={s}
            className="absolute top-0 h-2 w-px bg-[#5a5a5a]"
            style={{ left: `${(s / total) * 100}%` }}
          />
        ))}
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-[12px] tabular-nums text-[#d8d8d8]">
          {timecode(frame)}
        </span>
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-[12px] tabular-nums text-[#8a8a8a]">
          {timecode(total)}
        </span>
        <span
          className="pointer-events-none absolute top-1 bottom-1 w-[3px] -translate-x-1/2 rounded-full bg-white"
          style={{ left: `${(frame / Math.max(1, total - 1)) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-1 text-[#cfcfcf]">
        <ToolButton label="Previous scene" onClick={() => jump(-1)}>
          <SkipBack className="size-4" />
        </ToolButton>
        <ToolButton
          label={playing ? "Pause" : "Play"}
          onClick={() => player?.toggle()}
        >
          {playing ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </ToolButton>
        <ToolButton label="Next scene" onClick={() => jump(1)}>
          <SkipForward className="size-4" />
        </ToolButton>
        <span className="flex-1 truncate px-2 text-center text-[12px] text-[#8a8a8a]">
          {selected
            ? `Editing ${sceneName(selected, scenes)}`
            : clips.length > 0
              ? "Click the canvas to select a scene"
              : "Describe a video to get your first cut"}
        </span>
        <ToolButton label="Playback speed" onClick={onSpeed}>
          <span className="px-1 font-mono text-[12px]">{speed}×</span>
        </ToolButton>
        <ToolButton
          label={muted ? "Unmute" : "Mute"}
          onClick={() => {
            if (!player) return;
            if (player.isMuted()) player.unmute();
            else player.mute();
            setMuted(player.isMuted());
          }}
        >
          {muted ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </ToolButton>
        <ToolButton
          label="Fullscreen"
          onClick={() => player?.requestFullscreen()}
        >
          <Expand className="size-4" />
        </ToolButton>
      </div>
    </div>
  );
}
