import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/engine/config";
import { generateLevel, layerExtent } from "../src/engine/level";
import { MODEL_NAMES } from "../src/engine/models";
import { createTerrain } from "../src/engine/terrain";

describe("generateLevel", () => {
  const { height } = createTerrain(7);

  it("is deterministic for a seed", () => {
    expect(generateLevel(7, height)).toEqual(generateLevel(7, height));
    expect(generateLevel(8, height).props).not.toEqual(generateLevel(7, height).props);
  });

  it("places every bonus kind and only known models", () => {
    const level = generateLevel(7, height);
    expect(new Set(level.bonuses.map((b) => b.kind))).toEqual(
      new Set(["windmill", "scarecrow", "signpost", "pumpkin", "peekaboo"]),
    );
    for (const p of level.props) expect(MODEL_NAMES).toContain(p.model);
  });

  it("covers the panorama width on the near layers", () => {
    const level = generateLevel(7, height);
    const fg = level.props.filter((p) => p.layer === "foreground").map((p) => p.x);
    const ext = layerExtent(7);
    expect(Math.min(...fg)).toBeLessThan(-ext + 2);
    expect(Math.max(...fg)).toBeGreaterThan(ext - 2);
  });

  it("puts props on the terrain", () => {
    const level = generateLevel(7, height);
    for (const p of level.props.filter((p) => p.layer !== "sky")) expect(p.y).toBeCloseTo(height(p.x, p.z));
  });
});

describe("resolveOptions", () => {
  it("fills defaults, ignores undefined and normalises the base url", () => {
    const o = resolveOptions({ assetsBaseUrl: "https://cdn.example.com/kb", duration: undefined, shells: 6 });
    expect(o.assetsBaseUrl).toBe("https://cdn.example.com/kb/");
    expect(o.duration).toBe(90);
    expect(o.shells).toBe(6);
  });
});
