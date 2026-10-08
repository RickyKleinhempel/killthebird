import { BufferAttribute, BufferGeometry, Mesh, Vector3, type Material, type Object3D } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface MergeSource {
  object: Object3D;
  /** Sway amplitude in metres at the top of the model (0 = rigid). */
  wind: number;
  /** Model height in its own units (before the object's scale). */
  height: number;
}

const tmp = new Vector3();

/**
 * Converts any geometry (indexed, quantised, interleaved) into a plain
 * non-indexed Float32 geometry in world space with position, normal, color
 * (white if missing) and `aWind`. This makes geometries from different GLBs
 * mergeable.
 */
function toWorldGeometry(mesh: Mesh, source: MergeSource, withColor: boolean): BufferGeometry {
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  if (!pos) return new BufferGeometry();
  let nrm = geo.getAttribute("normal");
  if (!nrm) {
    const t = geo.clone();
    t.computeVertexNormals();
    nrm = t.getAttribute("normal");
  }
  const col = geo.getAttribute("color");
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = withColor ? new Float32Array(count * 3) : null;
  for (let i = 0; i < count; i++) {
    const v = index ? index.getX(i) : i;
    positions.set([pos.getX(v), pos.getY(v), pos.getZ(v)], i * 3);
    normals.set([nrm.getX(v), nrm.getY(v), nrm.getZ(v)], i * 3);
    if (colors) colors.set(col ? [col.getX(v), col.getY(v), col.getZ(v)] : [1, 1, 1], i * 3);
  }
  const out = new BufferGeometry();
  out.setAttribute("position", new BufferAttribute(positions, 3));
  out.setAttribute("normal", new BufferAttribute(normals, 3));
  if (colors) out.setAttribute("color", new BufferAttribute(colors, 3));
  out.applyMatrix4(mesh.matrixWorld);

  // Wind weight from the height above the object's base, relative to its size.
  const wind = new Float32Array(count);
  if (source.wind > 0) {
    const scale = source.object.scale.y;
    const baseY = source.object.getWorldPosition(tmp).y;
    const height = Math.max(source.height * scale, 0.01);
    for (let i = 0; i < count; i++) {
      const hn = Math.min(1, Math.max(0, (positions[i * 3 + 1]! - baseY) / height));
      wind[i] = source.wind * scale * Math.pow(hn, 1.6);
    }
  }
  out.setAttribute("aWind", new BufferAttribute(wind, 1));
  return out;
}

export interface MergeOptions {
  /**
   * Splits the result into x-tiles of this width (metres, by each object's
   * world x) so off-screen parts are frustum-culled in the main and shadow
   * passes. Omitted = one mesh per material spanning everything.
   */
  tileWidth?: number;
}

/**
 * Furthest a vertex moves per unit of `aWind` in the wind shader (patch.ts):
 * sway ≤ 1.35 · uWindStrength plus flutter ≤ 0.12·√2. Covers a wind strength
 * up to 1.5 (default 1). Tile bounds grow by this so swaying tips are never
 * culled.
 */
export const WIND_REACH = 2.2;

/**
 * Bakes many static objects into one mesh per material (and x-tile) to keep
 * draw calls low. With vertex-coloured models that is a single mesh per depth
 * layer and tile. Multi-material meshes are kept as they are.
 */
export function mergeStatic(sources: MergeSource[], options: MergeOptions = {}): { meshes: Mesh[]; leftovers: Object3D[] } {
  const groups = new Map<Material, Map<number, BufferGeometry[]>>();
  const leftovers: Object3D[] = [];
  const tileWidth = options.tileWidth ?? 0;
  for (const source of sources) {
    source.object.updateMatrixWorld(true);
    // A prop always stays whole; its origin decides the tile.
    const tile = tileWidth > 0 ? Math.floor(source.object.getWorldPosition(tmp).x / tileWidth) : 0;
    source.object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        const copy = mesh.clone();
        mesh.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
        leftovers.push(copy);
        return;
      }
      const material = mesh.material;
      let tiles = groups.get(material);
      if (!tiles) groups.set(material, (tiles = new Map()));
      let list = tiles.get(tile);
      if (!list) tiles.set(tile, (list = []));
      list.push(toWorldGeometry(mesh, source, (material as Material & { vertexColors?: boolean }).vertexColors === true));
    });
  }
  const meshes: Mesh[] = [];
  for (const [material, tiles] of groups) {
    for (const [, geometries] of [...tiles].sort(([a], [b]) => a - b)) {
      const merged = mergeGeometries(geometries, false);
      for (const g of geometries) g.dispose();
      if (!merged) continue;
      computeSwayBounds(merged);
      const mesh = new Mesh(merged, material);
      mesh.name = `merged:${material.name}`;
      meshes.push(mesh);
    }
  }
  return { meshes, leftovers };
}

/**
 * Cuts an indexed row-major grid of (cols + 1) vertices per row into tiles of
 * `tileCols` × `tileRows` cells. Each tile copies its vertices including the
 * boundary rows/columns, so neighbours share identical boundary vertices
 * (normals included, as computed on the full grid) and the seams are
 * crack-free. Triangles keep their order and winding.
 */
export function tileGrid(grid: BufferGeometry, cols: number, tileCols: number, tileRows = Infinity): BufferGeometry[] {
  const index = grid.getIndex();
  if (!index) throw new Error("tileGrid needs an indexed grid");
  const stride = cols + 1;
  const rows = grid.getAttribute("position").count / stride - 1;
  if (!Number.isInteger(rows) || rows < 1 || cols < 1 || tileCols < 1 || tileRows < 1) {
    throw new Error(`tileGrid: bad grid (${cols} cols, ${rows} rows) or tile size`);
  }
  const rowsPer = Math.min(rows, tileRows);
  const tx = Math.ceil(cols / tileCols);
  const ty = Math.ceil(rows / rowsPer);
  // First and last vertex column/row of tile x/y.
  const c0 = (x: number) => x * tileCols;
  const c1 = (x: number) => Math.min(cols, (x + 1) * tileCols);
  const r0 = (y: number) => y * rowsPer;
  const r1 = (y: number) => Math.min(rows, (y + 1) * rowsPer);

  const indices: number[][] = Array.from({ length: tx * ty }, () => []);
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    // The lowest column and row of a triangle are those of its cell.
    const x = Math.floor(Math.min(a % stride, b % stride, c % stride) / tileCols);
    const y = Math.floor(Math.floor(Math.min(a, b, c) / stride) / rowsPer);
    const w = c1(x) - c0(x) + 1;
    const list = indices[y * tx + x]!;
    list.push(
      (Math.floor(a / stride) - r0(y)) * w + (a % stride) - c0(x),
      (Math.floor(b / stride) - r0(y)) * w + (b % stride) - c0(x),
      (Math.floor(c / stride) - r0(y)) * w + (c % stride) - c0(x),
    );
  }

  const tiles: BufferGeometry[] = [];
  for (let y = 0; y < ty; y++) {
    for (let x = 0; x < tx; x++) {
      const w = c1(x) - c0(x) + 1;
      const tile = new BufferGeometry();
      for (const [name, attr] of Object.entries(grid.attributes)) {
        if (!(attr instanceof BufferAttribute)) throw new Error(`tileGrid: interleaved attribute ${name}`);
        const size = attr.itemSize;
        const src = attr.array;
        const dst = new (src.constructor as new (length: number) => typeof src)(w * (r1(y) - r0(y) + 1) * size);
        for (let r = r0(y); r <= r1(y); r++) {
          dst.set(src.subarray((r * stride + c0(x)) * size, (r * stride + c1(x) + 1) * size), (r - r0(y)) * w * size);
        }
        tile.setAttribute(name, new BufferAttribute(dst, size, attr.normalized));
      }
      tile.setIndex(indices[y * tx + x]!);
      tile.computeBoundingBox();
      tile.computeBoundingSphere();
      tiles.push(tile);
    }
  }
  return tiles;
}

/** Bounding box and sphere, grown by the largest wind sway in the geometry. */
function computeSwayBounds(geometry: BufferGeometry): void {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const wind = geometry.getAttribute("aWind");
  let max = 0;
  if (wind) for (let i = 0; i < wind.count; i++) max = Math.max(max, wind.getX(i));
  if (max <= 0) return;
  geometry.boundingBox!.expandByScalar(max * WIND_REACH);
  geometry.boundingSphere!.radius += max * WIND_REACH;
}
