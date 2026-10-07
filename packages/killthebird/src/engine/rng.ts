/** Deterministic PRNG (mulberry32). Returns floats in [0, 1). */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length]!;
}

export function weightedPick<K extends string>(rng: Rng, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries[entries.length - 1]![0];
}

/** Smooth 2D value noise in roughly [-1, 1], seeded. */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  const perm = new Uint8Array(512);
  const rng = createRng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  const values = Float32Array.from({ length: 256 }, () => rng() * 2 - 1);

  const lattice = (ix: number, iy: number) => values[perm[(perm[ix & 255]! + iy) & 255]!]!;
  const fade = (t: number) => t * t * (3 - 2 * t);

  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(x - ix);
    const fy = fade(y - iy);
    const a = lattice(ix, iy);
    const b = lattice(ix + 1, iy);
    const c = lattice(ix, iy + 1);
    const d = lattice(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
