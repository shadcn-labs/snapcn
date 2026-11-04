/**
 * Everything below is measured frame by frame off a 1920x1080, 30fps reference.
 * Times are frames, lengths are em unless a comment says otherwise.
 */

/** A word's slide in, as a fraction of `travel`, one entry per frame of its own clock. */
export const ENTRY = [
  1, 0.64, 0.484, 0.374, 0.29, 0.224, 0.172, 0.128, 0.094, 0.066, 0.044, 0.028,
  0.016, 0.008, 0.002, 0,
] as const;

/**
 * Brightness against time, relative to the moment the highlight's centre reaches
 * a point of the line: [frames, level], where 1 is full ink. One curve explains
 * every word of the reference to 0.8% of full scale.
 */
export const SWEEP: readonly (readonly [number, number])[] = [
  [-50, 0.255],
  [-49, 0.271],
  [-45, 0.377],
  [-42, 0.437],
  [-39, 0.467],
  [-31, 0.525],
  [-25, 0.587],
  [-12, 0.806],
  [-5, 0.966],
  [-3, 0.99],
  [0, 1],
  [4, 0.995],
  [6, 0.974],
  [13, 0.81],
  [26, 0.588],
  [33, 0.517],
  [43, 0.462],
  [51, 0.365],
];

/** Default mark: a rounded bolt in a `ICON_BOX` viewBox. */
export const BOLT =
  "M54.13 2.15A5.78 5.78 0 0 1 64.00 7.96L47.41 48.65A1.03 1.03 0 0 0 48.36 50.07L78.20 50.31A4.41 4.41 0 0 1 81.63 57.46L30.83 121.75A5.39 5.39 0 0 1 21.55 116.54L37.50 73.40L6.96 72.69A4.58 4.58 0 0 1 3.50 65.25Z";
export const ICON_BOX: [number, number] = [83.07, 123.79];
