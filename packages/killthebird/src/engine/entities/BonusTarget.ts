import { AnimationMixer, Object3D, Vector3, type Mesh } from "three";
import { fitToLength, instantiate, type ModelAsset, type ModelLibrary } from "../Assets";
import { BONUS_POINTS } from "../config";
import { BURSTS, type BurstPreset, type Effects } from "../Effects";
import type { BonusPlacement } from "../level";
import type { BonusKind } from "../types";
import { HIT_LAYER } from "./Bird";

/** Lets every mesh below `node` block or receive shots. */
export function enableHits(node: Object3D): void {
  node.traverse((o) => {
    if ((o as Mesh).isMesh) o.layers.enable(HIT_LAYER);
  });
}

function setHittable(node: Object3D, on: boolean): void {
  node.traverse((o) => {
    if ((o as Mesh).isMesh) {
      if (on) o.layers.enable(HIT_LAYER);
      else o.layers.disable(HIT_LAYER);
    }
  });
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

/** Scenery that gives extra points when shot. */
export abstract class BonusTarget {
  abstract readonly kind: BonusKind;
  abstract readonly burst: BurstPreset;
  readonly root: Object3D;
  protected cooldown = 0;

  constructor(
    asset: ModelAsset,
    placement: BonusPlacement,
    protected readonly effects: Effects,
  ) {
    this.root = instantiate(asset);
    this.root.position.set(placement.x, placement.y, placement.z);
    this.root.scale.setScalar(placement.scale);
    this.root.rotation.y = placement.rotY;
    this.root.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    enableHits(this.root);
  }

  get points(): number {
    return BONUS_POINTS[this.kind];
  }

  get hittable(): boolean {
    return this.cooldown <= 0;
  }

  /** Marks the sub-tree that counts as a bonus hit (the rest only blocks shots). */
  protected markShootable(node: Object3D): void {
    node.userData.shootable = this;
  }

  hit(point: Vector3): void {
    this.effects.burst(point, this.burst, Math.max(1, this.root.scale.x));
    this.onHit(point);
  }

  protected abstract onHit(point: Vector3): void;

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  /** Called when a new round starts. */
  reset(): void {
    this.cooldown = 0;
  }
}

function requireNode(root: Object3D, name: string): Object3D {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`[killthebird] model "${root.name}" has no node "${name}"`);
  return node;
}

export class WindmillTarget extends BonusTarget {
  readonly kind = "windmill" as const;
  readonly burst = BURSTS.wood;
  private readonly blades: Object3D;
  private boost = 0;

  constructor(asset: ModelAsset, placement: BonusPlacement, effects: Effects) {
    super(asset, placement, effects);
    this.blades = requireNode(this.root, "Blades");
    this.markShootable(this.blades);
  }

  protected onHit(): void {
    this.boost = 9;
    this.cooldown = 3.5;
  }

  update(dt: number): void {
    super.update(dt);
    this.boost = Math.max(0, this.boost - dt * 2.4);
    this.blades.rotation.z -= (0.45 + this.boost) * dt;
  }
}

export class ScarecrowTarget extends BonusTarget {
  readonly kind = "scarecrow" as const;
  readonly burst = BURSTS.straw;
  private readonly hat: Object3D;
  private readonly hatRest: Vector3;
  private vy = 0;
  private spin = 0;
  private flying = false;

  constructor(asset: ModelAsset, placement: BonusPlacement, effects: Effects) {
    super(asset, placement, effects);
    this.hat = requireNode(this.root, "Hat");
    this.hatRest = this.hat.position.clone();
    this.markShootable(this.hat);
  }

  protected onHit(): void {
    this.flying = true;
    this.vy = 6.5;
    this.spin = (Math.random() < 0.5 ? -1 : 1) * 9;
    this.cooldown = 2.6;
  }

  update(dt: number): void {
    super.update(dt);
    if (!this.flying) return;
    this.vy -= 14 * dt;
    this.hat.position.y += this.vy * dt;
    this.hat.rotation.x += this.spin * dt;
    this.hat.rotation.z += this.spin * 0.4 * dt;
    if (this.hat.position.y <= this.hatRest.y && this.vy < 0) {
      this.flying = false;
      this.hat.position.copy(this.hatRest);
      this.hat.rotation.set(0, this.hat.rotation.y + 0.3, 0);
    }
  }
}

export class SignpostTarget extends BonusTarget {
  readonly kind = "signpost" as const;
  readonly burst = BURSTS.wood;
  private readonly sign: Object3D;
  private spinT = -1;
  private startY = 0;

  constructor(asset: ModelAsset, placement: BonusPlacement, effects: Effects) {
    super(asset, placement, effects);
    this.sign = requireNode(this.root, "Sign");
    this.markShootable(this.sign);
  }

  protected onHit(): void {
    this.spinT = 0;
    this.startY = this.sign.rotation.y;
    this.cooldown = 1.6;
  }

  update(dt: number): void {
    super.update(dt);
    if (this.spinT < 0) return;
    this.spinT = Math.min(1, this.spinT + dt / 1.4);
    this.sign.rotation.y = this.startY + easeOutCubic(this.spinT) * Math.PI * 4;
    if (this.spinT === 1) this.spinT = -1;
  }
}

export class PumpkinTarget extends BonusTarget {
  readonly kind = "pumpkin" as const;
  readonly burst = BURSTS.pumpkin;
  private regrow = -1;
  private readonly baseScale: number;

  constructor(asset: ModelAsset, placement: BonusPlacement, effects: Effects) {
    super(asset, placement, effects);
    this.baseScale = placement.scale;
    this.markShootable(this.root);
  }

  protected onHit(): void {
    this.cooldown = 12;
    this.root.visible = false;
    setHittable(this.root, false);
    this.regrow = -1;
  }

  update(dt: number): void {
    super.update(dt);
    if (!this.root.visible && this.cooldown < 0.6) {
      this.root.visible = true;
      this.regrow = 0;
    }
    if (this.regrow >= 0) {
      this.regrow = Math.min(1, this.regrow + dt / 0.6);
      this.root.scale.setScalar(this.baseScale * Math.max(0.01, easeOutBack(this.regrow)));
      if (this.regrow === 1) {
        this.regrow = -1;
        setHittable(this.root, true);
      }
    }
  }

  reset(): void {
    super.reset();
    this.root.visible = true;
    this.root.scale.setScalar(this.baseScale);
    setHittable(this.root, true);
    this.regrow = -1;
  }
}

type PeekPhase = "hidden" | "rising" | "up" | "ducking";

/** Size of the peeking chicken in deer-stand units (rail 0.8 high, window above). */
const PEEK_LENGTH = 1.05;

/** A chicken that peeks out of the deer stand now and then. */
export class PeekabooTarget extends BonusTarget {
  readonly kind = "peekaboo" as const;
  readonly burst = BURSTS.feathers;
  private readonly chicken: Object3D;
  private readonly pupils: Object3D | null;
  private readonly crossEyes: Object3D | null;
  private readonly mixer: AnimationMixer | null;
  private phase: PeekPhase = "hidden";
  private timer = 4;
  private readonly upY: number;
  private readonly downY: number;

  constructor(asset: ModelAsset, chickenAsset: ModelAsset, placement: BonusPlacement, effects: Effects) {
    super(asset, placement, effects);
    const anchor = this.root.getObjectByName("Peek") ?? this.root;
    const chicken = instantiate(chickenAsset);
    // Normalise like the flying birds, then face the camera.
    fitToLength(chicken, PEEK_LENGTH, "bottom");
    this.pupils = chicken.getObjectByName("Pupils") ?? null;
    this.crossEyes = chicken.getObjectByName("XEyes") ?? null;
    if (this.crossEyes) this.crossEyes.visible = false;
    const holder = new Object3D();
    holder.name = "PeekChicken";
    holder.add(chicken);
    holder.rotation.y = -Math.PI / 2 + 0.6; // three-quarter view towards the camera
    anchor.add(holder);
    this.chicken = holder;
    // The anchor sits on the platform behind the front rail (see buildings.py).
    this.upY = 0.78;
    this.downY = 0;
    holder.position.y = this.downY;
    holder.visible = false;
    holder.traverse((o) => (o.castShadow = true));
    enableHits(holder);
    this.markShootable(holder);
    const idle = chickenAsset.animations.find((c) => c.name === "idle");
    this.mixer = idle ? new AnimationMixer(chicken) : null;
    if (this.mixer && idle) this.mixer.clipAction(idle).play();
    setHittable(holder, false);
  }

  get hittable(): boolean {
    return this.phase === "up" || this.phase === "rising";
  }

  protected onHit(): void {
    this.phase = "ducking";
    this.timer = 0.3;
    setHittable(this.chicken, false);
    this.setKnockedOut(true);
  }

  private setKnockedOut(on: boolean): void {
    if (this.pupils) this.pupils.visible = !on;
    if (this.crossEyes) this.crossEyes.visible = on;
  }

  update(dt: number): void {
    super.update(dt);
    this.mixer?.update(dt);
    this.timer -= dt;
    const c = this.chicken;
    switch (this.phase) {
      case "hidden":
        if (this.timer <= 0) {
          this.setKnockedOut(false);
          this.phase = "rising";
          this.timer = 0.35;
          c.visible = true;
          setHittable(c, true);
        }
        break;
      case "rising":
        c.position.y = this.downY + (this.upY - this.downY) * easeOutCubic(1 - Math.max(0, this.timer) / 0.35);
        if (this.timer <= 0) {
          this.phase = "up";
          this.timer = 1.4 + Math.random() * 0.8;
        }
        break;
      case "up":
        c.rotation.z = Math.sin(this.timer * 9) * 0.08;
        if (this.timer <= 0) {
          this.phase = "ducking";
          this.timer = 0.3;
          setHittable(c, false);
        }
        break;
      case "ducking":
        c.position.y = this.downY + (this.upY - this.downY) * Math.max(0, this.timer) / 0.3;
        if (this.timer <= 0) {
          this.phase = "hidden";
          this.timer = 5 + Math.random() * 6;
          c.visible = false;
        }
        break;
    }
  }

  reset(): void {
    super.reset();
    this.phase = "hidden";
    this.timer = 3 + Math.random() * 3;
    this.chicken.visible = false;
    this.chicken.position.y = this.downY;
    setHittable(this.chicken, false);
  }
}

export function createBonusTarget(placement: BonusPlacement, models: ModelLibrary, effects: Effects): BonusTarget {
  switch (placement.kind) {
    case "windmill":
      return new WindmillTarget(models.windmill, placement, effects);
    case "scarecrow":
      return new ScarecrowTarget(models.scarecrow, placement, effects);
    case "signpost":
      return new SignpostTarget(models.signpost, placement, effects);
    case "pumpkin":
      return new PumpkinTarget(models.pumpkin, placement, effects);
    case "peekaboo":
      return new PeekabooTarget(models.deer_stand, models.chicken, placement, effects);
  }
}
