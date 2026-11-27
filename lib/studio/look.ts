import type { StudioOp, StudioState } from "./ops";
import { GROUND, type Mode, SCENES } from "./scene-data";

/**
 * One look for a whole video, applied by the studio — not chosen by the model.
 *
 * The model used to write colours scene by scene, and the user's verdict was
 * that choosing a theme is "where you failed completely": a dark-mode scene
 * with a white pill and invisible text, a grey glow smeared across a dark
 * frame. Colour is now deterministic:
 *
 * - The video has one mode, read off the product's own CSS (`site-theme.ts`).
 * - Each clip gets the measured keys that make that component correct in that
 *   mode (`scene-data.json`): set `mode`, and UNSET the pinned colour defaults
 *   that would otherwise override it.
 * - Every clip's canvas is the mode's ground, so cuts don't flash between
 *   near-whites and near-blacks.
 * - A screenshot is never zoomed past its headline: laptop-frame's
 *   zoom-to-screen finale is turned off when it carries an image.
 *
 * Pure; the server applies it after casting, the client after a mode toggle.
 */
export function lookOps(
  state: StudioState,
  mode: Mode,
  only?: Set<string>,
): StudioOp[] {
  const ops: StudioOp[] = [];
  for (const clip of state.clips) {
    if (only && !only.has(clip.id)) continue;
    const keys = SCENES[clip.slug]?.[mode];
    if (!keys) continue;
    const props: Record<string, unknown> = { ...keys.set };
    if (
      clip.slug === "laptop-frame" &&
      typeof clip.props.screenSrc === "string" &&
      clip.props.screenSrc !== ""
    ) {
      props.finale = "none";
      // And shown whole: under `cover` the lid crops a wide card's headline.
      props.screenFit = "contain";
    }
    ops.push({
      op: "update",
      id: clip.id,
      unset: keys.unset,
      props,
      background: GROUND[mode],
    });
  }
  return ops;
}
