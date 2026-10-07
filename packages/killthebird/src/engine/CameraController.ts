import { PerspectiveCamera } from "three";
import { CAMERA } from "./config";
import { edgeScrollFactor, fovForAspect, stepScroll, type ScrollState } from "./scroll";

const DEG = Math.PI / 180;

/**
 * Side-scrolling camera. It translates (never rotates) along x, so the depth
 * layers move at different speeds on screen and produce real parallax.
 */
export class CameraController {
  readonly camera: PerspectiveCamera;
  private scroll: ScrollState = { x: 0, velocity: 0 };
  private shake = 0;
  private lookU = 0.5;
  private lookV = 0.5;

  constructor() {
    this.camera = new PerspectiveCamera(CAMERA.fov, 16 / 9, 0.1, 1600);
    this.camera.rotation.order = "YXZ";
    this.apply();
  }

  get x(): number {
    return this.scroll.x;
  }

  get fov(): number {
    return this.camera.fov;
  }

  get aspect(): number {
    return this.camera.aspect;
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    this.camera.fov = fovForAspect(CAMERA.fov, aspect);
    this.camera.updateProjectionMatrix();
  }

  kick(strength = 1): void {
    this.shake = Math.max(this.shake, 0.12 * strength);
  }

  update(
    dt: number,
    pointer: { u: number; v: number; inside: boolean; keyDirection: number },
    scrollEnabled: boolean,
  ): void {
    let target = 0;
    if (scrollEnabled) {
      const edge = pointer.inside ? edgeScrollFactor(pointer.u, CAMERA.edge) : 0;
      target = (pointer.keyDirection !== 0 ? pointer.keyDirection : edge) * CAMERA.maxSpeed;
    }
    this.scroll = stepScroll(this.scroll, target, dt, CAMERA.range);

    const follow = 1 - Math.exp(-4 * dt);
    const u = pointer.inside ? pointer.u : 0.5;
    const v = pointer.inside ? pointer.v : 0.5;
    this.lookU += (u - this.lookU) * follow;
    this.lookV += (v - this.lookV) * follow;
    this.shake = Math.max(0, this.shake - dt);
    this.apply();
  }

  reset(): void {
    this.scroll = { x: 0, velocity: 0 };
    this.apply();
  }

  private apply(): void {
    const s = this.shake;
    const jitter = s > 0 ? s * s * 6 : 0;
    this.camera.position.set(
      this.scroll.x + (Math.random() - 0.5) * jitter,
      CAMERA.height + (Math.random() - 0.5) * jitter,
      0,
    );
    this.camera.rotation.set(
      (CAMERA.pitch + (0.5 - this.lookV) * 2 * CAMERA.lookPitch + s * 6) * DEG,
      -(this.lookU - 0.5) * 2 * CAMERA.lookYaw * DEG,
      0,
    );
  }
}
