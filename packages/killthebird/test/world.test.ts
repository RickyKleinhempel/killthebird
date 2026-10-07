import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { generateLevel } from "../src/engine/level";
import { mergeStatic } from "../src/engine/merge";
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
