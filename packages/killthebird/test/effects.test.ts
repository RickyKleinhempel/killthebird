import { Color, Matrix4, Scene, Vector3 } from "three";
import { afterEach, describe, expect, it } from "vitest";
import { BURSTS, Effects } from "../src/engine/Effects";
import { globalUniforms } from "../src/engine/shaders/common";
import { Impacts } from "../src/engine/shaders/impacts";

const step = (effects: Effects, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) effects.update(1 / 60);
};

describe("Effects", () => {
  it("is hidden while idle and draws only up to the highest live particle", () => {
    const effects = new Effects(new Scene());
    expect(effects.mesh.visible).toBe(false);
    expect(effects.mesh.count).toBe(0);

    effects.burst(new Vector3(), BURSTS.dust);
    expect(effects.mesh.visible).toBe(true);
    expect(effects.mesh.count).toBe(BURSTS.dust.count);

    effects.update(1 / 60);
    expect(effects.mesh.visible).toBe(true);
    // Live particles got a real transform, the slot above them is still empty
    const m = new Matrix4();
    effects.mesh.getMatrixAt(0, m);
    expect(m.determinant()).not.toBe(0);
    effects.mesh.getMatrixAt(BURSTS.dust.count, m);
    expect(m.determinant()).toBe(0);

    step(effects, BURSTS.dust.life * 1.3 + 0.1);
    expect(effects.mesh.visible).toBe(false);
    expect(effects.mesh.count).toBe(0);
    // Dead particles are collapsed again
    effects.mesh.getMatrixAt(0, m);
    expect(m.determinant()).toBe(0);
  });

  it("shrinks the drawn range as older bursts die", () => {
    const effects = new Effects(new Scene());
    effects.burst(new Vector3(), BURSTS.dust); // short-lived, slots 0..9
    effects.burst(new Vector3(), BURSTS.feathers); // long-lived, slots 10..31
    expect(effects.mesh.count).toBe(BURSTS.dust.count + BURSTS.feathers.count);
    step(effects, BURSTS.dust.life * 1.3 + 0.1);
    expect(effects.mesh.visible).toBe(true);
    expect(effects.mesh.count).toBe(BURSTS.dust.count + BURSTS.feathers.count);

    // The next burst lands above the feathers; once those die only the new one is scanned
    effects.burst(new Vector3(), BURSTS.wood);
    step(effects, BURSTS.feathers.life * 1.3 + 0.1);
    expect(effects.mesh.visible).toBe(false);
    effects.burst(new Vector3(), BURSTS.dust);
    expect(effects.mesh.count).toBe(BURSTS.dust.count * 2 + BURSTS.feathers.count + BURSTS.wood.count);
    effects.update(1 / 60);
    const ranges = effects.mesh.instanceMatrix.updateRanges;
    const last = ranges[ranges.length - 1]!;
    expect(last.start).toBe((BURSTS.dust.count + BURSTS.feathers.count + BURSTS.wood.count) * 16);
    expect(last.count).toBe(BURSTS.dust.count * 16);
  });

  it("draws the whole pool when the ring buffer wraps", () => {
    const effects = new Effects(new Scene());
    for (let i = 0; i < 20; i++) effects.burst(new Vector3(), BURSTS.pumpkin); // 520 > 480 slots
    expect(effects.mesh.count).toBe(480);
    effects.update(1 / 60);
    expect(effects.mesh.count).toBe(480);
    step(effects, BURSTS.pumpkin.life * 1.3 + 0.1);
    expect(effects.mesh.visible).toBe(false);
  });
});

describe("Impacts", () => {
  afterEach(() => {
    globalUniforms.uTime.value = 0;
  });

  it("draws a flash only while it plays", () => {
    const impacts = new Impacts();
    const meshes = impacts.group.children;
    globalUniforms.uTime.value = 10;
    impacts.update();
    expect(meshes.every((m) => !m.visible)).toBe(true);

    impacts.spawn(new Vector3(), new Color(1, 1, 1), 2, 0.3);
    expect(meshes.filter((m) => m.visible)).toHaveLength(1);

    globalUniforms.uTime.value = 10.2;
    impacts.update();
    expect(meshes.filter((m) => m.visible)).toHaveLength(1);

    globalUniforms.uTime.value = 10.35;
    impacts.update();
    expect(meshes.every((m) => !m.visible)).toBe(true);
    impacts.dispose();
  });
});
