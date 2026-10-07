export type FireResult = "fired" | "empty" | "reloading" | "cooldown";

/** Pump-action shotgun: fixed magazine, full reload in one go. */
export class Weapon {
  shells: number;
  private reloadLeft = 0;
  private cooldownLeft = 0;

  constructor(
    readonly capacity: number,
    readonly reloadTime: number,
    readonly cooldown: number,
  ) {
    this.shells = capacity;
  }

  get reloading(): boolean {
    return this.reloadLeft > 0;
  }

  fire(): FireResult {
    if (this.reloading) return "reloading";
    if (this.shells <= 0) return "empty";
    if (this.cooldownLeft > 0) return "cooldown";
    this.shells--;
    this.cooldownLeft = this.cooldown;
    return "fired";
  }

  /** Returns true when a reload was started. */
  reload(): boolean {
    if (this.reloading || this.shells >= this.capacity) return false;
    this.reloadLeft = this.reloadTime;
    return true;
  }

  /** Advances timers. Returns true in the frame the reload completes. */
  update(dt: number): boolean {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    if (!this.reloading) return false;
    this.reloadLeft -= dt;
    if (this.reloadLeft > 0) return false;
    this.reloadLeft = 0;
    this.shells = this.capacity;
    return true;
  }

  reset(): void {
    this.shells = this.capacity;
    this.reloadLeft = 0;
    this.cooldownLeft = 0;
  }
}
