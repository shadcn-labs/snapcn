/**
 * The studio's edit vocabulary — the only things the AI can do to a timeline.
 *
 * The model never writes code and never hands us a timeline. It calls tools;
 * each tool input goes through a `plan*` function here, which either refuses
 * it with a sentence the model can act on or returns a fully-validated
 * `StudioOp`. The server applies ops to a copy of the timeline so the model
 * sees the result of each call, then ships the ops — not the timeline — back to
 * the browser, which replays them with the same `applyOp`. Two reasons:
 *
 * - The browser's clips can hold data-URL images a few MB each. Sending ops
 *   means the reply never carries them, and an update merges into the props the
 *   browser already has instead of overwriting them with a stripped copy.
 * - One reducer on both sides means the preview the user sees is, by
 *   construction, the timeline the model was told about.
 *
 * Pure and dependency-light on purpose: imported by the API route and the
 * client bundle alike.
 */

import type { ControlConfig } from "@/lib/customizer-config";
import { getDefaults } from "@/lib/customizer-config";
import {
  CANVAS,
  type Clip,
  DEFAULT_BACKGROUND,
  isHexColor,
  MAX_CLIP_FRAMES,
  MAX_CLIPS,
  maxFramesForClip,
  remainingFrames,
} from "@/lib/video-editor/types";

/** What the chat shows for a scene: a name and one line of intent. */
export interface Scene {
  title: string;
  note: string;
}

export interface StudioState {
  clips: Clip[];
  /** Keyed by clip id. A clip added by hand has none until the AI names it. */
  scenes: Record<string, Scene>;
}

export type StudioOp =
  | { op: "add"; clip: Clip; scene: Scene; index: number }
  | {
      op: "update";
      id: string;
      props?: Record<string, unknown>;
      durationInFrames?: number;
      background?: string;
      scene?: Partial<Scene>;
    }
  | { op: "remove"; id: string }
  | { op: "move"; id: string; index: number };

/** What a component brings to the planner. */
export interface CatalogEntry {
  controls: ControlConfig;
  durationInFrames: number;
  /** The docs preview's backdrop — the right first canvas colour. */
  backdrop?: string;
}

export type Lookup = (slug: string) => CatalogEntry | undefined;

/**
 * Models the composer offers. Gateway ids, allow-listed: the route maps the
 * key it is sent through this table, so a caller cannot pick an arbitrary
 * (and arbitrarily expensive) model.
 */
export const STUDIO_MODELS = {
  sonnet: { label: "Sonnet 5.5", id: "anthropic/claude-sonnet-5.5" },
  opus: { label: "Opus 5.5", id: "anthropic/claude-opus-5.5" },
  haiku: { label: "Haiku 5.5", id: "anthropic/claude-haiku-5.5" },
} as const;

export type StudioModel = keyof typeof STUDIO_MODELS;
export const DEFAULT_STUDIO_MODEL: StudioModel = "sonnet";

const MAX_TEXT = 500;
const MAX_URL = 2000;
const MAX_TITLE = 80;
const MAX_NOTE = 160;

/**
 * Keep only the props a component declares, each in the shape its control
 * takes. Anything else is dropped, not coerced: a number that arrives as
 * `"big"` is a model mistake, and guessing at it would paint a wrong frame
 * the user then has to find.
 *
 * Images must be https URLs. A data URL from the model would be a hallucinated
 * image, and a URL is all the model can legitimately have been given.
 */
export function coerceProps(
  controls: ControlConfig,
  input: unknown,
): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const ctrl = controls[key];
    if (!ctrl) continue;
    switch (ctrl.type) {
      case "text":
        if (typeof value === "string") out[key] = value.slice(0, MAX_TEXT);
        break;
      case "image":
        if (
          typeof value === "string" &&
          value.length <= MAX_URL &&
          /^https:\/\//i.test(value)
        ) {
          out[key] = value;
        }
        break;
      case "number":
      case "number-input":
        if (typeof value === "number" && Number.isFinite(value)) {
          out[key] = Math.min(ctrl.max, Math.max(ctrl.min, value));
        }
        break;
      case "color":
        if (isHexColor(value)) out[key] = value;
        break;
      case "select":
        if (typeof value === "string" && ctrl.options.includes(value)) {
          out[key] = value;
        }
        break;
      case "boolean":
        if (typeof value === "boolean") out[key] = value;
        break;
    }
  }
  return out;
}

const toFrames = (seconds: number) => Math.round(seconds * CANVAS.fps);

function cleanScene(scene: Partial<Scene>): Partial<Scene> {
  const out: Partial<Scene> = {};
  if (typeof scene.title === "string")
    out.title = scene.title.slice(0, MAX_TITLE);
  if (typeof scene.note === "string") out.note = scene.note.slice(0, MAX_NOTE);
  return out;
}

/** 1-based scene position → clip, or the sentence that explains why not. */
function clipAt(
  state: StudioState,
  scene: number,
): { clip: Clip; index: number } | { error: string } {
  const index = Math.round(scene) - 1;
  const clip = state.clips[index];
  if (!clip) {
    return {
      error: `There is no scene ${scene}; the timeline has ${state.clips.length}.`,
    };
  }
  return { clip, index };
}

export function planAdd(
  state: StudioState,
  input: {
    slug: string;
    title: string;
    note: string;
    seconds?: number;
    props?: unknown;
    background?: string;
    position?: number;
  },
  lookup: Lookup,
  id: string = crypto.randomUUID(),
): { op: StudioOp } | { error: string } {
  const entry = lookup(input.slug);
  if (!entry) return { error: `"${input.slug}" is not in the catalog.` };
  if (state.clips.length >= MAX_CLIPS) {
    return { error: `The timeline is full (${MAX_CLIPS} scenes).` };
  }
  const left = remainingFrames(state.clips);
  if (left < CANVAS.fps) {
    return { error: "The timeline's length budget is spent." };
  }
  const wanted =
    typeof input.seconds === "number" && Number.isFinite(input.seconds)
      ? toFrames(input.seconds)
      : entry.durationInFrames;
  const durationInFrames = Math.max(1, Math.min(wanted, MAX_CLIP_FRAMES, left));
  const background = isHexColor(input.background)
    ? input.background
    : (entry.backdrop ?? DEFAULT_BACKGROUND);
  const index =
    typeof input.position === "number" && Number.isFinite(input.position)
      ? Math.min(
          state.clips.length,
          Math.max(0, Math.round(input.position) - 1),
        )
      : state.clips.length;
  return {
    op: {
      op: "add",
      clip: {
        id,
        slug: input.slug,
        props: {
          ...getDefaults(entry.controls),
          ...coerceProps(entry.controls, input.props),
        },
        durationInFrames,
        background,
      },
      scene: {
        title: (input.title || input.slug).slice(0, MAX_TITLE),
        note: (input.note ?? "").slice(0, MAX_NOTE),
      },
      index,
    },
  };
}

export function planUpdate(
  state: StudioState,
  input: {
    scene: number;
    props?: unknown;
    seconds?: number;
    background?: string;
    title?: string;
    note?: string;
  },
  lookup: Lookup,
): { op: StudioOp } | { error: string } {
  const at = clipAt(state, input.scene);
  if ("error" in at) return at;
  const entry = lookup(at.clip.slug);
  if (!entry) return { error: `Scene ${input.scene} can't be edited.` };
  const op: Extract<StudioOp, { op: "update" }> = {
    op: "update",
    id: at.clip.id,
  };
  const props = coerceProps(entry.controls, input.props);
  if (Object.keys(props).length > 0) op.props = props;
  if (typeof input.seconds === "number" && Number.isFinite(input.seconds)) {
    op.durationInFrames = Math.max(
      1,
      Math.min(
        toFrames(input.seconds),
        maxFramesForClip(state.clips, at.clip.id),
      ),
    );
  }
  if (isHexColor(input.background)) op.background = input.background;
  const scene = cleanScene(input);
  if (Object.keys(scene).length > 0) op.scene = scene;
  if (Object.keys(op).length === 2) {
    return {
      error:
        "Nothing valid to change. Check the prop names and value types against the catalog.",
    };
  }
  return { op };
}

export function planRemove(
  state: StudioState,
  input: { scene: number },
): { op: StudioOp } | { error: string } {
  const at = clipAt(state, input.scene);
  if ("error" in at) return at;
  return { op: { op: "remove", id: at.clip.id } };
}

export function planMove(
  state: StudioState,
  input: { scene: number; to: number },
): { op: StudioOp } | { error: string } {
  const at = clipAt(state, input.scene);
  if ("error" in at) return at;
  const index = Math.min(
    state.clips.length - 1,
    Math.max(0, Math.round(input.to) - 1),
  );
  return { op: { op: "move", id: at.clip.id, index } };
}

/** Apply one already-validated op. No checks — `plan*` did them. */
export function applyOp(state: StudioState, op: StudioOp): StudioState {
  switch (op.op) {
    case "add": {
      const clips = [...state.clips];
      clips.splice(op.index, 0, op.clip);
      return { clips, scenes: { ...state.scenes, [op.clip.id]: op.scene } };
    }
    case "update": {
      const clips = state.clips.map((c) =>
        c.id !== op.id
          ? c
          : {
              ...c,
              props: op.props ? { ...c.props, ...op.props } : c.props,
              durationInFrames: op.durationInFrames ?? c.durationInFrames,
              background: op.background ?? c.background,
            },
      );
      const prev = state.scenes[op.id] ?? { title: "", note: "" };
      const scenes = op.scene
        ? { ...state.scenes, [op.id]: { ...prev, ...op.scene } }
        : state.scenes;
      return { clips, scenes };
    }
    case "remove": {
      const { [op.id]: _gone, ...scenes } = state.scenes;
      return { clips: state.clips.filter((c) => c.id !== op.id), scenes };
    }
    case "move": {
      const from = state.clips.findIndex((c) => c.id === op.id);
      if (from < 0) return state;
      const clips = [...state.clips];
      const [clip] = clips.splice(from, 1);
      clips.splice(op.index, 0, clip);
      return { ...state, clips };
    }
  }
}
