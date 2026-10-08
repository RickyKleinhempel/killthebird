import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine/rng";
import { globalUniforms } from "../src/engine/shaders/common";
import {
  MAX_WIND_STRENGTH,
  NATURAL_LEAN,
  WIND_LEAN,
  createGrassField,
  type GrassField,
  type GrassFieldOptions,
} from "../src/engine/shaders/grass";

function options(tileWidth: number): GrassFieldOptions {
  return {
    rng: createRng(42),
    height: (x, z) => Math.sin(x * 0.3) * 0.4 + z * 0.02,
    clump: (x, z) => Math.sin(x * 1.3 + z * 0.7),
    halfWidth: (z) => 20 + Math.abs(z),
    blocked: (x, z) => Math.hypot(x - 3, z + 8) < 2,
    bands: [
      { zNear: -3, zFar: -9, density: 6, minHeight: 0.28, maxHeight: 0.55 },
      { zNear: -9, zFar: -20, density: 2, minHeight: 0.5, maxHeight: 0.95 },
    ],
    tileWidth,
  };
}

/** Every blade as "x,y,z|h,w,a,d|r", sorted, to compare fields regardless of tile order. */
function blades(field: GrassField): string[] {
  const out: string[] = [];
  for (const tile of field.tiles) {
    const g = tile.geometry;
    const off = g.getAttribute("aOffset");
    const par = g.getAttribute("aParams");
    const rnd = g.getAttribute("aRand");
    for (let i = 0; i < g.instanceCount; i++) {
      out.push(`${off.getX(i)},${off.getY(i)},${off.getZ(i)}|${par.getX(i)},${par.getY(i)},${par.getZ(i)},${par.getW(i)}|${rnd.getX(i)}`);
    }
  }
  return out.sort();
}

describe("createGrassField", () => {
  it("splits the field into tiles without losing or changing blades", () => {
    const single = createGrassField(options(Infinity));
    const tiled = createGrassField(options(8));
    expect(single.tiles).toHaveLength(2); // one per band
    expect(tiled.tiles.length).toBeGreaterThan(8);
    expect(tiled.name).toBe("grass-field");
    const reference = blades(single);
    expect(reference.length).toBeGreaterThan(500);
    expect(blades(tiled)).toEqual(reference);
    for (const tile of tiled.tiles) {
      expect(tile.frustumCulled).toBe(true);
      expect(tile.material).toBe(tiled.material);
    }
  });

  it("rejects a non-positive tile width", () => {
    expect(() => createGrassField(options(0))).toThrow(RangeError);
  });

  it("bounds every blade of a tile including its full wind lean", () => {
    const field = createGrassField(options(8));
    // Strongest lean the shader produces at the supported wind strength.
    expect(globalUniforms.uWindStrength.value).toBeLessThanOrEqual(MAX_WIND_STRENGTH);
    const lean = WIND_LEAN * MAX_WIND_STRENGTH + NATURAL_LEAN;
    const p = new Vector3();
    for (const tile of field.tiles) {
      const g = tile.geometry;
      const box = g.boundingBox!;
      const sphere = g.boundingSphere!;
      const off = g.getAttribute("aOffset");
      const par = g.getAttribute("aParams");
      for (let i = 0; i < g.instanceCount; i++) {
        const h = par.getX(i);
        const r = h * lean + par.getY(i) / 2;
        for (const [dx, dy, dz] of [
          [-r, 0, -r],
          [r, h, r],
          [-r, h, r],
          [r, 0, -r],
        ] as const) {
          p.set(off.getX(i) + dx, off.getY(i) + dy, off.getZ(i) + dz);
          expect(box.containsPoint(p)).toBe(true);
          expect(sphere.containsPoint(p)).toBe(true);
        }
      }
    }
  });
});
