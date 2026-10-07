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

/**
 * Bakes many static objects into one mesh per material to keep draw calls
 * low. With vertex-coloured models that is a single mesh per depth layer.
 * Multi-material meshes are kept as they are.
 */
export function mergeStatic(sources: MergeSource[]): { meshes: Mesh[]; leftovers: Object3D[] } {
  const groups = new Map<Material, BufferGeometry[]>();
  const leftovers: Object3D[] = [];
  for (const source of sources) {
    source.object.updateMatrixWorld(true);
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
      let list = groups.get(material);
      if (!list) groups.set(material, (list = []));
      list.push(toWorldGeometry(mesh, source, (material as Material & { vertexColors?: boolean }).vertexColors === true));
    });
  }
  const meshes: Mesh[] = [];
  for (const [material, geometries] of groups) {
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new Mesh(merged, material);
    mesh.name = `merged:${material.name}`;
    meshes.push(mesh);
  }
  return { meshes, leftovers };
}
