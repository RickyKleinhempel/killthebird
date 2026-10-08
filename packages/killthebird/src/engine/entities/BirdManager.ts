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
  /** Reused for every spawn so the frame loop does not allocate. */
  private readonly spawnCtx: SpawnContext = { cameraX: 0, cameraY: CAMERA.height, fov: 0, aspect: 1, speedMultiplier: 1 };

  constructor(
    asset: ModelAsset,
    private readonly rng: Rng,
    private difficulty: DifficultyConfig,
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
    let n = 0;
    for (const bird of this.birds) if (bird.alive) n++;
    return n;
  }

  setDifficulty(difficulty: DifficultyConfig): void {
    const factor = difficulty.speed / this.difficulty.speed;
    this.difficulty = difficulty;
    this.scheduler.setDifficulty(difficulty);
    for (const bird of this.birds) bird.scaleSpeed(factor);
  }

  update(dt: number, cameraX: number, fov: number, aspect: number, spawning: boolean): void {
    if (spawning && this.scheduler.update(dt, this.activeCount)) {
      const free = this.birds.find((b) => !b.active);
      if (free) {
        const ctx = this.spawnCtx;
        ctx.cameraX = cameraX;
        ctx.fov = fov;
        ctx.aspect = aspect;
        ctx.speedMultiplier = this.difficulty.speed;
        free.activate(planBirdSpawn(this.rng, ctx));
      }
    }
    for (const bird of this.birds) {
      if (!bird.active) continue;
      const bound = despawnBound(bird.root.position.z, CAMERA.range, fov, aspect, bird.scale);
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
