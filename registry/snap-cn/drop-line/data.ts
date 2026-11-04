/**
 * Every number here was measured off a 1920x1080 reference, one sample per frame.
 * Sizes and offsets are px on that stage.
 */

export const FONT_SIZE = 130;
/** Where the type sits at rest. */
export const BASELINE = 574.5;

/** Frames each card holds: the first, every word between, the last. */
export const HOLDS = { first: 9, word: 7, last: 15 } as const;

/** The first word lands low and rises into place: px below rest, per frame. */
export const RISE = [70, 43, 22.8, 13, 7.2, 3.7, 1.55, 0.45, 0] as const;

/** The last card, frame by frame: how far the word has sunk. The dot stays put. */
export const DROP = [
  0, 0, 0, 0, 0.38, 1.25, 2.54, 4.4, 6.91, 10.27, 14.57, 20.23, 27.57, 37.53,
  51.55,
] as const;

/** Between the x-height and the dot, in em above the baseline, where no face is told. */
export const DOT_LINE = 0.585;
