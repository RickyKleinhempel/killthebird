import { describe, expect, it } from "vitest";
import { Weapon } from "../src/engine/Weapon";

describe("Weapon", () => {
  it("fires until empty, then reports empty", () => {
    const w = new Weapon(3, 1, 0);
    expect([w.fire(), w.fire(), w.fire(), w.fire()]).toEqual(["fired", "fired", "fired", "empty"]);
    expect(w.shells).toBe(0);
  });

  it("enforces the pump cooldown", () => {
    const w = new Weapon(8, 1, 0.2);
    expect(w.fire()).toBe("fired");
    expect(w.fire()).toBe("cooldown");
    w.update(0.21);
    expect(w.fire()).toBe("fired");
  });

  it("reloads the full magazine after reloadTime and blocks firing meanwhile", () => {
    const w = new Weapon(8, 1, 0);
    w.fire();
    w.fire();
    expect(w.reload()).toBe(true);
    expect(w.fire()).toBe("reloading");
    expect(w.update(0.5)).toBe(false);
    expect(w.update(0.6)).toBe(true);
    expect(w.shells).toBe(8);
    expect(w.reloading).toBe(false);
  });

  it("does not reload a full magazine", () => {
    const w = new Weapon(8, 1, 0);
    expect(w.reload()).toBe(false);
  });
});
