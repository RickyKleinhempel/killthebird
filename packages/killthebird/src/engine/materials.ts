import { Color, Material, MeshStandardMaterial, type Object3D, type Mesh } from "three";
import { patchMaterial } from "./shaders/patch";

/**
 * Shared low-poly palette. Names match the materials created by the Blender
 * scripts (assets-src/blender/common.py), so GLB models and code-built
 * placeholders end up using the same material instances and can be merged.
 */
export const PALETTE = {
  grass: 0x7d8f3c,
  grass_dry: 0xa89a55,
  heather: 0x7a5a6a,
  leaf: 0x557f30,
  leaf_dark: 0x3a5d2b,
  leaf_autumn: 0xc4782d,
  bark: 0x5b3f2a,
  wood: 0x8f6a43,
  wood_dark: 0x5e4630,
  stone: 0x8d8a83,
  roof: 0x9a3f2f,
  wall: 0xe0d5bd,
  white: 0xf1ece2,
  pumpkin: 0xe0761f,
  stem: 0x4e6b2a,
  straw: 0xd8b860,
  cloth: 0x4d6a8c,
  cloth_red: 0xa83a32,
  chicken_body: 0x7b4a2b,
  chicken_wing: 0x5e3720,
  chicken_belly: 0xc08a50,
  beak: 0xeaa832,
  comb: 0xcc2f28,
  eye: 0x141414,
  mountain: 0x7e8796,
  snow: 0xf3f5f9,
  cloud: 0xffffff,
} as const;

export type PaletteName = keyof typeof PALETTE;

const registry = new Map<string, Material>();

/** Clouds glow softly instead of picking up the brown ground bounce light. */
function styleCloud(material: MeshStandardMaterial): void {
  material.fog = false;
  material.emissive.set(0xdfe8f2);
  material.emissiveIntensity = 0.55;
}

/** Game look for every lit material: aerial perspective + rim light. */
function styleLit(material: MeshStandardMaterial, name: string): void {
  if (name === "cloud") styleCloud(material);
  else patchMaterial(material, { rim: true });
}

function createPaletteMaterial(name: string, color: number): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    name,
    color: new Color(color),
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  styleLit(material, name);
  return material;
}

/** Returns the shared material for a palette entry. */
export function paletteMaterial(name: PaletteName): Material {
  let material = registry.get(name);
  if (!material) {
    material = createPaletteMaterial(name, PALETTE[name]);
    registry.set(name, material);
  }
  return material;
}

/**
 * Replaces materials inside a loaded model with shared instances keyed by
 * name (first one wins) and applies the game's look (flat, matte).
 */
export function canonicalizeMaterials(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: Material): Material => {
      const key = m.name || m.uuid;
      const existing = registry.get(key);
      if (existing) return existing;
      if (m instanceof MeshStandardMaterial) {
        m.flatShading = true;
        m.roughness = Math.max(m.roughness, 0.85);
        m.metalness = 0;
        styleLit(m, key);
        m.needsUpdate = true;
      }
      registry.set(key, m);
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}
