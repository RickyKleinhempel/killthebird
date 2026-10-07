import { CAMERA } from "./config";
import type { ModelName } from "./models";
import { createRng, pick, range } from "./rng";
import { POND, type HeightFn } from "./terrain";
import type { BonusKind } from "./types";

/** Depth layers of the panorama, front to back. */
export type LayerId = "foreground" | "near" | "mid" | "far" | "sky";

export interface Placement {
  model: ModelName;
  layer: LayerId;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

export interface BonusPlacement {
  kind: BonusKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

export interface CloudPlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  speed: number;
}

export interface LevelLayout {
  props: Placement[];
  bonuses: BonusPlacement[];
  clouds: CloudPlacement[];
}

/** Half width that must be covered with scenery at a given depth. */
export function layerExtent(depth: number): number {
  // Wide enough for ultra-wide screens (aspect 2.4) at either end of the camera range.
  return CAMERA.range + Math.abs(depth) * 1.0 + 4;
}

class Occupancy {
  private spots: { x: number; z: number; r: number }[] = [];
  add(x: number, z: number, r: number) {
    this.spots.push({ x, z, r });
  }
  free(x: number, z: number, r: number): boolean {
    return this.spots.every((s) => Math.hypot(s.x - x, (s.z - z) * 0.6) > s.r + r);
  }
}

export function generateLevel(seed: number, height: HeightFn): LevelLayout {
  const rng = createRng(seed);
  const props: Placement[] = [];
  const bonuses: BonusPlacement[] = [];
  const occupied = new Occupancy();

  const place = (model: ModelName, layer: LayerId, x: number, z: number, scale: number, rotY = range(rng, -0.4, 0.4)) => {
    props.push({ model, layer, x, y: height(x, z), z, scale, rotY });
  };
  const bonus = (kind: BonusKind, x: number, z: number, scale = 1, rotY = 0) => {
    bonuses.push({ kind, x, y: height(x, z), z, scale, rotY });
    occupied.add(x, z, kind === "windmill" ? 5 : 2.2);
  };

  // --- Hero objects and bonus targets -------------------------------------
  bonus("peekaboo", -17, -15, 1.15, 0.15); // deer stand with a chicken peeking out
  bonus("signpost", 7, -10.5, 1.1, -0.2);
  bonus("scarecrow", 27, -13, 1.15, -0.1);
  bonus("pumpkin", -20.5, -10.5, 1.4);
  bonus("pumpkin", 15.5, -12.5, 1.3);
  bonus("pumpkin", 4.5, -15, 1.3);
  bonus("windmill", 46, -40, 1.6, -0.35);

  place("barn", "mid", -31, -41, 1.7, 0.35);
  occupied.add(-31, -41, 6);
  place("church", "far", -58, -104, 2.2, 0.5);
  occupied.add(-58, -104, 6);
  // Farmyard details next to the barn
  place("haybale", "mid", -24.5, -38.5, 1.2, 0.25);
  place("haybale", "mid", -22.8, -40.6, 1.15, 1.4);
  place("haybale", "mid", -25.6, -42.3, 1.1, -0.4);
  place("log_pile", "mid", -37.5, -38.2, 1.15, -0.3);
  occupied.add(-24, -40.5, 3);
  occupied.add(-37.5, -38.2, 2);

  // Pond: keep it free, ring it with reeds (mostly on the far side)
  occupied.add(POND.x, POND.z, POND.rx + 1.5);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + range(rng, -0.15, 0.15);
    const front = Math.sin(a) > 0.35; // +z side faces the camera
    if (front && rng() < 0.7) continue;
    const rim = range(rng, 0.98, 1.12);
    const x = POND.x + Math.cos(a) * POND.rx * rim;
    const z = POND.z + Math.sin(a) * POND.rz * rim;
    place("reeds", "mid", x, z, range(rng, 0.9, 1.3), range(rng, 0, 6.3));
  }

  // --- Foreground: grass, bushes, stumps, fences ---------------------------
  const fg = layerExtent(7);
  // Tall tufts as accents; the instanced grass field (shaders/grass.ts) covers the ground.
  for (let x = -fg; x < fg; x += range(rng, 1.1, 2.4)) {
    place("grass", "foreground", x, range(rng, -4.6, -7.4), range(rng, 1.1, 1.9), range(rng, 0, Math.PI * 2));
  }
  for (let x = -fg; x < fg; x += range(rng, 6, 12)) {
    place("heather", "foreground", x, range(rng, -5.5, -7.8), range(rng, 1.0, 1.5), range(rng, 0, Math.PI * 2));
  }
  for (let x = -fg; x < fg; x += range(rng, 5, 9)) {
    place("bush", "foreground", x, range(rng, -5.2, -7.2), range(rng, 0.9, 1.4), range(rng, 0, Math.PI * 2));
  }
  for (const x of [-36, -9, 21, 44]) place("stump", "foreground", x + range(rng, -2, 2), range(rng, -5.5, -7), range(rng, 0.9, 1.2));
  for (const x of [-46, -26, 2, 33]) place("rock", "foreground", x + range(rng, -2, 2), range(rng, -5, -7), range(rng, 0.8, 1.3), range(rng, 0, 6));
  fenceRun(-30, 5, -8.6);
  fenceRun(12, 6, -8.9);

  function fenceRun(startX: number, segments: number, z: number) {
    for (let i = 0; i < segments; i++) place("fence", "foreground", startX + i * 2.1, z + range(rng, -0.08, 0.08), 1, range(rng, -0.05, 0.05));
  }

  // --- Near layer -----------------------------------------------------------
  const nearExt = layerExtent(17);
  for (let x = -nearExt; x < nearExt; x += range(rng, 1.6, 3.2)) {
    const z = range(rng, -9.5, -17);
    if (occupied.free(x, z, 0.4)) place("grass", "near", x, z, range(rng, 1.0, 1.6), range(rng, 0, 6.3));
  }
  for (let x = -nearExt; x < nearExt; x += range(rng, 3, 7)) {
    const z = range(rng, -10, -18);
    if (occupied.free(x, z, 0.8)) place("heather", "near", x, z, range(rng, 1.1, 1.8), range(rng, 0, 6.3));
  }
  for (let x = -nearExt; x < nearExt; x += range(rng, 4, 8)) {
    const z = range(rng, -11, -17);
    if (occupied.free(x, z, 1)) place(rng() < 0.75 ? "bush" : "rock", "near", x, z, range(rng, 1.0, 1.6), range(rng, 0, 6.3));
  }
  // Big trees close to the camera; keep the windmill (x 46) and barn (x -31) in view.
  for (const [x, z] of [
    [-41, -17],
    [13, -19],
    [-55, -16],
    [59, -17],
  ] as const) {
    place("tree_oak", "near", x, z, range(rng, 1.5, 1.8), range(rng, 0, 6.3));
    occupied.add(x, z, 3);
  }

  // --- Mid layer: groves, barn, windmill ----------------------------------
  const midExt = layerExtent(50);
  for (let x = -midExt; x < midExt; x += range(rng, 4, 9)) {
    const groveSize = rng() < 0.3 ? 0 : 1 + Math.floor(rng() * 3);
    for (let i = 0; i < groveSize; i++) {
      const tx = x + range(rng, -2.5, 2.5);
      const tz = range(rng, -24, -50);
      if (!occupied.free(tx, tz, 1.6)) continue;
      const kind = rng();
      place(kind < 0.5 ? "tree_pine" : kind < 0.8 ? "tree_oak" : "tree_birch", "mid", tx, tz, range(rng, 1.2, 1.9), range(rng, 0, 6.3));
      occupied.add(tx, tz, 1.2);
    }
  }
  for (let x = -midExt; x < midExt; x += range(rng, 3, 6)) {
    const z = range(rng, -22, -48);
    if (occupied.free(x, z, 1)) place(pick(rng, ["bush", "bush", "rock", "heather", "heather"] as const), "mid", x, z, range(rng, 1.2, 2), range(rng, 0, 6.3));
  }

  // --- Far layer: forest belts on the hills --------------------------------
  const farExt = layerExtent(130);
  for (let x = -farExt; x < farExt; x += range(rng, 1.6, 3.4)) {
    const belt = Math.sin(x * 0.035 + seed) + Math.sin(x * 0.09 + seed * 2);
    if (belt < -0.4) continue; // open moorland between the forests
    const rows = belt > 0.8 ? 3 : belt > 0.2 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const z = range(rng, -64, -128);
      if (!occupied.free(x, z, 1.5)) continue;
      place(rng() < 0.8 ? "tree_pine_far" : "tree_oak_far", "far", x, z, range(rng, 2.2, 3.4), range(rng, 0, 6.3));
    }
  }

  // --- Sky: mountain range and clouds --------------------------------------
  for (let x = -460; x <= 460; x += range(rng, 150, 190)) {
    props.push({ model: "mountains", layer: "sky", x, y: -8, z: range(rng, -360, -400), scale: range(rng, 1.05, 1.45), rotY: range(rng, -0.3, 0.3) });
  }

  const clouds: CloudPlacement[] = [];
  for (let i = 0; i < 14; i++) {
    clouds.push({
      x: range(rng, -360, 360),
      y: range(rng, 55, 105),
      z: range(rng, -200, -270),
      scale: range(rng, 1.2, 2.4),
      speed: range(rng, 0.8, 2.2),
    });
  }

  return { props, bonuses, clouds };
}
