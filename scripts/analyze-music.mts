/**
 * Measure the studio's stock tracks: beat grid, downbeats, bars, energy, drop,
 * loudness. Writes `lib/studio/music-library.json`, which the studio cuts to.
 *
 *   node scripts/analyze-music.mts <dir> [<dir> …]
 *   CLICKS=<outDir> …   also writes each track with a click on every beat
 *                       (accent on the downbeat) — listen to verify the grid.
 *
 * Why measured, not read off a title or a tag: a film cut to a 152 BPM grid
 * from a README drifted 200ms off a track that measured 150 (Nov 23 film).
 * Produced stock music runs at one tempo, so the whole track is fitted as one
 * grid — offset + period — against its onsets, which is far steadier than
 * tracking beats one by one; the fit residual says how true that assumption is.
 *
 * No Python, no DSP dependency: ffmpeg decodes, the rest is a 1024-point FFT
 * and arithmetic.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SR = 22050;
const N = 1024;
const HOP = 256;
const FPS_ENV = SR / HOP; // onset-envelope samples per second (~86.1)

// ---------------------------------------------------------------------------
// Decode + spectrum
// ---------------------------------------------------------------------------

function decode(file: string): Float32Array {
  const raw = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      file,
      "-ac",
      "1",
      "-ar",
      String(SR),
      "-f",
      "f32le",
      "-",
    ],
    { maxBuffer: 1 << 30 },
  );
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

interface Envelopes {
  /** Full-band spectral flux of log magnitude — where anything hits. */
  onset: Float64Array;
  /** Flux below ~150 Hz — where the kick hits; downbeats live here. */
  low: Float64Array;
  /** RMS per envelope frame. */
  rms: Float64Array;
}

function envelopes(x: Float32Array): Envelopes {
  const frames = Math.max(0, Math.floor((x.length - N) / HOP));
  const onset = new Float64Array(frames);
  const low = new Float64Array(frames);
  const rms = new Float64Array(frames);
  const win = new Float64Array(N).map(
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N),
  );
  const lowBins = Math.ceil((150 / SR) * N);
  let prev = new Float64Array(N / 2);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = x[f * HOP + i];
      e += v * v;
      re[i] = v * win[i];
      im[i] = 0;
    }
    rms[f] = Math.sqrt(e / N);
    fft(re, im);
    const mag = new Float64Array(N / 2);
    let flux = 0;
    let lowFlux = 0;
    for (let k = 1; k < N / 2; k++) {
      mag[k] = Math.log1p(1000 * Math.hypot(re[k], im[k]));
      const d = mag[k] - prev[k];
      if (d > 0) {
        flux += d;
        if (k <= lowBins) lowFlux += d;
      }
    }
    onset[f] = flux;
    low[f] = lowFlux;
    prev = mag;
  }
  return { onset: detrend(onset), low: detrend(low), rms };
}

/** Subtract a ~0.5s moving average and clip at 0: keeps the hits, drops the swell. */
function detrend(x: Float64Array): Float64Array {
  const w = Math.round(FPS_ENV * 0.5);
  const out = new Float64Array(x.length);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i];
    if (i >= w) sum -= x[i - w];
    const mean = sum / Math.min(i + 1, w);
    out[i] = Math.max(0, x[i] - mean);
  }
  const max = out.reduce((m, v) => Math.max(m, v), 0) || 1;
  return out.map((v) => v / max);
}

/** Linear-interpolated envelope value at a time in seconds. */
function at(env: Float64Array, t: number): number {
  const p = t * FPS_ENV;
  const i = Math.floor(p);
  if (i < 0 || i + 1 >= env.length) return 0;
  return env[i] + (env[i + 1] - env[i]) * (p - i);
}

// ---------------------------------------------------------------------------
// Tempo + grid
// ---------------------------------------------------------------------------

/** Autocorrelation tempo with a log-normal prior at 120 BPM (one octave σ). */
function roughPeriod(onset: Float64Array): number {
  let best = 0;
  let bestLag = 0;
  const minLag = Math.floor((60 / 200) * FPS_ENV);
  const maxLag = Math.ceil((60 / 60) * FPS_ENV);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < onset.length; i++) s += onset[i] * onset[i - lag];
    const bpm = (60 * FPS_ENV) / lag;
    const prior = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
    if (s * prior > best) {
      best = s * prior;
      bestLag = lag;
    }
  }
  return bestLag / FPS_ENV;
}

interface Grid {
  period: number;
  offset: number;
  score: number;
}

/**
 * The single grid (period, offset) that best explains the onsets: mean onset
 * strength sampled on the grid, searched fine around the rough period. Half
 * and double periods are scored too, so a track whose autocorrelation locked
 * onto the off-beat still lands on the beat.
 */
function fitGrid(onset: Float64Array, duration: number, rough: number): Grid {
  let best: Grid = { period: rough, offset: 0, score: -1 };
  // Only tempos a listener taps (80–170 BPM): the rough period, its half and
  // its double, whichever of them land in that band.
  const candidates = [rough, rough / 2, rough * 2].filter(
    (p) => p >= 60 / 170 && p <= 60 / 80,
  );
  if (candidates.length === 0)
    candidates.push(Math.min(60 / 80, Math.max(60 / 170, rough)));
  for (const base of candidates) {
    for (let p = base * 0.985; p <= base * 1.015; p += 0.0002) {
      for (let o = 0; o < p; o += 0.002) {
        let s = 0;
        let n = 0;
        for (let t = o; t < duration; t += p) {
          s += at(onset, t);
          n++;
        }
        const score = s / n;
        if (score > best.score) best = { period: p, offset: o, score };
      }
    }
  }
  return best;
}

/**
 * Phase correction in the time domain. A flux frame is stamped at its window's
 * start while the attack that fires it sits further in, so the fitted grid
 * runs early by up to a window. For each beat, find the steepest rise of the
 * waveform's 4ms energy envelope within ±60ms, and shift the grid by the
 * median of those offsets — the attack a listener hears.
 */
function attackShift(x: Float32Array, grid: Grid, duration: number): number {
  const w = Math.round(SR * 0.004);
  const shifts: number[] = [];
  for (let t = grid.offset; t < duration - 0.1; t += grid.period) {
    const a = Math.max(w, Math.round((t - 0.06) * SR));
    const b = Math.min(x.length - 1, Math.round((t + 0.06) * SR));
    let acc = 0;
    for (let i = a - w; i < a; i++) acc += x[i] * x[i];
    let prev = acc;
    let best = 0;
    let bestAt = -1;
    let peak = 0;
    for (let i = a; i < b; i++) {
      acc += x[i] * x[i] - x[i - w] * x[i - w];
      const rise = acc - prev;
      prev = acc;
      if (acc > peak) peak = acc;
      if (rise > best) {
        best = rise;
        bestAt = i;
      }
    }
    // Only beats with a real transient vote: a 4ms rise worth 5% of the peak.
    if (bestAt >= 0 && best * w > 0.05 * peak) {
      shifts.push(bestAt / SR - t);
    }
  }
  if (shifts.length < 8) return 0;
  shifts.sort((p, q) => p - q);
  return shifts[Math.floor(shifts.length / 2)];
}

/** How true the one-grid assumption is: residual of the nearest onset peak per beat. */
function residuals(onset: Float64Array, grid: Grid, duration: number) {
  const errs: number[] = [];
  let hits = 0;
  let beats = 0;
  for (let t = grid.offset; t < duration; t += grid.period) {
    beats++;
    let bestV = 0;
    let bestDt = 0;
    for (let dt = -0.06; dt <= 0.06; dt += 1 / FPS_ENV / 2) {
      const v = at(onset, t + dt);
      if (v > bestV) {
        bestV = v;
        bestDt = dt;
      }
    }
    if (bestV > 0.15) {
      hits++;
      errs.push(bestDt);
    }
  }
  errs.sort((a, b) => a - b);
  const median = errs.length ? errs[Math.floor(errs.length / 2)] : 0;
  const mad = errs.length
    ? errs.map((e) => Math.abs(e - median)).sort((a, b) => a - b)[
        Math.floor(errs.length / 2)
      ]
    : 0;
  return {
    hitRate: hits / Math.max(1, beats),
    medianMs: median * 1000,
    madMs: mad * 1000,
  };
}

// ---------------------------------------------------------------------------
// Bars, energy, sections
// ---------------------------------------------------------------------------

function downbeatPhase(
  low: Float64Array,
  grid: Grid,
  duration: number,
): number {
  let best = 0;
  let bestScore = -1;
  for (let m = 0; m < 4; m++) {
    let s = 0;
    let n = 0;
    for (
      let t = grid.offset + m * grid.period;
      t < duration;
      t += 4 * grid.period
    ) {
      s += at(low, t);
      n++;
    }
    const score = s / Math.max(1, n);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

function db(v: number): number {
  return 20 * Math.log10(Math.max(v, 1e-6));
}

function loudness(file: string): number | null {
  // ebur128 prints its summary to stderr; the last "I:" line is integrated.
  const r = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-af",
      "ebur128",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", maxBuffer: 1 << 28 },
  );
  return parseLufs(r.stderr ?? "");
}

function parseLufs(text: string): number | null {
  const all = [...text.matchAll(/I:\s+(-?[\d.]+)\s+LUFS/g)];
  return all.length ? Number(all[all.length - 1][1]) : null;
}

// ---------------------------------------------------------------------------

export interface TrackAnalysis {
  slug: string;
  file: string;
  title: string;
  artist: string;
  sha256: string;
  durationSeconds: number;
  bpm: number;
  /** Seconds between beats — the grid is `offset + n * beat`. */
  beat: number;
  /** First beat, seconds. */
  offset: number;
  /** First downbeat (beat 1 of a bar), seconds. */
  firstDownbeat: number;
  beatsPerBar: 4;
  /** Fit quality: share of grid beats with an onset within ±60ms, and its spread. */
  fit: { hitRate: number; medianMs: number; madMs: number };
  /** Loudness per bar, dB RMS, from the first downbeat. */
  barEnergyDb: number[];
  /** Bars (from first downbeat) where the music has fully arrived — the "drop". */
  dropBar: number;
  /** Bars of intro before the energy first reaches 80% of the track's loud level. */
  introBars: number;
  /** Integrated loudness, LUFS; the studio levels every track to one target. */
  lufs: number | null;
}

function analyze(file: string): TrackAnalysis {
  const x = decode(file);
  const duration = x.length / SR;
  const env = envelopes(x);
  const rough = roughPeriod(env.onset);
  const fitted = fitGrid(env.onset, duration, rough);
  const shift = attackShift(x, fitted, duration);
  // Keep the first beat inside [0, period).
  const offset =
    (((fitted.offset + shift) % fitted.period) + fitted.period) % fitted.period;
  const grid: Grid = { ...fitted, offset };
  const fit = residuals(env.onset, grid, duration);
  const phase = downbeatPhase(env.low, grid, duration);
  const firstDownbeat = grid.offset + phase * grid.period;
  const bar = 4 * grid.period;
  const barEnergyDb: number[] = [];
  for (let t = firstDownbeat; t + bar <= duration; t += bar) {
    let s = 0;
    let n = 0;
    for (
      let f = Math.floor(t * FPS_ENV);
      f < Math.floor((t + bar) * FPS_ENV) && f < env.rms.length;
      f++
    ) {
      s += env.rms[f] ** 2;
      n++;
    }
    barEnergyDb.push(Number(db(Math.sqrt(s / Math.max(1, n))).toFixed(1)));
  }
  const sorted = [...barEnergyDb].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  const introBars = Math.max(
    0,
    barEnergyDb.findIndex((e) => e >= loud - 2),
  );
  // The drop: the biggest 2-bar rise into a bar that is itself loud, after bar 1.
  let dropBar = introBars;
  let bestRise = -Infinity;
  for (let b = 2; b < barEnergyDb.length - 1; b++) {
    const rise = barEnergyDb[b] - (barEnergyDb[b - 1] + barEnergyDb[b - 2]) / 2;
    if (barEnergyDb[b] >= loud - 3 && rise > bestRise) {
      bestRise = rise;
      dropBar = b;
    }
  }
  const base = path
    .basename(file)
    .replace(/\(\d+\)/, "")
    .replace(/\.mp3$/i, "");
  const m = base.match(/^([a-z_]+?)-(.+)-(\d+)$/i);
  const artist = m ? m[1] : "unknown";
  const title = m
    ? m[2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : base;
  return {
    slug: base.toLowerCase(),
    file: path.basename(file),
    title,
    artist,
    sha256: createHash("sha256")
      .update(readFileSync(file))
      .digest("hex")
      .slice(0, 16),
    durationSeconds: Number(duration.toFixed(3)),
    bpm: Number((60 / grid.period).toFixed(2)),
    beat: Number(grid.period.toFixed(5)),
    offset: Number(grid.offset.toFixed(4)),
    firstDownbeat: Number(firstDownbeat.toFixed(4)),
    beatsPerBar: 4,
    fit: {
      hitRate: Number(fit.hitRate.toFixed(3)),
      medianMs: Number(fit.medianMs.toFixed(1)),
      madMs: Number(fit.madMs.toFixed(1)),
    },
    barEnergyDb,
    dropBar,
    introBars,
    lufs: loudness(file),
  };
}

/** A copy of the track with a click on every beat, accented on beat 1. */
function writeClicks(file: string, a: TrackAnalysis, outDir: string): void {
  const rate = 44100;
  const n = Math.ceil(a.durationSeconds * rate);
  const pcm = new Int16Array(n);
  let k = 0;
  for (let t = a.firstDownbeat; t < a.durationSeconds; t += a.beat, k++) {
    const accent = k % 4 === 0;
    const f = accent ? 1760 : 1320;
    const amp = accent ? 0.9 : 0.45;
    const start = Math.round(t * rate);
    const len = Math.round(0.03 * rate);
    for (let i = 0; i < len && start + i < n; i++) {
      const env = 1 - i / len;
      pcm[start + i] = Math.round(
        32767 * amp * env * Math.sin((2 * Math.PI * f * i) / rate),
      );
    }
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  const clickWav = path.join(outDir, `${a.slug}.clicks.wav`);
  writeFileSync(clickWav, Buffer.concat([header, Buffer.from(pcm.buffer)]));
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    file,
    "-i",
    clickWav,
    "-filter_complex",
    "[0:a]volume=0.6[m];[m][1:a]amix=inputs=2:normalize=0",
    "-b:a",
    "192k",
    path.join(outDir, `${a.slug}.clicks.mp3`),
  ]);
}

const dirs = process.argv.slice(2);
if (dirs.length === 0)
  throw new Error("usage: analyze-music.mts <dir> [<dir> …]");
const seen = new Map<string, TrackAnalysis>();
for (const dir of dirs) {
  for (const name of readdirSync(dir)
    .filter((n) => /\.mp3$/i.test(n))
    .sort()) {
    const file = path.join(dir, name);
    const a = analyze(file);
    // The same track can sit in two folders under two names; the bytes decide.
    if ([...seen.values()].some((s) => s.sha256 === a.sha256)) continue;
    seen.set(a.slug, a);
    console.log(
      `${a.slug.padEnd(62)} ${a.bpm.toFixed(2).padStart(7)} bpm  beat1 ${a.firstDownbeat.toFixed(3)}s  fit ${(a.fit.hitRate * 100).toFixed(0)}% ±${a.fit.madMs}ms  intro ${a.introBars} bars  drop bar ${a.dropBar}  ${a.lufs} LUFS  ${a.durationSeconds.toFixed(1)}s`,
    );
    if (process.env.CLICKS) {
      mkdirSync(process.env.CLICKS, { recursive: true });
      writeClicks(file, a, process.env.CLICKS);
    }
  }
}
const out = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "lib",
  "studio",
  "music-library.json",
);
writeFileSync(out, `${JSON.stringify([...seen.values()], null, 2)}\n`);
console.log(`wrote ${seen.size} tracks → ${out}`);
