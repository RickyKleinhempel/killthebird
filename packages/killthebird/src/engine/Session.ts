import { FIRE_COOLDOWN } from "./config";
import type { GameResult, GameState, HitLayer } from "./types";
import { Weapon, type FireResult } from "./Weapon";

export interface SessionOptions {
  duration: number;
  shells: number;
  reloadTime: number;
}

const emptyHits = (): Record<HitLayer, number> => ({ near: 0, mid: 0, far: 0, bonus: 0 });

/**
 * Rendering-independent game rules: state machine, timer, score and weapon.
 * The Game class drives it every frame and maps its results to visuals.
 */
export class Session {
  state: GameState = "loading";
  score = 0;
  hits = 0;
  shots = 0;
  timeLeft: number;
  elapsed = 0;
  hitsByLayer = emptyHits();
  readonly weapon: Weapon;
  private stateBeforePause: GameState = "playing";

  constructor(readonly options: SessionOptions) {
    this.timeLeft = options.duration;
    this.weapon = new Weapon(options.shells, options.reloadTime, FIRE_COOLDOWN);
  }

  /** Assets are loaded; show the start screen. */
  setReady(): void {
    if (this.state === "loading") this.state = "ready";
  }

  setError(): void {
    this.state = "error";
  }

  start(): boolean {
    if (this.state !== "ready" && this.state !== "ended") return false;
    this.score = 0;
    this.hits = 0;
    this.shots = 0;
    this.elapsed = 0;
    this.hitsByLayer = emptyHits();
    this.timeLeft = this.options.duration;
    this.weapon.reset();
    this.state = "playing";
    return true;
  }

  pause(): boolean {
    if (this.state !== "playing") return false;
    this.stateBeforePause = this.state;
    this.state = "paused";
    return true;
  }

  resume(): boolean {
    if (this.state !== "paused") return false;
    this.state = this.stateBeforePause;
    return true;
  }

  /** Back to the start screen without reporting a result. */
  reset(): boolean {
    if (this.state === "loading" || this.state === "error") return false;
    this.state = "ready";
    this.timeLeft = this.options.duration;
    this.score = 0;
    this.weapon.reset();
    return true;
  }

  fire(): FireResult | "inactive" {
    if (this.state !== "playing") return "inactive";
    const result = this.weapon.fire();
    if (result === "fired") this.shots++;
    return result;
  }

  reload(): boolean {
    return this.state === "playing" && this.weapon.reload();
  }

  registerHit(points: number, layer: HitLayer): void {
    if (this.state !== "playing") return;
    this.score += points;
    this.hits++;
    this.hitsByLayer[layer]++;
  }

  /**
   * Advances the round. Returns flags for things that happened this frame.
   */
  update(dt: number): { reloaded: boolean; ended: boolean } {
    if (this.state !== "playing") return { reloaded: false, ended: false };
    const reloaded = this.weapon.update(dt);
    this.elapsed += Math.min(dt, this.timeLeft);
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) {
      this.state = "ended";
      return { reloaded, ended: true };
    }
    return { reloaded, ended: false };
  }

  result(): GameResult {
    return {
      score: this.score,
      hits: this.hits,
      shots: this.shots,
      accuracy: this.shots === 0 ? 0 : this.hits / this.shots,
      durationMs: Math.round(this.elapsed * 1000),
      hitsByLayer: { ...this.hitsByLayer },
    };
  }
}
