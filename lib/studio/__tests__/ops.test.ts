import { describe, expect, it } from "vitest";
import type { ControlConfig } from "@/lib/customizer-config";
import { MAX_TOTAL_FRAMES } from "@/lib/video-editor/types";
import {
  applyOp,
  coerceProps,
  type Lookup,
  planAdd,
  planMove,
  planUpdate,
  type StudioState,
} from "../ops";

const controls: ControlConfig = {
  text: { type: "text", default: "Hello", label: "Text" },
  size: {
    type: "number",
    default: 10,
    min: 0,
    max: 100,
    step: 1,
    label: "Size",
  },
  color: { type: "color", default: "#000000", label: "Color" },
  mode: { type: "select", default: "a", options: ["a", "b"], label: "Mode" },
  logo: { type: "image", default: "", label: "Logo" },
};
const lookup: Lookup = (slug) =>
  slug === "title" ? { controls, durationInFrames: 90 } : undefined;
const empty: StudioState = { clips: [], scenes: {} };

describe("coerceProps", () => {
  it("keeps declared props in their control's shape and drops the rest", () => {
    expect(
      coerceProps(controls, {
        text: "Ship it",
        size: 500,
        color: "red",
        mode: "c",
        logo: "data:image/png;base64,AAAA",
        unknown: 1,
      }),
    ).toEqual({ text: "Ship it", size: 100 });
  });
});

describe("plan + apply", () => {
  it("adds a scene with defaults under the model's props, then edits and reorders", () => {
    const a = planAdd(
      empty,
      { slug: "title", title: "Open", note: "Hook", props: { text: "Hi" } },
      lookup,
      "a",
    );
    if ("error" in a) throw new Error(a.error);
    let state = applyOp(empty, a.op);
    expect(state.clips[0]).toMatchObject({
      id: "a",
      props: { text: "Hi", size: 10, mode: "a" },
      durationInFrames: 90,
    });

    const b = planAdd(
      state,
      { slug: "title", title: "Close", note: "" },
      lookup,
      "b",
    );
    if ("error" in b) throw new Error(b.error);
    state = applyOp(state, b.op);

    const u = planUpdate(
      state,
      { scene: 1, props: { size: 20 }, title: "Opening" },
      lookup,
    );
    if ("error" in u) throw new Error(u.error);
    state = applyOp(state, u.op);
    expect(state.clips[0].props).toMatchObject({ text: "Hi", size: 20 });
    expect(state.scenes.a).toEqual({ title: "Opening", note: "Hook" });

    const m = planMove(state, { scene: 2, to: 1 });
    if ("error" in m) throw new Error(m.error);
    state = applyOp(state, m.op);
    expect(state.clips.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("refuses what it can't do in words the model can act on", () => {
    expect(
      planAdd(empty, { slug: "nope", title: "", note: "" }, lookup),
    ).toEqual({
      error: '"nope" is not in the catalog.',
    });
    expect(planUpdate(empty, { scene: 3 }, lookup)).toEqual({
      error: "There is no scene 3; the timeline has 0.",
    });
  });

  it("caps a requested length at what the frame budget has left", () => {
    const a = planAdd(
      empty,
      { slug: "title", title: "", note: "", seconds: 10_000 },
      lookup,
    );
    if ("error" in a) throw new Error(a.error);
    expect(a.op.op === "add" && a.op.clip.durationInFrames).toBeLessThanOrEqual(
      MAX_TOTAL_FRAMES,
    );
  });
});
