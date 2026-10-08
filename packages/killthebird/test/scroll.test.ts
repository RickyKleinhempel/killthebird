import { describe, expect, it } from "vitest";
import { edgeScrollFactor, fovForAspect, halfWidthAtDepth, stepScroll } from "../src/engine/scroll";

describe("edgeScrollFactor", () => {
  it("is zero in the centre and grows towards the edges", () => {
    expect(edgeScrollFactor(0.5, 0.18)).toBe(0);
    expect(edgeScrollFactor(0.82, 0.18)).toBe(0);
    expect(edgeScrollFactor(0, 0.18)).toBe(-1);
    expect(edgeScrollFactor(1, 0.18)).toBeCloseTo(1);
    expect(edgeScrollFactor(0.09, 0.18)).toBeCloseTo(-0.25);
    expect(edgeScrollFactor(-3, 0.18)).toBe(-1);
  });
});

describe("stepScroll", () => {
  it("accelerates smoothly and clamps to the panorama", () => {
    let s = { x: 0, velocity: 0 };
    s = stepScroll(s, 40, 1 / 60, 40);
    expect(s.velocity).toBeGreaterThan(0);
    expect(s.velocity).toBeLessThan(40);
    for (let i = 0; i < 600; i++) s = stepScroll(s, 40, 1 / 60, 40);
    expect(s.x).toBe(40);
    expect(s.velocity).toBe(0);
  });

  it("can update a state in place", () => {
    const fresh = stepScroll({ x: 3, velocity: 5 }, 40, 1 / 60, 40);
    const s = { x: 3, velocity: 5 };
    expect(stepScroll(s, 40, 1 / 60, 40, s)).toBe(s);
    expect(s).toEqual(fresh);
  });
});

describe("camera helpers", () => {
  it("computes the visible half width", () => {
    expect(halfWidthAtDepth(-10, 90, 1)).toBeCloseTo(10);
  });
  it("widens the fov on portrait screens only", () => {
    expect(fovForAspect(45, 16 / 9)).toBe(45);
    expect(fovForAspect(45, 0.6)).toBeGreaterThan(45);
  });
});
