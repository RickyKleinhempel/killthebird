import type { BirdLayer, BonusKind, Difficulty, GameOptions } from "./types";

export type ResolvedOptions = Required<GameOptions>;

export const DEFAULT_OPTIONS: ResolvedOptions = {
  assetsBaseUrl: "/killthebird/",
  duration: 90,
  shells: 8,
  reloadTime: 1.1,
  difficulty: "normal",
  muted: false,
  musicVolume: 0.45,
  sfxVolume: 0.9,
  seed: 7,
  autoStart: false,
  debug: false,
  maxPixelRatio: 2,
  adaptiveQuality: true,
};

export function resolveOptions(options: GameOptions = {}): ResolvedOptions {
  const defined = Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined),
  ) as GameOptions;
  const merged = { ...DEFAULT_OPTIONS, ...defined };
  if (!merged.assetsBaseUrl.endsWith("/")) merged.assetsBaseUrl += "/";
  return merged;
}

/** Minimum time between two shots (pump action). */
export const FIRE_COOLDOWN = 0.22;

export const CAMERA = {
  /** Eye height above the ground. */
  height: 2.2,
  /** Vertical field of view in degrees for landscape screens. */
  fov: 45,
  /** Upward pitch in degrees. */
  pitch: 3,
  /** Camera travels between -range and +range on x. */
  range: 40,
  /** Width of the scroll zone at each side, as a fraction of the viewport width. */
  edge: 0.18,
  /** Maximum scroll speed in world units per second. */
  maxSpeed: 42,
  /** Small pointer-follow rotation (degrees) to make the scene feel 3D. */
  lookYaw: 1.6,
  lookPitch: 1.2,
} as const;

export interface BirdLayerConfig {
  zMin: number;
  zMax: number;
  points: number;
  /** World scale of the bird model (normalised to 0.8 units body length). */
  scale: number;
  /** Elevation band in degrees above the horizontal eye line. */
  elevMin: number;
  elevMax: number;
  /** Angular flight speed in radians per second (seen from the camera). */
  angularSpeed: number;
  /** Relative spawn weight. */
  weight: number;
}

export const BIRD_LAYERS: Record<BirdLayer, BirdLayerConfig> = {
  near: { zMin: -16, zMax: -10, points: 5, scale: 1.7, elevMin: -4, elevMax: 19, angularSpeed: 0.4, weight: 0.36 },
  mid: { zMin: -44, zMax: -26, points: 10, scale: 2.5, elevMin: 1, elevMax: 19, angularSpeed: 0.3, weight: 0.4 },
  far: { zMin: -92, zMax: -66, points: 25, scale: 2.9, elevMin: 7, elevMax: 19, angularSpeed: 0.22, weight: 0.24 },
};

export interface DifficultyConfig {
  maxBirds: number;
  spawnMin: number;
  spawnMax: number;
  speed: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { maxBirds: 8, spawnMin: 0.9, spawnMax: 1.8, speed: 0.7 },
  normal: { maxBirds: 11, spawnMin: 0.6, spawnMax: 1.4, speed: 1 },
  hard: { maxBirds: 14, spawnMin: 0.4, spawnMax: 1.0, speed: 1.35 },
};

/** Size of the bird pool; must cover the hardest difficulty. */
export const BIRD_POOL_SIZE = 16;

export const BONUS_POINTS: Record<BonusKind, number> = {
  windmill: 25,
  scarecrow: 15,
  signpost: 10,
  pumpkin: 15,
  peekaboo: 50,
};

export function birdLayerForDepth(z: number): BirdLayer {
  if (z > -20) return "near";
  if (z > -55) return "mid";
  return "far";
}
