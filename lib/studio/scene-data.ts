import data from "./scene-data.json";

/**
 * What each studio component does on screen, measured — not described.
 *
 * Every number here came off rendered frames through the studio's own
 * `video-timeline` (2026-11-27; method and sheets in the commit that added this
 * file):
 *
 * - **Theme.** The keys that make a component correct in light and in dark, or
 *   null where it is broken in that mode. The studio seeds every colour default
 *   into a clip's props, and those pinned light colours override `mode` — set
 *   `mode: "dark"` and 19 components still painted dark ink or a light ground.
 *   So a theme is a `set` AND an `unset`: drop the pinned keys and the
 *   component's own `useSnapCnTheme(mode)` palette takes over. (`roster-grant`
 *   and `wordmark-cut` declare a `theme` select they ignore; they read `mode`.)
 * - **Timing**, in the component's own frames at speed 1. `firstContentFrame`:
 *   the first frame worth cutting to (a cut on a blank intro reads as a dip to
 *   nothing). `hitFrame`: where the scene lands — the title settles, the button
 *   is clicked. `exitStartFrame`: where content starts to leave; anything after
 *   is a tail the next cut can replace.
 * - **Speed.** `null` where the component has no speed control or ignores it
 *   (9 of them do).
 * - **imageMinVisible.** The smallest share of a wide 1200×630 screenshot the
 *   component ever shows. Below ~0.85 it crops or zooms the headline away.
 */

export type Mode = "light" | "dark";

export interface ThemeKeys {
  set: Record<string, unknown>;
  unset: string[];
}

export interface SceneData {
  light: ThemeKeys | null;
  dark: ThemeKeys | null;
  firstContentFrame: number;
  hitFrame: number;
  exitStartFrame: number;
  naturalFrames: number;
  speed: { min: number; max: number } | null;
  imageMinVisible?: number;
  /**
   * A repeating internal step — a word, card or title changing at a fixed
   * interval (component frames at speed 1). `prop` names the control that
   * sets the interval when `speed` doesn't (card-rail's `every`).
   */
  step?: { first: number; frames: number; prop?: string };
}

export const SCENES = data as Record<string, SceneData>;

/** The canvas behind a clip in each mode — the shadcn page colours. */
export const GROUND: Record<Mode, string> = {
  light: "#faf9f6",
  dark: "#0a0a0a",
};

/**
 * Measured broken in this mode → false. Not measured at all (a Pro scene) →
 * true: unknown is not the same as broken, and refusing every unmeasured
 * scene would refuse the whole Pro tier.
 */
export function supportsMode(slug: string, mode: Mode): boolean {
  const scene = SCENES[slug];
  return scene ? Boolean(scene[mode]) : true;
}

/** A wide screenshot shows whole in this component (no crop, no zoom-away). */
export const IMAGE_WHOLE_AT = 0.85;

export function showsImageWhole(slug: string): boolean {
  return (SCENES[slug]?.imageMinVisible ?? 0) >= IMAGE_WHOLE_AT;
}
