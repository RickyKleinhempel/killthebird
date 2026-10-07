import { Group, MeshBasicMaterial, SphereGeometry } from "three";
import type { ModelAsset } from "../Assets";
import { BIRD_POOL_SIZE, CAMERA, type DifficultyConfig } from "../config";
import type { Rng } from "../rng";
import type { HeightFn } from "../terrain";
import { Bird } from "./Bird";
import { SpawnScheduler, despawnBound, planBirdSpawn, type SpawnContext } from "./spawn";

export class BirdManager {
  readonly root = new Group();
  private readonly birds: Bird[] = [];
  private readonly scheduler: SpawnScheduler;
  private readonly hitGeometry = new SphereGeometry(0.55, 10, 8);
  private readonly hitMaterial = new MeshBasicMaterial();

  constructor(
    asset: ModelAsset,
    private readonly rng: Rng,
    private readonly difficulty: DifficultyConfig,
    private readonly height: HeightFn,
  ) {
    this.root.name = "birds";
    this.scheduler = new SpawnScheduler(rng, difficulty);
    for (let i = 0; i < BIRD_POOL_SIZE; i++) {
      const bird = new Bird(asset, this.hitGeometry, this.hitMaterial);
      this.birds.push(bird);
      this.root.add(bird.root);
    }
  }

  get activeCount(): number {
    return this.birds.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
  }

  update(dt: number, ctx: SpawnContext, spawning: boolean): void {
    const ctxWithSpeed = { ...ctx, speedMultiplier: this.difficulty.speed };
    if (spawning && this.scheduler.update(dt, this.activeCount)) {
      const free = this.birds.find((b) => !b.active);
      free?.activate(planBirdSpawn(this.rng, ctxWithSpeed));
    }
    for (const bird of this.birds) {
      if (!bird.active) continue;
      const bound = despawnBound(bird.root.position.z, CAMERA.range, ctx.fov, ctx.aspect, bird.scale);
      if (!bird.update(dt, bound, this.height)) bird.deactivate();
    }
  }

  clear(): void {
    for (const bird of this.birds) bird.deactivate();
    this.scheduler.reset();
  }

  dispose(): void {
    this.hitGeometry.dispose();
    this.hitMaterial.dispose();
    this.root.removeFromParent();
  }
}
