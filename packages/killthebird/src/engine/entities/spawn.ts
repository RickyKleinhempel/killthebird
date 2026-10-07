import { BIRD_LAYERS, type DifficultyConfig } from "../config";
import { range, weightedPick, type Rng } from "../rng";
import { halfWidthAtDepth } from "../scroll";
import type { BirdLayer } from "../types";

/** Decides when the next bird appears. */
export class SpawnScheduler {
  private timer = 0.4;

  constructor(
    private readonly rng: Rng,
    private readonly difficulty: DifficultyConfig,
  ) {}

  /** Returns true when a bird should be spawned this frame. */
  update(dt: number, aliveBirds: number): boolean {
    this.timer -= dt;
    if (this.timer > 0) return false;
    this.timer = range(this.rng, this.difficulty.spawnMin, this.difficulty.spawnMax);
    return aliveBirds < this.difficulty.maxBirds;
  }

  reset(): void {
    this.timer = 0.4;
  }
}

export interface SpawnContext {
  cameraX: number;
  cameraY: number;
  fov: number;
  aspect: number;
  speedMultiplier: number;
}

export interface BirdSpawn {
  layer: BirdLayer;
  x: number;
  y: number;
  z: number;
  /** +1 flies to the right, -1 to the left. */
  dir: 1 | -1;
  speed: number;
  scale: number;
  bobAmp: number;
  bobFreq: number;
  phase: number;
  /** Slow drift towards / away from the camera, world units per second. */
  zDrift: number;
}

const deg = Math.PI / 180;

export function planBirdSpawn(rng: Rng, ctx: SpawnContext): BirdSpawn {
  const layer = weightedPick(rng, {
    near: BIRD_LAYERS.near.weight,
    mid: BIRD_LAYERS.mid.weight,
    far: BIRD_LAYERS.far.weight,
  });
  const cfg = BIRD_LAYERS[layer];
  const z = range(rng, cfg.zMax, cfg.zMin);
  const depth = Math.abs(z);
  const elevation = range(rng, cfg.elevMin, cfg.elevMax) * deg;
  const y = ctx.cameraY + depth * Math.tan(elevation);
  const halfW = halfWidthAtDepth(depth, ctx.fov, ctx.aspect);
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  // Usually enter right at the screen border; sometimes further out so the
  // panorama is alive when the player scrolls.
  const extra = rng() < 0.25 ? range(rng, 0, halfW * 1.5) : 0;
  const x = ctx.cameraX - dir * (halfW + cfg.scale * 1.5 + extra);
  const speed = depth * cfg.angularSpeed * range(rng, 0.8, 1.25) * ctx.speedMultiplier;

  return {
    layer,
    x,
    y,
    z,
    dir,
    speed,
    scale: cfg.scale * range(rng, 0.9, 1.1),
    bobAmp: depth * range(rng, 0.004, 0.018),
    bobFreq: range(rng, 1.2, 2.6),
    phase: range(rng, 0, Math.PI * 2),
    zDrift: range(rng, -0.08, 0.08) * depth * 0.15,
  };
}

/** Birds leave the game once they passed this distance from the panorama centre. */
export function despawnBound(z: number, cameraRange: number, fov: number, aspect: number, scale: number): number {
  return cameraRange + halfWidthAtDepth(z, fov, aspect) + scale * 4;
}
