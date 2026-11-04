export interface SweepStop {
  /** Position in em from the gradient's centre. Positive leads the sweep. */
  at: number;
  /** A concrete colour: this paints in a render. */
  color: string;
}

/** Measured off the reference: black, deep red, orange, a pale band, and back. */
export const DEFAULT_STOPS: SweepStop[] = [
  { at: -17.52, color: "#000000" },
  { at: -16.727, color: "#030200" },
  { at: -15.934, color: "#0d0600" },
  { at: -15.141, color: "#160a00" },
  { at: -14.348, color: "#210c01" },
  { at: -13.482, color: "#2d1001" },
  { at: -12.689, color: "#431502" },
  { at: -11.896, color: "#581902" },
  { at: -11.103, color: "#631d08" },
  { at: -10.31, color: "#88300f" },
  { at: -9.517, color: "#9e3f18" },
  { at: -8.724, color: "#ce5c22" },
  { at: -7.931, color: "#d86629" },
  { at: -7.066, color: "#eb7535" },
  { at: -6.273, color: "#e3793d" },
  { at: -5.479, color: "#db7f47" },
  { at: -4.686, color: "#e6935b" },
  { at: -3.893, color: "#f0a771" },
  { at: -3.1, color: "#f4b784" },
  { at: -2.307, color: "#f1bd8d" },
  { at: -1.514, color: "#eebd8f" },
  { at: -0.721, color: "#e3ae7f" },
  { at: 0.144, color: "#e4a471" },
  { at: 0.937, color: "#ef9c62" },
  { at: 1.73, color: "#eb8c4f" },
  { at: 2.523, color: "#e77f42" },
  { at: 3.317, color: "#e37537" },
  { at: 4.11, color: "#dc6d31" },
  { at: 4.903, color: "#d5652b" },
  { at: 5.696, color: "#d16127" },
  { at: 6.489, color: "#af4c1e" },
  { at: 7.354, color: "#943917" },
  { at: 8.147, color: "#7a2810" },
  { at: 8.94, color: "#671e09" },
  { at: 9.733, color: "#561905" },
  { at: 10.526, color: "#461604" },
  { at: 11.319, color: "#3d1404" },
  { at: 12.112, color: "#2a0f02" },
  { at: 12.906, color: "#1f0d01" },
  { at: 13.771, color: "#130901" },
  { at: 14.564, color: "#0d0601" },
  { at: 15.357, color: "#070400" },
  { at: 16.15, color: "#030100" },
  { at: 16.943, color: "#000000" },
];

/** Gradient centre per frame of a title, in em from the stage centre. Swept off. */
export const SWEEP_FIRST = [
  -6.625, -6.007, -5.192, -4.403, -3.78, -3.342, -2.969, -2.554, -2.033, -1.439,
  -0.862, -0.383, -0.01, 0.344, 0.662, 0.895, 1.061, 1.148, 1.198, 1.326, 1.55,
  1.781, 2.079, 2.506, 3.078, 3.821, 4.705, 5.657, 6.652, 7.781, 9.099, 10.546,
  12.024, 13.444, 14.647, 15.396,
];

/** The same for the last of several titles, which never leaves. */
export const SWEEP_LAST = [
  -17.907, -17.152, -16.058, -14.785, -13.36, -11.904, -10.494, -9.072, -7.668,
  -6.398, -5.281, -4.343, -3.632, -3.026, -2.412, -1.792, -1.193, -0.646,
  -0.196, 0.192, 0.518, 0.747, 0.918, 1.008, 1.048, 1.148, 1.359, 1.621, 1.879,
  2.148, 2.495, 2.889, 3.31, 3.745, 4.168, 4.589, 5.014, 5.441, 5.859, 6.193,
];
