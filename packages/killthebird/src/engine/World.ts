import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Scene,
} from "three";
import { instantiate, type ModelLibrary } from "./Assets";
import { HIT_LAYER } from "./entities/Bird";
import { createBonusTarget, type BonusTarget } from "./entities/BonusTarget";
import type { Effects } from "./Effects";
import { generateLevel, layerExtent, type LayerId } from "./level";
import { PALETTE } from "./materials";
import { mergeStatic, tileGrid, type MergeSource } from "./merge";
import { WIND_AMPLITUDE } from "./models";
import { createRng } from "./rng";
import { createGrassField } from "./shaders/grass";
import { materialVariant, patchMaterial } from "./shaders/patch";
import { createSky } from "./shaders/sky";
import { Pond } from "./shaders/water";
import { POND, createTerrain, pondDistance, type HeightFn } from "./terrain";

export const SKY = {
  zenith: 0x4f8fd0,
  horizon: 0xd4e4ea,
  fogNear: 50,
  fogFar: 420,
} as const;

const SHADOW_LAYERS: ReadonlySet<LayerId> = new Set(["foreground", "near", "mid"]);

/**
 * Width of the x-tiles static props are merged into, per layer: narrow up
 * front where the view is narrow, wide at the back, the sky in one piece.
 * Balances draw calls against culling; the shadow camera sees most tiles of
 * the casting layers anyway, so narrower tiles only add shadow draw calls.
 */
const PROP_TILE: Partial<Record<LayerId, number>> = { foreground: 24, near: 32, mid: 48, far: 96 };

const GROUND = {
  grass: new Color(PALETTE.grass),
  dry: new Color(PALETTE.grass_dry),
  heather: new Color(PALETTE.heather),
  peat: new Color(0x4a4a2a),
};

interface Cloud {
  object: Object3D;
  speed: number;
}

/** Builds and animates the landscape: sky, terrain, water, grass, props, bonus targets. */
export class World {
  readonly root = new Group();
  readonly bonuses: BonusTarget[] = [];
  readonly height: HeightFn;
  readonly pond: Pond;
  private readonly clouds: Cloud[] = [];
  private readonly sun: DirectionalLight;
  private readonly sky: Mesh;
  private readonly owned: { dispose(): void }[] = [];

  constructor(
    private readonly scene: Scene,
    models: ModelLibrary,
    seed: number,
    effects: Effects,
  ) {
    this.root.name = "world";
    scene.add(this.root);
    scene.fog = new Fog(SKY.horizon, SKY.fogNear, SKY.fogFar);

    const terrain = createTerrain(seed);
    this.height = terrain.height;

    this.sky = createSky(SKY);
    scene.add(this.sky);
    this.owned.push(this.sky.geometry, this.sky.material as { dispose(): void });

    const hemi = new HemisphereLight(0xe2efff, 0x6d5a38, 1.5);
    this.root.add(hemi);
    this.sun = new DirectionalLight(0xfff0d6, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -60;
    sc.right = 60;
    sc.top = 40;
    sc.bottom = -40;
    sc.near = 1;
    sc.far = 200;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.root.add(this.sun, this.sun.target);

    for (const ground of this.createGround(terrain.noise)) this.root.add(ground);

    this.pond = new Pond(POND, SKY);
    this.pond.mesh.layers.enable(HIT_LAYER);
    this.root.add(this.pond.mesh);
    this.owned.push(this.pond);

    const grass = createGrassField({
      rng: createRng(seed * 101 + 5),
      height: this.height,
      clump: (x, z) => terrain.noise(x * 1.7, z * 1.7),
      halfWidth: (z) => layerExtent(z),
      blocked: (x, z) => pondDistance(x, z) < 1.08,
      bands: [
        { zNear: -3.2, zFar: -9, density: 12, minHeight: 0.28, maxHeight: 0.55 },
        { zNear: -9, zFar: -20, density: 7, minHeight: 0.35, maxHeight: 0.7 },
        { zNear: -20, zFar: -36, density: 2.2, minHeight: 0.5, maxHeight: 0.95 },
      ],
    });
    this.root.add(grass);
    this.owned.push(grass);

    const level = generateLevel(seed, this.height);

    const byLayer = new Map<LayerId, MergeSource[]>();
    for (const p of level.props) {
      const asset = models[p.model];
      const obj = instantiate(asset);
      obj.position.set(p.x, p.y, p.z);
      obj.scale.setScalar(p.scale);
      obj.rotation.y = p.rotY;
      let list = byLayer.get(p.layer);
      if (!list) byLayer.set(p.layer, (list = []));
      list.push({ object: obj, wind: WIND_AMPLITUDE[p.model] ?? 0, height: modelHeight(asset.scene) });
    }
    for (const [layer, sources] of byLayer) {
      const { meshes, leftovers } = mergeStatic(sources, { tileWidth: PROP_TILE[layer] });
      // Decided per layer, not per tile: the variant also adds the rim light.
      const swaying = layer !== "sky" && sources.some((s) => s.wind > 0);
      for (const mesh of meshes) {
        if (swaying && mesh.material instanceof MeshStandardMaterial) {
          mesh.material = materialVariant(mesh.material, { wind: true, rim: true });
        }
        mesh.castShadow = SHADOW_LAYERS.has(layer);
        mesh.receiveShadow = layer !== "sky";
        if (layer !== "sky") mesh.layers.enable(HIT_LAYER);
        mesh.userData.layer = layer;
        this.root.add(mesh);
        this.owned.push(mesh.geometry);
      }
      for (const obj of leftovers) this.root.add(obj);
    }

    for (const placement of level.bonuses) {
      const target = createBonusTarget(placement, models, effects);
      this.bonuses.push(target);
      this.root.add(target.root);
    }

    for (const c of level.clouds) {
      const cloud = instantiate(models.cloud);
      cloud.position.set(c.x, c.y, c.z);
      cloud.scale.setScalar(c.scale);
      this.clouds.push({ object: cloud, speed: c.speed });
      this.root.add(cloud);
    }
  }

  private groundColor(x: number, z: number, noise: (x: number, z: number) => number, out: Color): Color {
    const n = noise(x, z);
    const n2 = noise(x * 0.37 + 50, z * 0.37 - 20);
    out.copy(GROUND.grass).lerp(GROUND.dry, Math.max(0, n) * 0.9);
    out.lerp(GROUND.heather, Math.max(0, n2 - 0.15) * 1.1);
    // Dark peat and wet moss around the pond
    const pd = pondDistance(x, z);
    if (pd < 1.7) out.lerp(GROUND.peat, (1 - Math.min(1, Math.max(0, (pd - 0.9) / 0.8))) * 0.75);
    return out;
  }

  /**
   * Two grids: 1.25 m cells in the play area, 5 m cells behind. The near grid's
   * last row is interpolated from the coarse grid so the seam has no cracks.
   */
  private createGround(noise: (x: number, z: number) => number): Mesh[] {
    const material = patchMaterial(
      new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, name: "ground" }),
      { groundDetail: true },
    );
    this.owned.push(material);
    const color = new Color();
    const seamZ = -62;

    const build = (
      x0: number,
      x1: number,
      z0: number,
      z1: number,
      step: number,
      tile: [cols: number, rows: number],
      heightAt: (x: number, z: number) => number,
    ): Mesh[] => {
      const cols = Math.round((x1 - x0) / step);
      const rows = Math.round((z0 - z1) / step);
      const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
      const colors = new Float32Array((cols + 1) * (rows + 1) * 3);
      for (let r = 0; r <= rows; r++) {
        const z = z0 - r * step;
        for (let c = 0; c <= cols; c++) {
          const x = x0 + c * step;
          const i = (r * (cols + 1) + c) * 3;
          positions.set([x, heightAt(x, z), z], i);
          this.groundColor(x, z, noise, color);
          colors.set([color.r, color.g, color.b], i);
        }
      }
      const index: number[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c;
          const b = a + 1;
          const d = a + cols + 1;
          const e = d + 1;
          index.push(a, b, d, b, e, d); // counter-clockwise seen from above -> normals point up
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      geometry.setIndex(index);
      // Normals on the full grid (the shadow normal bias uses them), then cut
      // into tiles so the parts outside the view are culled.
      geometry.computeVertexNormals();
      const tiles = tileGrid(geometry, cols, ...tile);
      geometry.dispose();
      return tiles.map((part) => {
        this.owned.push(part);
        const mesh = new Mesh(part, material);
        mesh.receiveShadow = true;
        mesh.layers.enable(HIT_LAYER);
        mesh.name = "ground";
        return mesh;
      });
    };

    const coarse = 5;
    const seamHeight = (x: number) => {
      const xa = Math.floor(x / coarse) * coarse;
      const t = (x - xa) / coarse;
      return this.height(xa, seamZ) * (1 - t) + this.height(xa + coarse, seamZ) * t;
    };
    // (z0 - seamZ) must be a multiple of the cell size so the last row lands on the seam.
    // Tiles: 60 × 34 m near (4 × 2), 260 × 210 m far (4 × 2), about 10 of 16 in view.
    const near = build(-110, 110, 5.5, seamZ, 1.25, [48, 27], (x, z) => (z <= seamZ + 1e-6 ? seamHeight(x) : this.height(x, z)));
    const far = build(-520, 520, seamZ, -482, coarse, [52, 42], this.height);
    return [...near, ...far];
  }

  update(dt: number, cameraX: number): void {
    this.sky.position.set(cameraX, 0, 0);
    this.sun.target.position.set(cameraX, 0, -24);
    this.sun.position.set(cameraX - 30, 48, 22);
    for (const target of this.bonuses) target.update(dt);
    for (const cloud of this.clouds) {
      const p = cloud.object.position;
      p.x += cloud.speed * dt;
      if (p.x > 420) p.x -= 840;
    }
  }

  resetTargets(): void {
    for (const target of this.bonuses) target.reset();
  }

  dispose(): void {
    this.scene.remove(this.sky);
    this.root.removeFromParent();
    this.sun.dispose();
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
  }
}

const heights = new WeakMap<Object3D, number>();

/** Height of a model in its own units (cached per source scene). */
function modelHeight(scene: Object3D): number {
  let h = heights.get(scene);
  if (h === undefined) {
    let max = 0;
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      max = Math.max(max, box.max.y);
    });
    h = Math.max(max, 0.01);
    heights.set(scene, h);
  }
  return h;
}

