import { describe, expect, it } from "vitest";
import { AdaptiveResolution, minScaleFor } from "../src/engine/AdaptiveResolution";

/** Feeds frames of `frameMs` for `seconds`; returns the scale after every change. */
function run(a: AdaptiveResolution, frameMs: number | ((t: number) => number), seconds: number, active = true): number[] {
  const changes: number[] = [];
  for (let t = 0; t < seconds * 1000; ) {
    const ms = typeof frameMs === "number" ? frameMs : frameMs(t);
    if (a.update(ms, active)) changes.push(a.scale);
    t += ms;
  }
  return changes;
}

/** A GPU-bound device: frame time proportional to the pixel count (plus fixed CPU time). */
const gpuBound = (a: AdaptiveResolution, fullMs: number, cpuMs = 0) => () => cpuMs + fullMs * a.scale * a.scale;

describe("minScaleFor", () => {
  it("keeps the pixel ratio at >= 0.75 and >= half the base", () => {
    expect(minScaleFor(1)).toBeCloseTo(0.75);
    expect(minScaleFor(2)).toBeCloseTo(0.5);
    expect(minScaleFor(1.25)).toBeCloseTo(0.6);
    expect(minScaleFor(0.75)).toBe(1);
    expect(minScaleFor(0.5)).toBe(1);
  });
});

describe("AdaptiveResolution", () => {
  it("never changes at a steady 60 fps (or 120 fps)", () => {
    const a = new AdaptiveResolution(2);
    expect(run(a, 1000 / 60, 120)).toEqual([]);
    expect(run(a, 1000 / 120, 60)).toEqual([]);
    expect(a.scale).toBe(1);
  });

  it("keeps a 60 Hz device that misses a vsync now and then", () => {
    const a = new AdaptiveResolution(1);
    // Every tenth frame takes two vsync intervals: ~54 fps.
    let i = 0;
    expect(run(a, () => (++i % 10 === 0 ? 33.3 : 16.7), 120)).toEqual([]);
  });

  it("steps down to the floor at a sustained 30 fps", () => {
    const a = new AdaptiveResolution(2);
    // 55 ms at full resolution, still 25 ms at half.
    const changes = run(a, gpuBound(a, 40, 15), 60);
    expect(changes).toEqual([0.9, 0.8, 0.7, 0.6, 0.5]);
    expect(a.scale).toBe(0.5);
    // Nothing below the floor, however long it stays slow.
    expect(run(a, 200, 60)).toEqual([]);
  });

  it("stops at an effective pixel ratio of 0.75 for dpr 1", () => {
    const a = new AdaptiveResolution(1);
    expect(run(a, gpuBound(a, 33), 60)).toEqual([0.9, 0.8, 0.75]);
  });

  it("never scales when the base ratio is already low", () => {
    const a = new AdaptiveResolution(0.75);
    expect(run(a, 50, 60)).toEqual([]);
    expect(a.scale).toBe(1);
  });

  it("waits for the warm-up and ~2 s of measurements before stepping down", () => {
    const a = new AdaptiveResolution(1);
    expect(run(a, gpuBound(a, 33), 3.9)).toEqual([]);
    expect(run(a, gpuBound(a, 33), 0.2)).toEqual([0.9]);
  });

  it("recovers step by step when frames get fast again", () => {
    const a = new AdaptiveResolution(2);
    run(a, gpuBound(a, 30), 30);
    expect(a.scale).toBeLessThan(1);
    // The scene got lighter: 12 ms even at full resolution.
    const changes = run(a, gpuBound(a, 12), 60);
    expect(changes.at(-1)).toBe(1);
    expect(changes).toEqual([...changes].sort((x, y) => x - y));
    expect(a.scale).toBe(1);
  });

  it("waits for several seconds of fast frames before stepping up", () => {
    const a = new AdaptiveResolution(1);
    run(a, gpuBound(a, 25, 10), 20);
    const low = a.scale;
    expect(low).toBeLessThan(1);
    expect(run(a, 10, 3.9)).toEqual([]);
    expect(run(a, 10, 2.2)).toHaveLength(1);
    expect(a.scale).toBeGreaterThan(low);
  });

  it("locks out a level that fails right after stepping up (no oscillation)", () => {
    const a = new AdaptiveResolution(1);
    // 21.5 ms at full resolution, 17.4 ms at 0.9: full is too slow, 0.9 is fast.
    const changes = run(a, gpuBound(a, 21.5), 300);
    expect(a.scale).toBe(0.9);
    // First attempt fails, retries come after growing lockouts: 15 s, 30 s, 60 s, 120 s.
    const ups = changes.filter((s) => s === 1).length;
    expect(ups).toBeGreaterThan(0);
    expect(ups).toBeLessThanOrEqual(5);
    // Without the lockout it would flip every ~8 s (more than 30 times in 300 s).
  });

  it("ignores single spikes (GC, shader compile, tab switch)", () => {
    const a = new AdaptiveResolution(1);
    let t = 0;
    const changes = run(
      a,
      () => {
        t++;
        return t % 60 === 0 ? 400 : 16.7;
      },
      120,
    );
    expect(changes).toEqual([]);
  });

  it("treats a run of long frames as a slow device", () => {
    const a = new AdaptiveResolution(1);
    expect(run(a, gpuBound(a, 200), 60)).toEqual([0.9, 0.8, 0.75]);
  });

  it("ignores paused / loading time and restarts the warm-up afterwards", () => {
    const a = new AdaptiveResolution(1);
    expect(run(a, 100, 60, false)).toEqual([]);
    // Warm-up after becoming active again: no decision within the first 2 s.
    expect(run(a, gpuBound(a, 33), 2)).toEqual([]);
    expect(run(a, gpuBound(a, 33), 2.5)).toEqual([0.9]);
    // Pausing in between does not count as slow time either.
    expect(run(a, 30, 0.9)).toEqual([]);
    run(a, 1000, 120, false);
    expect(run(a, 16.7, 1.5)).toEqual([]);
    expect(a.scale).toBe(0.9);
  });

  it("restarts the warm-up on reset (resize, visibility change)", () => {
    const a = new AdaptiveResolution(1);
    run(a, gpuBound(a, 33), 3.5);
    a.reset();
    expect(run(a, gpuBound(a, 33), 3.9)).toEqual([]);
    expect(run(a, gpuBound(a, 33), 0.2)).toEqual([0.9]);
  });

  it("counts frequent long frames (constant stutter) as slow", () => {
    const a = new AdaptiveResolution(1);
    let i = 0;
    expect(run(a, () => (++i % 3 === 0 ? 150 : 16), 6)[0]).toBe(0.9);
  });

  it("is not fooled by vsync-quantised frame times", () => {
    const a = new AdaptiveResolution(1);
    const vsync = (ms: number) => Math.ceil(ms / (1000 / 60)) * (1000 / 60);
    // GPU needs 25 ms at full resolution: 33.3 ms frames at 1 and at 0.9, 16.7 ms at 0.8.
    const changes = run(a, () => vsync(25 * a.scale * a.scale), 120);
    expect(changes.slice(0, 2)).toEqual([0.9, 0.8]);
    expect(changes).not.toContain(1);
  });

  it("undoes the steps that did not help and keeps the ones that did", () => {
    const a = new AdaptiveResolution(2);
    // Fill-bound down to 0.7, then something else limits at 25 ms.
    const changes = run(a, () => Math.max(25, 50 * a.scale * a.scale), 30);
    expect(changes).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.7]);
  });

  it("undoes the descent on a slow device that is not fill-bound, despite noise", () => {
    const a = new AdaptiveResolution(1);
    // ~6 fps no matter the resolution (vertex / CPU bound), +-10 % jitter.
    let seed = 1;
    const noisy = () => {
      seed = (seed * 16807) % 2147483647;
      return 160 * (0.9 + 0.2 * (seed / 2147483647));
    };
    const changes = run(a, noisy, 25);
    expect(changes).toEqual([0.9, 0.8, 0.75, 1]);
  });

  it("restores full resolution when lowering it does not help (CPU-bound or capped)", () => {
    const a = new AdaptiveResolution(2);
    // 30 fps no matter the resolution, e.g. a 30 Hz rAF cap in power-saving mode.
    const changes = run(a, 33.3, 20);
    expect(changes).toEqual([0.9, 0.8, 0.7, 1]);
    // ...leaves it alone for 30 s, then tries again and waits twice as long.
    expect(run(a, 33.3, 15)).toEqual([]);
    expect(run(a, 33.3, 30)).toEqual([0.9, 0.8, 0.7, 1]);
    expect(run(a, 33.3, 40)).toEqual([]);
    expect(a.scale).toBe(1);
  });
});
