import { describe, expect, it } from "vitest";
import { Session } from "../src/engine/Session";

const make = () => new Session({ duration: 10, shells: 2, reloadTime: 0.5 });

describe("Session", () => {
  it("walks through loading -> ready -> playing -> ended", () => {
    const s = make();
    expect(s.start()).toBe(false);
    s.setReady();
    expect(s.state).toBe("ready");
    expect(s.start()).toBe(true);
    expect(s.update(4).ended).toBe(false);
    expect(s.timeLeft).toBeCloseTo(6);
    expect(s.update(7).ended).toBe(true);
    expect(s.state).toBe("ended");
  });

  it("ignores shots outside of a round", () => {
    const s = make();
    s.setReady();
    expect(s.fire()).toBe("inactive");
    expect(s.shots).toBe(0);
  });

  it("counts shots, hits, score and accuracy", () => {
    const s = make();
    s.setReady();
    s.start();
    s.fire();
    s.registerHit(25, "far");
    s.update(1);
    s.fire();
    s.update(10);
    const r = s.result();
    expect(r).toMatchObject({ score: 25, hits: 1, shots: 2, accuracy: 0.5 });
    expect(r.hitsByLayer.far).toBe(1);
    expect(r.durationMs).toBe(10000);
  });

  it("does not run the timer while paused", () => {
    const s = make();
    s.setReady();
    s.start();
    s.pause();
    s.update(5);
    expect(s.timeLeft).toBe(10);
    s.resume();
    s.update(5);
    expect(s.timeLeft).toBe(5);
  });

  it("restarts cleanly after a round", () => {
    const s = make();
    s.setReady();
    s.start();
    s.fire();
    s.registerHit(10, "mid");
    s.update(11);
    expect(s.start()).toBe(true);
    expect(s.score).toBe(0);
    expect(s.weapon.shells).toBe(2);
    expect(s.timeLeft).toBe(10);
  });
});
