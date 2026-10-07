import { createNoise2D } from "./rng";

/** Distance from the camera where the flat play field turns into hills. */
export const HILLS_START = 46;
export const HILLS_FULL = 125;

/** Moorland pond between the near and middle layer (see shaders/water.ts). */
export const POND = { x: -4, z: -19.5, rx: 7, rz: 3.4, level: -0.28, depth: 1.0 } as const;

export type HeightFn = (x: number, z: number) => number;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Normalised distance to the pond centre: 1 = bowl rim. */
export function pondDistance(x: number, z: number): number {
  return Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
}

/** Rolling moorland: flat in front, a pond, hills rising towards the horizon. */
export function createTerrain(seed: number): { height: HeightFn; noise: (x: number, z: number) => number } {
  const n1 = createNoise2D(seed * 31 + 1);
  const n2 = createNoise2D(seed * 31 + 2);
  const n3 = createNoise2D(seed * 31 + 3);

  const height: HeightFn = (x, z) => {
    const d = -z;
    let h = n3(x * 0.15, z * 0.15) * 0.12;
    const ramp = smoothstep(HILLS_START, HILLS_FULL, d);
    if (ramp > 0) {
      const big = 0.5 + 0.5 * n1(x * 0.011, z * 0.018);
      const mid = n2(x * 0.035, z * 0.04);
      h += ramp * (6 + 16 * big + 3 * mid) + smoothstep(150, 260, d) * 18;
    }
    const pd = pondDistance(x, z);
    if (pd < 1.35) h -= (1 - smoothstep(0.5, 1.28, pd)) * POND.depth;
    return h;
  };

  return { height, noise: (x, z) => n2(x * 0.08 + 100, z * 0.08 + 100) };
}
