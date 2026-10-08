import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
  type BufferAttribute,
} from "three";
import { describe, expect, it } from "vitest";
import { generateLevel } from "../src/engine/level";
import { WIND_REACH, mergeStatic, tileGrid } from "../src/engine/merge";
import { POND, createTerrain, pondDistance } from "../src/engine/terrain";

function prop(x: number, scale: number, material: MeshStandardMaterial) {
  const root = new Group();
  const box = new Mesh(new BoxGeometry(1, 2, 1).translate(0, 1, 0), material);
  root.add(box);
  root.position.set(x, 0, -10);
  root.scale.setScalar(scale);
  return root;
}

describe("mergeStatic", () => {
  it("merges props sharing a material into one mesh with a baked wind weight", () => {
    const material = new MeshStandardMaterial({ vertexColors: true });
    const { meshes, leftovers } = mergeStatic([
      { object: prop(0, 1, material), wind: 0.2, height: 2 },
      { object: prop(5, 2, material), wind: 0, height: 2 },
    ]);
    expect(leftovers).toHaveLength(0);
    expect(meshes).toHaveLength(1);
    const geo = meshes[0]!.geometry;
    expect(geo.getAttribute("color")).toBeDefined();
    const pos = geo.getAttribute("position");
    const wind = geo.getAttribute("aWind");
    let topSway = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const w = wind.getX(i);
      if (x > 3) expect(w).toBe(0); // rigid prop
      else if (y < 0.01) expect(w).toBeCloseTo(0); // base stays put
      else topSway = Math.max(topSway, w);
    }
    expect(topSway).toBeCloseTo(0.2); // full amplitude at the top
  });

  it("splits into x-tiles without changing a single vertex", () => {
    const material = new MeshStandardMaterial({ vertexColors: true });
    const sources = () =>
      Array.from({ length: 12 }, (_, i) => ({ object: prop(-30 + i * 5.5, 1 + (i % 3) * 0.2, material), wind: i % 2 ? 0.15 : 0, height: 2 }));
    const whole = mergeStatic(sources()).meshes;
    const tiled = mergeStatic(sources(), { tileWidth: 16 }).meshes;
    expect(whole).toHaveLength(1);
    expect(tiled).toHaveLength(4); // origins -30 .. 30.5 fall into tiles -2 .. 1
    const vertices = (meshes: Mesh[]) =>
      meshes
        .flatMap((m) => {
          const pos = m.geometry.getAttribute("position");
          const wind = m.geometry.getAttribute("aWind");
          return Array.from({ length: pos.count }, (_, i) => `${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)},${wind.getX(i)}`);
        })
        .sort();
    expect(vertices(tiled)).toEqual(vertices(whole));

    for (const mesh of tiled) {
      const geo = mesh.geometry;
      const pos = geo.getAttribute("position");
      const wind = geo.getAttribute("aWind");
      const box = geo.boundingBox!;
      const sphere = geo.boundingSphere!;
      let maxWind = 0;
      for (let i = 0; i < pos.count; i++) {
        const v = new Vector3().fromBufferAttribute(pos, i);
        maxWind = Math.max(maxWind, wind.getX(i));
        expect(box.containsPoint(v)).toBe(true);
        expect(sphere.containsPoint(v)).toBe(true);
      }
      // Bounds leave room for the wind sway, so swaying tips never get culled.
      const tight = new Box3().setFromBufferAttribute(pos as BufferAttribute);
      expect(box.max.x - tight.max.x).toBeCloseTo(maxWind * WIND_REACH);
      expect(mesh.name).toBe("merged:");
    }

    // Shots still hit the tiled props.
    for (const x of [-30, 3, 30.5]) {
      const ray = new Raycaster(new Vector3(x, 10, -10), new Vector3(0, -1, 0));
      expect(ray.intersectObjects(tiled)[0]?.distance).toBeCloseTo(10 - 2 * (1 + (Math.round((x + 30) / 5.5) % 3) * 0.2));
    }
  });
});

describe("tileGrid", () => {
  // A small terrain grid built like World.createGround.
  const cols = 10;
  const rows = 7;
  const positions: number[] = [];
  const colors: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      positions.push(c, Math.sin(c * 1.3) * Math.cos(r * 0.7), -r);
      colors.push(c / cols, r / rows, 0.5);
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      index.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
    }
  }
  const grid = new BufferGeometry();
  grid.setAttribute("position", new Float32BufferAttribute(positions, 3));
  grid.setAttribute("color", new Float32BufferAttribute(colors, 3));
  grid.setIndex(index);
  grid.computeVertexNormals();

  const attrs = (geo: BufferGeometry, i: number) =>
    ["position", "normal", "color"].map((n) => {
      const a = geo.getAttribute(n);
      return `${a.getX(i)},${a.getY(i)},${a.getZ(i)}`;
    });
  const triangles = (geo: BufferGeometry) => {
    const idx = geo.getIndex()!;
    return Array.from({ length: idx.count / 3 }, (_, t) => [0, 1, 2].map((k) => attrs(geo, idx.getX(t * 3 + k)).join("|")).join(" / "));
  };

  it("keeps every triangle with identical vertices, normals and colours", () => {
    const tiles = tileGrid(grid, cols, 4, 3);
    expect(tiles).toHaveLength(3 * 3);
    expect(tiles.flatMap(triangles).sort()).toEqual(triangles(grid).sort());
  });

  it("shares identical boundary vertices between neighbouring tiles", () => {
    const tiles = tileGrid(grid, cols, 4, 3);
    const byPosition = new Map<string, string>();
    for (let i = 0; i < grid.getAttribute("position").count; i++) {
      const [p, ...rest] = attrs(grid, i);
      byPosition.set(p!, rest.join("|"));
    }
    const seen = new Map<string, number>();
    for (const tile of tiles) {
      const pos = tile.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const [p, ...rest] = attrs(tile, i);
        expect(rest.join("|")).toBe(byPosition.get(p!)); // normals from the full grid, not per tile
        seen.set(p!, (seen.get(p!) ?? 0) + 1);
        expect(tile.boundingBox!.containsPoint(new Vector3().fromBufferAttribute(pos, i))).toBe(true);
      }
    }
    // Inner tile corners are in four tiles, other boundary vertices in two.
    expect(seen.get(`4,${Math.fround(Math.sin(4 * 1.3) * Math.cos(3 * 0.7))},-3`)).toBe(4);
    expect(seen.get(`8,${Math.fround(Math.sin(8 * 1.3) * Math.cos(0))},0`)).toBe(2);
    expect(seen.get(`1,${Math.fround(Math.sin(1.3) * Math.cos(0.7))},-1`)).toBe(1);
  });

  it("cuts only in x without a row size", () => {
    const tiles = tileGrid(grid, cols, 4);
    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.getIndex()!.count / 6)).toEqual([4 * rows, 4 * rows, 2 * rows]);
  });
});

describe("terrain pond", () => {
  const { height } = createTerrain(7);
  it("is below the water level in the middle and above it outside the rim", () => {
    expect(height(POND.x, POND.z)).toBeLessThan(POND.level - 0.3);
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const x = POND.x + Math.cos(a) * POND.rx * 1.4;
      const z = POND.z + Math.sin(a) * POND.rz * 1.4;
      expect(height(x, z)).toBeGreaterThan(POND.level);
    }
  });

  it("keeps the pond free of props except reeds on its rim", () => {
    const level = generateLevel(7, height);
    for (const p of level.props) {
      if (p.model === "reeds") expect(pondDistance(p.x, p.z)).toBeGreaterThan(0.9);
      else if (p.layer !== "sky" && p.layer !== "far") expect(pondDistance(p.x, p.z)).toBeGreaterThan(1.0);
    }
    for (const b of level.bonuses) expect(pondDistance(b.x, b.z)).toBeGreaterThan(1.1);
  });
});
