import { describe, expect, it } from "vitest";
import { BIRD_LAYERS, DIFFICULTY, birdLayerForDepth } from "../src/engine/config";
import { SpawnScheduler, planBirdSpawn } from "../src/engine/entities/spawn";
import { createRng } from "../src/engine/rng";
import { halfWidthAtDepth } from "../src/engine/scroll";

describe("planBirdSpawn", () => {
  it("spawns inside the layer band, off-screen, flying into view", () => {
    const rng = createRng(1);
    const ctx = { cameraX: 12, cameraY: 2.2, fov: 45, aspect: 16 / 9, speedMultiplier: 1 };
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const b = planBirdSpawn(rng, ctx);
      seen.add(b.layer);
      const cfg = BIRD_LAYERS[b.layer];
      expect(b.z).toBeGreaterThanOrEqual(cfg.zMin);
      expect(b.z).toBeLessThanOrEqual(cfg.zMax);
      expect(birdLayerForDepth(b.z)).toBe(b.layer);
      expect(Math.abs(b.x - ctx.cameraX)).toBeGreaterThan(halfWidthAtDepth(b.z, ctx.fov, ctx.aspect));
      expect(Math.sign(ctx.cameraX - b.x)).toBe(b.dir);
      expect(b.speed).toBeGreaterThan(0);
    }
    expect(seen).toEqual(new Set(["near", "mid", "far"]));
  });
});

describe("SpawnScheduler", () => {
  it("respects the bird cap", () => {
    const s = new SpawnScheduler(createRng(2), DIFFICULTY.normal);
    let spawned = 0;
    for (let i = 0; i < 600; i++) if (s.update(1 / 60, DIFFICULTY.normal.maxBirds)) spawned++;
    expect(spawned).toBe(0);
    for (let i = 0; i < 600; i++) if (s.update(1 / 60, 0)) spawned++;
    expect(spawned).toBeGreaterThan(4);
  });
});

describe("difficulty", () => {
  it("scales bird speed", () => {
    const ctx = { cameraX: 0, cameraY: 2.2, fov: 45, aspect: 16 / 9 };
    const speed = (d: keyof typeof DIFFICULTY) =>
      planBirdSpawn(createRng(3), { ...ctx, speedMultiplier: DIFFICULTY[d].speed }).speed;
    expect(speed("easy")).toBeLessThan(speed("normal"));
    expect(speed("hard")).toBeGreaterThan(speed("normal"));
  });

  it("applies a new bird cap to a running scheduler", () => {
    const s = new SpawnScheduler(createRng(4), DIFFICULTY.hard);
    const alive = DIFFICULTY.easy.maxBirds;
    let spawned = 0;
    for (let i = 0; i < 300; i++) if (s.update(1 / 60, alive)) spawned++;
    expect(spawned).toBeGreaterThan(0);
    s.setDifficulty(DIFFICULTY.easy);
    spawned = 0;
    for (let i = 0; i < 300; i++) if (s.update(1 / 60, alive)) spawned++;
    expect(spawned).toBe(0);
  });
});
