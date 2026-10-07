import {
  AnimationMixer,
  Group,
  Mesh,
  MeshBasicMaterial,
  type AnimationAction,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { fitToLength, instantiate, type ModelAsset } from "../Assets";
import { BIRD_LAYERS } from "../config";
import type { HeightFn } from "../terrain";
import type { BirdLayer } from "../types";
import type { BirdSpawn } from "./spawn";

/** Layer used for shot raycasts; the camera only renders layer 0. */
export const HIT_LAYER = 1;
const DISABLED_LAYER = 31;
/** Every bird model is normalised to this body length. */
export const BIRD_LENGTH = 0.8;

export type BirdState = "idle" | "flying" | "falling" | "landed";

/** Shared white material for the short hit flash. */
const FLASH_MATERIAL = new MeshBasicMaterial({ color: 0xffffff, fog: false });
const FLASH_TIME = 0.09;

export class Bird {
  readonly root = new Group();
  readonly hitbox: Mesh;
  state: BirdState = "idle";
  layer: BirdLayer = "near";
  private readonly mixer: AnimationMixer;
  private readonly action: AnimationAction | null;
  private spawn!: BirdSpawn;
  private t = 0;
  private baseY = 0;
  private vy = 0;
  private vx = 0;
  private spinX = 0;
  private spinZ = 0;
  private landedTime = 0;
  private readonly zBand: [number, number] = [0, 0];
  private readonly pupils: Object3D | null;
  private readonly crossEyes: Object3D | null;
  private readonly flashMeshes: { mesh: Mesh; material: Material | Material[] }[] = [];
  private flash = 0;

  constructor(asset: ModelAsset, hitGeometry: BufferGeometry, hitMaterial: Material) {
    const model = instantiate(asset);
    // Normalise size and centre so all layers can use the same scale logic.
    fitToLength(model, BIRD_LENGTH, "center");
    this.root.add(model);
    this.pupils = model.getObjectByName("Pupils") ?? null;
    this.crossEyes = model.getObjectByName("XEyes") ?? null;
    if (this.crossEyes) this.crossEyes.visible = false;
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) this.flashMeshes.push({ mesh, material: mesh.material });
    });

    this.mixer = new AnimationMixer(model);
    const clip = asset.animations.find((c) => c.name === "fly") ?? asset.animations[0];
    this.action = clip ? this.mixer.clipAction(clip) : null;
    this.action?.play();

    this.hitbox = new Mesh(hitGeometry, hitMaterial);
    this.hitbox.layers.set(DISABLED_LAYER);
    this.hitbox.userData.shootable = this;
    this.root.add(this.hitbox);

    this.root.visible = false;
    this.root.name = "bird";
  }

  get active(): boolean {
    return this.state !== "idle";
  }

  get alive(): boolean {
    return this.state === "flying";
  }

  get points(): number {
    return BIRD_LAYERS[this.layer].points;
  }

  get scale(): number {
    return this.root.scale.x;
  }

  activate(spawn: BirdSpawn): void {
    this.spawn = spawn;
    this.layer = spawn.layer;
    this.state = "flying";
    this.t = 0;
    this.baseY = spawn.y;
    const cfg = BIRD_LAYERS[spawn.layer];
    this.zBand[0] = cfg.zMin;
    this.zBand[1] = cfg.zMax;
    this.root.position.set(spawn.x, spawn.y, spawn.z);
    this.root.scale.setScalar(spawn.scale);
    this.root.rotation.set(0, spawn.dir > 0 ? -0.35 : Math.PI + 0.35, 0);
    this.root.visible = true;
    this.hitbox.layers.set(HIT_LAYER);
    this.setEyes(false);
    this.setFlash(false);
    if (this.action) {
      this.action.timeScale = 0.9 + Math.random() * 0.5;
      this.action.time = Math.random() * this.action.getClip().duration;
      this.action.paused = false;
    }
  }

  hit(): void {
    if (this.state !== "flying") return;
    this.state = "falling";
    this.hitbox.layers.set(DISABLED_LAYER);
    const depth = Math.abs(this.root.position.z);
    this.vy = depth * 0.12;
    this.vx = this.spawn.dir * this.spawn.speed * 0.25;
    this.spinX = (Math.random() - 0.5) * 8;
    this.spinZ = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6);
    if (this.action) this.action.timeScale = 3.5;
    this.setEyes(true);
    this.setFlash(true);
    this.flash = FLASH_TIME;
  }

  /** Knocked-out cross eyes while falling. */
  private setEyes(knockedOut: boolean): void {
    if (this.pupils) this.pupils.visible = !knockedOut;
    if (this.crossEyes) this.crossEyes.visible = knockedOut;
  }

  private setFlash(on: boolean): void {
    for (const { mesh, material } of this.flashMeshes) mesh.material = on ? FLASH_MATERIAL : material;
  }

  deactivate(): void {
    this.state = "idle";
    this.root.visible = false;
    this.hitbox.layers.set(DISABLED_LAYER);
  }

  /** Returns false when the bird should go back to the pool. */
  update(dt: number, bound: number, height: HeightFn): boolean {
    if (this.state === "idle") return false;
    this.mixer.update(dt);
    const p = this.root.position;
    const s = this.spawn;

    if (this.state === "flying") {
      this.t += dt;
      p.x += s.dir * s.speed * dt;
      p.z += s.zDrift * dt;
      if (p.z < this.zBand[0] || p.z > this.zBand[1]) {
        s.zDrift = -s.zDrift;
        p.z = Math.min(this.zBand[1], Math.max(this.zBand[0], p.z));
      }
      const w = s.bobFreq * Math.PI * 2;
      p.y = this.baseY + Math.sin(s.phase + this.t * w) * s.bobAmp;
      // Bank slightly with the vertical movement.
      this.root.rotation.z = Math.cos(s.phase + this.t * w) * 0.22 * s.dir;
      return s.dir > 0 ? p.x < bound : p.x > -bound;
    }

    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) this.setFlash(false);
    }

    if (this.state === "falling") {
      const depth = Math.abs(p.z);
      this.vy -= depth * 0.9 * dt;
      p.x += this.vx * dt;
      p.y += this.vy * dt;
      this.root.rotation.x += this.spinX * dt;
      this.root.rotation.z += this.spinZ * dt;
      if (this.action) this.action.timeScale = Math.max(0, this.action.timeScale - dt * 3);
      const ground = height(p.x, p.z) + 0.25 * this.scale;
      if (p.y <= ground) {
        p.y = ground;
        this.state = "landed";
        this.landedTime = 0;
        this.root.rotation.set(0, this.root.rotation.y, Math.PI * 0.5 * Math.sign(this.spinZ));
      }
      return true;
    }

    // Landed: lie still briefly, then shrink away.
    this.landedTime += dt;
    if (this.landedTime > 0.7) {
      const k = Math.max(0, 1 - (this.landedTime - 0.7) / 0.3);
      this.root.scale.setScalar(s.scale * k);
      if (k === 0) return false;
    }
    return true;
  }
}
