/** All GLB models the game loads from `<assetsBaseUrl>models/<name>.glb`. */
export const MODEL_NAMES = [
  "chicken",
  "tree_pine",
  "tree_pine_far",
  "tree_oak",
  "tree_oak_far",
  "tree_birch",
  "bush",
  "grass",
  "heather",
  "reeds",
  "fence",
  "stump",
  "rock",
  "haybale",
  "log_pile",
  "deer_stand",
  "signpost",
  "scarecrow",
  "windmill",
  "barn",
  "church",
  "pumpkin",
  "mountains",
  "cloud",
] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

/**
 * Wind sway amplitude at the top of a model, in metres per unit of scale.
 * Used to bake the `aWind` vertex attribute when static props are merged.
 */
export const WIND_AMPLITUDE: Partial<Record<ModelName, number>> = {
  grass: 0.14,
  reeds: 0.18,
  heather: 0.04,
  bush: 0.05,
  tree_birch: 0.16,
  tree_oak: 0.11,
  tree_pine: 0.08,
  tree_oak_far: 0.06,
  tree_pine_far: 0.04,
};
