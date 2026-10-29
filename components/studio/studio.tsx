"use client";

import type { PlayerRef } from "@remotion/player";
import {
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Layers,
  LayoutGrid,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  SlidersHorizontal,
  SquarePen,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Group,
  type LayoutStorage,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { SnapCnLogo } from "@/components/snapcn-logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { X_URL } from "@/config/site";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTrackEvent } from "@/lib/analytics";
import { getDefaults } from "@/lib/customizer-config";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import { lookup } from "@/lib/studio/catalog";
import {
  applyOp,
  DEFAULT_STUDIO_MODEL,
  planAdd,
  planMove,
  planRemove,
  type Scene,
  type StudioModel,
  type StudioOp,
  type StudioState,
} from "@/lib/studio/ops";
import { cn } from "@/lib/utils";
import { EMPTY_BRAND } from "@/lib/video-editor/brand";
import type { EditorDraft } from "@/lib/video-editor/draft";
import { DEFAULT_FONT } from "@/lib/video-editor/fonts";
import { DEFAULT_TEMPO } from "@/lib/video-editor/tempo";
import {
  type AudioTrack,
  CANVAS,
  MAX_CLIPS,
  maxFramesForClip,
  remainingFrames,
} from "@/lib/video-editor/types";
import registry from "@/registry/__index__";
import { LibraryPanel } from "../video-editor/library-panel";
import { PropertiesPanel } from "../video-editor/properties-panel";
import { useEditorExport } from "../video-editor/use-editor-export";
import { useProjects } from "../video-editor/use-projects";
import {
  clipStarts,
  type Region,
  StudioCanvas,
  sceneName,
} from "./studio-canvas";
import { type ChatMessage, type Snapshot, StudioChat } from "./studio-chat";

/**
 * The library defaults to `localStorage` and reads it during render, which
 * throws on the server — and on the client it reads it during hydration too,
 * so the saved split mismatches the server HTML and React keeps the server's.
 * Until mount the layout comes from nowhere; after it, from here.
 */
const noStorage: LayoutStorage = { getItem: () => null, setItem: () => {} };
const layoutStorage: LayoutStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Blocked storage: the layout just doesn't persist.
    }
  },
};

const pct = (v: number) => Math.round(v * 100);

/** What the camera pinned, in words the model can act on. */
function describeSnapshot(
  state: StudioState,
  frame: number,
  region: Region | null,
): Snapshot | null {
  const starts = clipStarts(state.clips);
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= frame) i++;
  const clip = state.clips[i];
  if (!clip) return null;
  const at = (frame / CANVAS.fps).toFixed(2);
  const into = ((frame - starts[i]) / CANVAS.fps).toFixed(2);
  const where = region
    ? `the region ${pct(region.x)}–${pct(region.x + region.w)}% across, ${pct(region.y)}–${pct(region.y + region.h)}% down`
    : "the whole frame";
  return {
    label: `Scene ${i + 1} · ${at}s${region ? " · region" : ""}`,
    prompt: `[Snapshot] The user is pointing at ${where} of scene ${i + 1} ("${sceneName(clip, state.scenes)}", ${clip.slug}) at ${at}s of the video, ${into}s into the scene. Their note is about that.`,
  };
}

const chatKey = (projectId: string | null) =>
  `snapcn-studio-chat:${projectId ?? "draft"}`;

/** Long strings are uploaded images; the AI only needs to know one is there. */
function slimProps(props: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [
      k,
      typeof v === "string" && v.length > 2000 ? "[image]" : v,
    ]),
  );
}

/** The lines behind "Edited the timeline", named against the timeline as it was. */
function describeOps(ops: StudioOp[], before: StudioState): string[] {
  let state = before;
  return ops.map((op) => {
    const clip = "id" in op ? state.clips.find((c) => c.id === op.id) : null;
    const name = clip ? sceneName(clip, state.scenes) : "a scene";
    let line: string;
    switch (op.op) {
      case "add":
        line = `Added ${op.scene.title} (${ITEM_BY_SLUG.get(op.clip.slug)?.name ?? op.clip.slug})`;
        break;
      case "update": {
        const what = [
          ...Object.keys(op.props ?? {}),
          op.durationInFrames ? "length" : null,
          op.background ? "background" : null,
          op.scene ? "name" : null,
        ].filter(Boolean);
        line = `Changed ${name}: ${what.join(", ")}`;
        break;
      }
      case "remove":
        line = `Removed ${name}`;
        break;
      case "move":
        line = `Moved ${name} to position ${op.index + 1}`;
        break;
    }
    state = applyOp(state, op);
    return line;
  });
}

export function Studio({
  signedIn,
  canRemoveWatermark,
}: {
  signedIn: boolean;
  canRemoveWatermark: boolean;
}) {
  const [tl, setTl] = useState<StudioState>({ clips: [], scenes: {} });
  const [audio, setAudio] = useState<AudioTrack | null>(null);
  const [font, setFont] = useState(DEFAULT_FONT);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [model, setModel] = useState<StudioModel>(DEFAULT_STUDIO_MODEL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspector, setInspector] = useState<"scene" | "scenes" | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  /** Phone: canvas over chat, no dividers. */
  const stacked = useIsMobile();
  /** No room for a 340px column: the inspector becomes a bottom sheet. */
  const narrow = useIsMobile(1024);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const layout = useDefaultLayout({
    id: "snapcn-studio",
    panelIds: chatOpen ? ["chat", "canvas"] : ["canvas"],
    storage: mounted ? layoutStorage : noStorage,
    onlySaveAfterUserInteractions: true,
  });
  const { exporting, progress, download } = useEditorExport();
  const trackEvent = useTrackEvent();

  // The AI turn resolves seconds after it was sent; it must read the timeline
  // as it is then, not as it was when the closure was made.
  const tlRef = useRef(tl);
  tlRef.current = tl;

  useEffect(() => {
    trackEvent("ai_studio_opened");
  }, [trackEvent]);

  // The studio is dark, like every editing surface people are used to — and
  // forced on <html> rather than a wrapper so menus and popovers, which portal
  // to <body>, are dark too. Put back on the way out.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, []);

  /** Whether the next project switch should load that project's chat. */
  const pendingLoad = useRef(false);
  const loadedKey = useRef<string | undefined>(undefined);

  const restore = useCallback((draft: EditorDraft | null) => {
    setTl({
      clips: (draft?.clips ?? []).map((clip) => {
        const controls = registry[clip.slug]?.config.controls;
        return controls
          ? { ...clip, props: { ...getDefaults(controls), ...clip.props } }
          : clip;
      }),
      scenes: {},
    });
    setAudio(draft?.audio ?? null);
    setFont(draft?.font ?? DEFAULT_FONT);
    setSelectedId(null);
    if (draft) {
      pendingLoad.current = true;
    } else {
      setMessages([]);
      pendingLoad.current = false;
    }
  }, []);

  // Same projects as the timeline editor — a video made here opens there, and
  // the other way round. The chat isn't part of the project row; it lives in
  // this browser, keyed by project.
  const projects = useProjects({
    signedIn,
    clips: tl.clips,
    audio,
    font,
    brand: EMPTY_BRAND,
    tempo: DEFAULT_TEMPO,
    onRestore: restore,
  });

  // Load the chat that belongs to the project now open. A project that just
  // got its id from its first save keeps the chat it was born in instead.
  useEffect(() => {
    if (!projects.ready) return;
    const key = chatKey(projects.currentId);
    if (key === loadedKey.current) return;
    const load = loadedKey.current === undefined || pendingLoad.current;
    pendingLoad.current = false;
    loadedKey.current = key;
    if (!load) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as {
        messages?: ChatMessage[];
        scenes?: Record<string, Scene>;
      } | null;
      setMessages(saved?.messages ?? []);
      setTl((prev) => ({ ...prev, scenes: saved?.scenes ?? {} }));
    } catch {
      setMessages([]);
    }
  }, [projects.ready, projects.currentId]);

  useEffect(() => {
    const key = loadedKey.current;
    if (!key) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ messages: messages.slice(-60), scenes: tl.scenes }),
      );
    } catch {
      // Storage full or blocked: the chat is a convenience, the video is saved.
    }
  }, [messages, tl.scenes]);

  const selectedIndex = tl.clips.findIndex((c) => c.id === selectedId);
  const selected = selectedIndex >= 0 ? tl.clips[selectedIndex] : null;

  const selectScene = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const i = tlRef.current.clips.findIndex((c) => c.id === id);
      if (i >= 0) player?.seekTo(clipStarts(tlRef.current.clips)[i]);
      setInspector("scene");
    },
    [player],
  );

  const send = useCallback(
    async (
      text: string,
      base?: ChatMessage[],
      shot: Snapshot | null = base ? null : snapshot,
    ) => {
      const user: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        ...(shot ? { snapshot: shot } : {}),
      };
      if (!base) setSnapshot(null);
      const history = [...(base ?? messages), user];
      setMessages(history);
      setPending(true);
      const before = tlRef.current;
      let reply: ChatMessage;
      let status = 0;
      let ops: StudioOp[] = [];
      try {
        const res = await fetch("/api/studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history
              .filter((m) => !m.error && m.content)
              .map(({ role, content, snapshot: shot }) => ({
                role,
                content: shot ? `${shot.prompt}\n\n${content}` : content,
              })),
            clips: before.clips.map((c) => ({
              ...c,
              props: slimProps(c.props),
            })),
            scenes: before.scenes,
            selected: selectedIndex >= 0 ? selectedIndex + 1 : null,
            model,
          }),
        });
        status = res.status;
        const data = (await res.json().catch(() => ({}))) as {
          text?: string;
          ops?: StudioOp[];
          error?: string;
        };
        ops = data.ops ?? [];
        // Replayed onto the timeline as it is *now*: an edit the user made
        // while the AI was thinking stays, and an op aimed at a scene they
        // deleted meanwhile finds nothing and does nothing.
        if (ops.length > 0) setTl((prev) => ops.reduce(applyOp, prev));
        reply = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.text ?? data.error ?? "Something went wrong.",
          added: ops.flatMap((op) => (op.op === "add" ? [op.scene] : [])),
          log: describeOps(ops, before),
          error: res.status === 401 ? "signin" : res.ok ? undefined : "failed",
        };
      } catch {
        reply = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Couldn't reach the studio. Check your connection and try again.",
          error: "failed",
        };
      }
      setMessages((prev) => [...prev, reply]);
      setPending(false);
      trackEvent("ai_studio_prompted", {
        model,
        ops: ops.length,
        status,
        scene_count: before.clips.length,
      });
    },
    [messages, model, selectedIndex, snapshot, trackEvent],
  );

  const retry = useCallback(() => {
    const lastUser = messages.findLastIndex((m) => m.role === "user");
    if (lastUser < 0) return;
    const m = messages[lastUser];
    void send(m.content, messages.slice(0, lastUser), m.snapshot ?? null);
  }, [messages, send]);

  const addByHand = useCallback((slug: string) => {
    const planned = planAdd(
      tlRef.current,
      { slug, title: ITEM_BY_SLUG.get(slug)?.name ?? slug, note: "" },
      lookup,
    );
    if ("error" in planned) return;
    setTl((prev) => applyOp(prev, planned.op));
    setLibraryOpen(false);
    if (planned.op.op === "add") setSelectedId(planned.op.clip.id);
  }, []);

  const runOp = useCallback((planned: { op: StudioOp } | { error: string }) => {
    if (!("error" in planned)) setTl((prev) => applyOp(prev, planned.op));
  }, []);

  const updateSelected = useCallback(
    (
      patch: (
        clip: StudioState["clips"][number],
      ) => StudioState["clips"][number],
    ) =>
      setTl((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === selectedId ? patch(c) : c)),
      })),
    [selectedId],
  );

  const onExport = () =>
    download(tl.clips, {
      removeWatermark: canRemoveWatermark,
      font,
      audio,
      onDownloaded: () => setExported(true),
    });

  const chatEl = (
    <StudioChat
      title={projects.title}
      titleEditable={projects.enabled}
      onTitleChange={projects.setTitle}
      onTitleCommit={projects.commitTitle}
      messages={messages}
      pending={pending}
      pendingLabel={tl.clips.length === 0 ? "Storyboarding" : "Directing"}
      onSend={(text) => void send(text)}
      onRetry={retry}
      model={model}
      onModel={setModel}
      selectedLabel={
        selected
          ? `Scene ${selectedIndex + 1} · ${sceneName(selected, tl.scenes)}`
          : null
      }
      onClearSelection={() => setSelectedId(null)}
      snapshotLabel={snapshot?.label ?? null}
      onClearSnapshot={() => setSnapshot(null)}
      onOpenLibrary={() => setLibraryOpen(true)}
    />
  );

  const canvasEl = (
    <StudioCanvas
      title={projects.title}
      clips={tl.clips}
      scenes={tl.scenes}
      selectedId={selectedId}
      onSelect={selectScene}
      player={player}
      onPlayer={setPlayer}
      watermark={!canRemoveWatermark}
      font={font}
      audio={audio}
      exporting={exporting}
      progress={progress}
      onExport={onExport}
      exported={exported}
      onDismissExported={() => setExported(false)}
      inspectorOpen={inspector !== null}
      onToggleInspector={() =>
        setInspector((v) => (v === null ? "scene" : null))
      }
      onSnapshot={(frame, region) => {
        const shot = describeSnapshot(tlRef.current, frame, region);
        if (!shot) return;
        setSnapshot(shot);
        setChatOpen(true);
      }}
    />
  );

  const inspectorEl = (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1 px-3">
        <TabButton
          active={inspector === "scene"}
          onClick={() => setInspector("scene")}
        >
          Scene
        </TabButton>
        <TabButton
          active={inspector === "scenes"}
          onClick={() => setInspector("scenes")}
        >
          All scenes
        </TabButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {inspector === "scene" ? (
          <PropertiesPanel
            clip={selected}
            maxFrames={selected ? maxFramesForClip(tl.clips, selected.id) : 1}
            onPropChange={(key, value) =>
              updateSelected((c) => ({
                ...c,
                props: { ...c.props, [key]: value },
              }))
            }
            onDurationChange={(frames) =>
              updateSelected((c) => ({
                ...c,
                durationInFrames: Math.min(
                  maxFramesForClip(tl.clips, c.id),
                  Math.max(1, frames),
                ),
              }))
            }
            onBackgroundChange={(background) =>
              updateSelected((c) => ({ ...c, background }))
            }
            onFontChange={(next) =>
              updateSelected((c) => {
                if (next === null) {
                  const { font: _dropped, ...rest } = c;
                  return rest;
                }
                return { ...c, font: next };
              })
            }
            videoFont={font}
          />
        ) : (
          <SceneList
            state={tl}
            selectedId={selectedId}
            onSelect={selectScene}
            onMove={(i, dir) =>
              runOp(planMove(tl, { scene: i + 1, to: i + 1 + dir }))
            }
            onRemove={(i) => runOp(planRemove(tl, { scene: i + 1 }))}
          />
        )}
      </div>
    </>
  );

  return (
    // `fixed inset-0`: the studio is an application, so it takes the whole
    // viewport — over the site-wide banners the root layout mounts, which in
    // a document flow would push the transport off the bottom of the screen.
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-[#0f0f0f] text-[#eeeeee]">
      {sidebarOpen && (
        <aside className="hidden w-[238px] shrink-0 flex-col px-2 pt-3 pb-2 lg:flex">
          <div className="flex h-8 items-center justify-between pl-2">
            <Link href="/" className="flex items-center gap-2">
              <SnapCnLogo className="h-5" />
              <span className="text-[14px] font-medium text-[#eeeeee]">
                Studio
              </span>
            </Link>
            <SideIcon
              label="Hide sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose className="size-4" />
            </SideIcon>
          </div>

          <nav className="mt-4 flex flex-col gap-0.5">
            <NavRow icon={Clapperboard} label="Videos" active />
            <NavRow
              icon={LayoutGrid}
              label="Components"
              href="/docs/components"
            />
            <NavRow
              icon={SquarePen}
              label="Timeline editor"
              href="/docs/video-editor"
            />
          </nav>

          <button
            type="button"
            onClick={() => void projects.newProject()}
            className="mt-4 flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#f2f2f2] text-[13px] font-medium text-[#111] transition-colors hover:bg-white"
          >
            <Plus className="size-4" />
            New Video…
          </button>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <p className="px-2 pb-1 text-[12px] text-[#6b6b6b]">Your videos</p>
            {projects.enabled ? (
              projects.projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  title={p.title}
                  when={p.updatedAt}
                  active={p.id === projects.currentId}
                  onOpen={() => void projects.openProject(p.id)}
                />
              ))
            ) : (
              <ProjectRow title={projects.title} active onOpen={() => {}} />
            )}
          </div>

          <div className="flex flex-col gap-0.5 pt-2">
            {!signedIn && (
              <NavRow
                icon={SquarePen}
                label="Sign in to save videos"
                href="/signin?callbackUrl=%2Fstudio"
              />
            )}
            <NavRow icon={MessageSquare} label="Send feedback" href={X_URL} />
          </div>
        </aside>
      )}

      <main
        className={cn(
          "relative m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#222] bg-[#171717] md:flex-row",
          sidebarOpen && "lg:ml-0",
        )}
      >
        {!sidebarOpen && (
          <div className="absolute top-2 left-2 z-30 hidden lg:block">
            <SideIcon label="Show sidebar" onClick={() => setSidebarOpen(true)}>
              <PanelLeft className="size-4" />
            </SideIcon>
          </div>
        )}

        {stacked ? (
          // Phone: the canvas on top, the chat under it — no dividers to drag.
          <>
            <section className="order-first h-[45dvh] min-w-0">
              {canvasEl}
            </section>
            {chatOpen && (
              <section className="flex min-h-0 flex-1 flex-col">
                {chatEl}
              </section>
            )}
          </>
        ) : (
          // Chat | canvas on a draggable divider, as the reference's shell;
          // the split is remembered per browser.
          <Group
            // Re-mounted once after hydration, to pick up the saved split.
            key={mounted ? "client" : "server"}
            className="min-w-0 flex-1"
            defaultLayout={layout.defaultLayout}
            onLayoutChanged={layout.onLayoutChanged}
          >
            {chatOpen && (
              <>
                <Panel
                  id="chat"
                  defaultSize="400px"
                  minSize="320px"
                  maxSize="60%"
                  className={cn("flex flex-col", !sidebarOpen && "lg:pl-8")}
                >
                  {chatEl}
                </Panel>
                <Separator className="relative w-px bg-[#232323] outline-none transition-colors after:absolute after:inset-y-0 after:-left-1 after:w-2 hover:bg-[#3a3a3a] focus-visible:bg-[#38b2e8] data-[separator=active]:bg-[#38b2e8]" />
              </>
            )}
            <Panel id="canvas" minSize="400px">
              {canvasEl}
            </Panel>
          </Group>
        )}

        {inspector && !narrow && (
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-[#232323] bg-[#171717]">
            {inspectorEl}
          </aside>
        )}

        <div className="hidden w-11 shrink-0 flex-col items-center gap-1 border-l border-[#232323] py-2 md:flex">
          <SideIcon
            label="All scenes"
            active={inspector === "scenes"}
            onClick={() =>
              setInspector((v) => (v === "scenes" ? null : "scenes"))
            }
          >
            <Layers className="size-4" />
          </SideIcon>
          <SideIcon
            label="Scene properties"
            active={inspector === "scene"}
            onClick={() =>
              setInspector((v) => (v === "scene" ? null : "scene"))
            }
          >
            <SlidersHorizontal className="size-4" />
          </SideIcon>
          <div className="mt-auto">
            <SideIcon
              label={chatOpen ? "Hide chat" : "Show chat"}
              active={!chatOpen}
              onClick={() => setChatOpen((v) => !v)}
            >
              <PanelLeft className="size-4" />
            </SideIcon>
          </div>
        </div>
      </main>

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent
          side="left"
          className="w-[340px] bg-background p-0 sm:max-w-[340px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Add a scene</SheetTitle>
          </SheetHeader>
          <LibraryPanel
            onAdd={addByHand}
            budgetFrames={
              tl.clips.length >= MAX_CLIPS ? 0 : remainingFrames(tl.clips)
            }
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={narrow && inspector !== null}
        onOpenChange={(open) => !open && setInspector(null)}
      >
        <SheetContent
          side="bottom"
          className="flex max-h-[70dvh] flex-col bg-[#171717] p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Inspector</SheetTitle>
          </SheetHeader>
          {inspectorEl}
        </SheetContent>
      </Sheet>

      <Toaster />
    </div>
  );
}

function SceneList({
  state,
  selectedId,
  onSelect,
  onMove,
  onRemove,
}: {
  state: StudioState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  if (state.clips.length === 0) {
    return (
      <p className="p-6 text-center text-[13px] text-[#8a8a8a]">
        No scenes yet. Describe your video in the chat.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-0.5 p-2">
      {state.clips.map((clip, i) => (
        <li
          key={clip.id}
          className={cn(
            "group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#2a2a2a]",
            clip.id === selectedId && "bg-[#262626]",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(clip.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="font-mono text-[11px] text-[#6b6b6b]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[#e6e6e6]">
              {sceneName(clip, state.scenes)}
            </span>
            <span className="font-mono text-[11px] text-[#8a8a8a]">
              {(clip.durationInFrames / CANVAS.fps).toFixed(1)}s
            </span>
          </button>
          <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <SideIcon label="Move up" onClick={() => onMove(i, -1)}>
              <ArrowUp className="size-3.5" />
            </SideIcon>
            <SideIcon label="Move down" onClick={() => onMove(i, 1)}>
              <ArrowDown className="size-3.5" />
            </SideIcon>
            <SideIcon label="Remove" onClick={() => onRemove(i)}>
              <Trash2 className="size-3.5" />
            </SideIcon>
          </span>
        </li>
      ))}
    </ol>
  );
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ProjectRow({
  title,
  when,
  active,
  onOpen,
}: {
  title: string;
  when?: string;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-[#cfcfcf] transition-colors hover:bg-[#2a2a2a]",
        active && "bg-[#1f1f1f] text-[#eeeeee]",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {when && (
        <span className="shrink-0 text-[11px] text-[#6b6b6b]">
          {relativeTime(when)}
        </span>
      )}
    </button>
  );
}

function NavRow({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  active?: boolean;
}) {
  const className = cn(
    "flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-[#a0a0a0] transition-colors hover:bg-[#2a2a2a] hover:text-[#eeeeee]",
    active && "bg-[#242424] text-[#eeeeee]",
  );
  const body = (
    <>
      <Icon className="size-4" />
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <span className={className}>{body}</span>
  );
}

function SideIcon({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md text-[#a0a0a0] transition-colors hover:bg-[#2a2a2a] hover:text-[#eeeeee]",
        active && "bg-[#262626] text-[#eeeeee]",
      )}
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-2.5 text-[13px] text-[#a0a0a0] transition-colors hover:bg-[#2a2a2a]",
        active && "bg-[#262626] text-[#eeeeee]",
      )}
    >
      {children}
    </button>
  );
}
