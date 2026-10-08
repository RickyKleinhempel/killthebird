// Adaptive render resolution: lowers the pixel ratio in small steps while the
// frame rate stays low and raises it again once there is headroom. Pure logic
// (no DOM / three.js), fed with frame times by the game loop.

export interface AdaptiveSettings {
  /** Scale change per step. */
  step: number;
  /** Smoothed frame time above which the resolution is lowered (ms, 20 = 50 fps). */
  slowMs: number;
  /** Frame time below which the resolution may be raised again (ms). */
  fastMs: number;
  /** Measurements are made in windows of this length (ms of frame time). */
  windowMs: number;
  /** Number of windows averaged for the "too slow" decision (2 x 1 s). */
  slowWindows: number;
  /** Number of consecutive fast windows before stepping up (5 x 1 s). */
  fastWindows: number;
  /** Ignored time after a reset (load, resize, visibility change, resume). */
  warmupMs: number;
  /** Ignored time after a scale change (buffer reallocation). */
  settleMs: number;
  /** A single frame longer than this in a window is a spike (tab switch, GC, shader compile). */
  spikeMs: number;
  /** Long frames count for at most this much (a debugger pause must not dominate). */
  maxFrameMs: number;
  /** A level that has to be left within this time after stepping up to it failed. */
  failWindowMs: number;
  /** Lockout of a failed level; doubles with every failure. */
  lockoutMs: number;
  /**
   * Share of the frame time that must scale with the pixel count for lower
   * resolutions to count as helpful (0.3: 19 % fewer pixels must save >= 5.7 %).
   */
  fillShare: number;
  /** After this many steps down without gain, they are undone and adaptation paused. */
  uselessSteps: number;
  /** At the floor, steps whose frame time is within this fraction of the best are undone. */
  tolerance: number;
  /** Pause after giving up; doubles every time. */
  giveUpMs: number;
  /** Cap for the doubling of lockouts and pauses (2^n). */
  maxBackoff: number;
}

export const ADAPTIVE_DEFAULTS: AdaptiveSettings = {
  step: 0.1,
  slowMs: 20,
  fastMs: 18,
  windowMs: 1000,
  slowWindows: 2,
  fastWindows: 5,
  warmupMs: 2000,
  settleMs: 500,
  spikeMs: 100,
  maxFrameMs: 1000,
  failWindowMs: 10_000,
  lockoutMs: 15_000,
  fillShare: 0.3,
  uselessSteps: 3,
  tolerance: 0.1,
  giveUpMs: 30_000,
  maxBackoff: 4,
};

/** Lowest effective pixel ratio, and never less than half the base ratio. */
const MIN_PIXEL_RATIO = 0.75;

/** Lowest scale for a base pixel ratio (1 = never scales). */
export function minScaleFor(basePixelRatio: number): number {
  if (basePixelRatio <= MIN_PIXEL_RATIO) return 1;
  return Math.max(MIN_PIXEL_RATIO, basePixelRatio * 0.5) / basePixelRatio;
}

interface Descent {
  /** Smoothed frame time per level, starting with the level the descent began at. */
  samples: { level: number; ms: number }[];
  /** The last step still has to be measured. */
  pending: boolean;
}

export class AdaptiveResolution {
  private readonly s: AdaptiveSettings;
  /** Available scales, index 0 = full resolution. */
  private readonly levels: number[] = [1];
  private level = 0;
  /** Measured frame time; the controller's clock for lockouts and pauses. */
  private clock = 0;
  private ignoreMs: number;
  private wasActive = false;
  private winTime = 0;
  private winFrames = 0;
  private spikeTime = 0;
  private spikes = 0;
  /** Mean frame times of the last completed windows since the last change. */
  private windows: number[] = [];
  /** Consecutive fast windows since the last change. */
  private fastRun = 0;
  private upAt = -Infinity;
  /** Per level: how often stepping up to it failed, and until when it is locked out. */
  private readonly lockouts = new Map<number, { failures: number; until: number }>();
  /** The current series of steps down (to check that they help). */
  private descent: Descent | null = null;
  private giveUps = 0;
  private pausedUntil = 0;

  /** `basePixelRatio`: devicePixelRatio capped by maxPixelRatio. */
  constructor(basePixelRatio: number, settings: Partial<AdaptiveSettings> = {}) {
    this.s = { ...ADAPTIVE_DEFAULTS, ...settings };
    this.ignoreMs = this.s.warmupMs;
    const min = minScaleFor(basePixelRatio);
    while (this.levels[this.levels.length - 1]! > min + 1e-6) {
      const next = 1 - this.levels.length * this.s.step;
      this.levels.push(Math.max(min, Math.round(next * 1000) / 1000));
    }
  }

  /** Factor for the base pixel ratio, 1 = full resolution. */
  get scale(): number {
    return this.levels[this.level] ?? 1;
  }

  /** Restarts the warm-up, e.g. after a resize or when the tab becomes visible again. */
  reset(): void {
    this.ignoreMs = this.s.warmupMs;
    this.descent = null;
    this.clearWindows();
  }

  /**
   * Feeds the time since the previous frame. `active` is false while frames are
   * not representative (loading, paused). Returns true when the scale changed.
   */
  update(dtMs: number, active: boolean): boolean {
    if (!active) {
      this.wasActive = false;
      return false;
    }
    if (!this.wasActive) {
      this.wasActive = true;
      this.reset();
      return false;
    }
    if (!(dtMs > 0)) return false;
    if (this.ignoreMs > 0) {
      this.ignoreMs -= Math.min(dtMs, this.s.spikeMs);
      return false;
    }
    const ms = Math.min(dtMs, this.s.maxFrameMs);
    this.clock += ms;
    if (dtMs > this.s.spikeMs) {
      this.spikeTime += ms;
      this.spikes++;
    } else {
      this.winTime += ms;
      this.winFrames++;
    }
    if (this.winTime + this.spikeTime < this.s.windowMs) return false;
    // One long frame per window is a hiccup; several mean the device is that slow.
    const frameMs =
      this.spikes > 1
        ? (this.winTime + this.spikeTime) / (this.winFrames + this.spikes)
        : this.winFrames > 0
          ? this.winTime / this.winFrames
          : null;
    this.clearWindow();
    if (frameMs === null) return false;
    this.windows.push(frameMs);
    return this.decide();
  }

  private decide(): boolean {
    const s = this.s;
    const w = this.windows;
    this.fastRun = w[w.length - 1]! < s.fastMs ? this.fastRun + 1 : 0;
    if (w.length > s.slowWindows) w.shift();

    if (w.length === s.slowWindows) {
      const recent = mean(w);
      const d = this.descent;
      if (d?.pending) {
        d.pending = false;
        d.samples.push({ level: this.level, ms: recent });
        const result = this.checkDescent(d, recent);
        if (result !== null) return result;
      }
      if (recent > s.slowMs && this.level < this.levels.length - 1 && this.clock >= this.pausedUntil) {
        // Leaving a level soon after stepping up to it: lock it out for a while.
        if (this.clock - this.upAt < s.failWindowMs) {
          const failures = this.lockouts.get(this.level)?.failures ?? 0;
          const until = this.clock + s.lockoutMs * 2 ** Math.min(failures, s.maxBackoff);
          this.lockouts.set(this.level, { failures: failures + 1, until });
        }
        this.upAt = -Infinity;
        if (this.descent) this.descent.pending = true;
        else this.descent = { samples: [{ level: this.level, ms: recent }], pending: true };
        return this.setLevel(this.level + 1);
      }
    }

    const target = this.level - 1;
    if (target >= 0 && this.fastRun >= s.fastWindows && this.clock >= (this.lockouts.get(target)?.until ?? 0)) {
      this.upAt = this.clock;
      this.descent = null;
      return this.setLevel(target);
    }
    return false;
  }

  /**
   * Checks after each step down whether the descent made frames faster. Single
   * steps may show no gain on vsync displays (frame times are quantised), so
   * the gain is measured from the start of the descent. Returns null to go on.
   */
  private checkDescent(d: Descent, recent: number): boolean | null {
    const s = this.s;
    const start = d.samples[0]!;
    const pixels = 1 - (this.scale / (this.levels[start.level] ?? 1)) ** 2;
    const helping = 1 - recent / start.ms >= s.fillShare * pixels;
    const atFloor = this.level === this.levels.length - 1;
    const steps = d.samples.length - 1;
    if (!atFloor && (helping || steps < s.uselessSteps)) return null;
    this.descent = null;
    // Not limited by fill rate (CPU-bound or frame-capped): a lower resolution
    // only costs quality, so undo the descent. At the floor, keep only the steps
    // that made a difference.
    let level = start.level;
    if (helping) {
      const best = Math.min(...d.samples.map((x) => x.ms));
      level = d.samples.find((x) => x.ms <= best * (1 + s.tolerance))!.level;
    }
    if (level === this.level) return false;
    this.pausedUntil = this.clock + s.giveUpMs * 2 ** Math.min(this.giveUps++, s.maxBackoff);
    return this.setLevel(level);
  }

  private setLevel(level: number): boolean {
    const changed = level !== this.level;
    this.level = level;
    this.clearWindows();
    if (changed) this.ignoreMs = this.s.settleMs;
    return changed;
  }

  private clearWindow(): void {
    this.winTime = 0;
    this.winFrames = 0;
    this.spikeTime = 0;
    this.spikes = 0;
  }

  private clearWindows(): void {
    this.clearWindow();
    this.windows = [];
    this.fastRun = 0;
  }
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
