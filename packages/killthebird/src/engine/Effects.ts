import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Euler,
  Vector3,
  type Scene,
} from "three";

export interface BurstPreset {
  colors: number[];
  count: number;
  /** Particle edge length in world units at scale 1. */
  size: number;
  /** Initial speed in world units per second at scale 1. */
  speed: number;
  gravity: number;
  drag: number;
  life: number;
  /** Side-to-side swaying, gives feathers their float. */
  flutter: number;
  /** Width/height ratio of the particle quad. */
  aspect: number;
}

export const BURSTS = {
  feathers: { colors: [0x7b4a2b, 0x5e3720, 0xc08a50, 0xf1ece2], count: 22, size: 0.16, speed: 3.2, gravity: 1.6, drag: 2.6, life: 1.8, flutter: 2.4, aspect: 0.35 },
  dust: { colors: [0x8f7a55, 0x6f5f45, 0xa59a7a], count: 10, size: 0.12, speed: 2.2, gravity: 6, drag: 3, life: 0.7, flutter: 0, aspect: 1 },
  wood: { colors: [0x8f6a43, 0x5e4630], count: 12, size: 0.14, speed: 3, gravity: 9, drag: 1.5, life: 0.9, flutter: 0, aspect: 0.45 },
  pumpkin: { colors: [0xe0761f, 0xf09a3a, 0x4e6b2a], count: 26, size: 0.18, speed: 4.5, gravity: 11, drag: 1.2, life: 1.1, flutter: 0, aspect: 1 },
  straw: { colors: [0xd8b860, 0xc9a640], count: 16, size: 0.16, speed: 2.6, gravity: 3, drag: 2.2, life: 1.3, flutter: 1.6, aspect: 0.2 },
  splash: { colors: [0xe8f2f4, 0xbcd6dc, 0x9fc0c8], count: 24, size: 0.11, speed: 4.2, gravity: 12, drag: 1.2, life: 0.8, flutter: 0, aspect: 0.7 },
} satisfies Record<string, BurstPreset>;

const MAX_PARTICLES = 480;

/** Pooled particle bursts rendered with a single InstancedMesh. */
export class Effects {
  readonly mesh: InstancedMesh;
  private readonly pos = new Float32Array(MAX_PARTICLES * 3);
  private readonly vel = new Float32Array(MAX_PARTICLES * 3);
  private readonly rot = new Float32Array(MAX_PARTICLES * 3);
  private readonly spin = new Float32Array(MAX_PARTICLES * 3);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  private readonly size = new Float32Array(MAX_PARTICLES * 2);
  private readonly params = new Float32Array(MAX_PARTICLES * 3); // gravity, drag, flutter
  private cursor = 0;
  private alive = 0;
  private time = 0;

  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly e = new Euler();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly c = new Color();

  constructor(scene: Scene) {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshLambertMaterial({ side: DoubleSide });
    this.mesh = new InstancedMesh(geometry, material, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = "effects";
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.set(0xffffff));
    }
    scene.add(this.mesh);
  }

  burst(at: Vector3, preset: BurstPreset, scale = 1): void {
    for (let n = 0; n < preset.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = preset.speed * scale * (0.4 + Math.random() * 0.8);
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set(
        [
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.abs(Math.cos(phi)) * speed * 0.9 + speed * 0.3,
          Math.sin(phi) * Math.sin(theta) * speed,
        ],
        i * 3,
      );
      this.rot.set([Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3], i * 3);
      this.spin.set([(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10], i * 3);
      const life = preset.life * (0.7 + Math.random() * 0.6);
      if (this.life[i]! <= 0) this.alive++;
      this.life[i] = life;
      this.maxLife[i] = life;
      const size = preset.size * scale * (0.7 + Math.random() * 0.6);
      this.size[i * 2] = size * preset.aspect;
      this.size[i * 2 + 1] = size;
      this.params.set([preset.gravity * scale, preset.drag, preset.flutter * scale], i * 3);
      const color = preset.colors[Math.floor(Math.random() * preset.colors.length)]!;
      this.mesh.setColorAt(i, this.c.set(color));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.alive === 0) return;
    let alive = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i]! <= 0) continue;
      const life = (this.life[i]! -= dt);
      const i3 = i * 3;
      if (life <= 0) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      alive++;
      const gravity = this.params[i3]!;
      const damping = Math.exp(-this.params[i3 + 1]! * dt);
      const flutter = this.params[i3 + 2]!;
      this.vel[i3]! *= damping;
      this.vel[i3 + 1] = this.vel[i3 + 1]! * damping - gravity * dt;
      this.vel[i3 + 2]! *= damping;
      const sway = flutter * Math.sin(this.time * 6 + i) * dt;
      this.pos[i3] = this.pos[i3]! + this.vel[i3]! * dt + sway;
      this.pos[i3 + 1] = this.pos[i3 + 1]! + this.vel[i3 + 1]! * dt;
      this.pos[i3 + 2] = this.pos[i3 + 2]! + this.vel[i3 + 2]! * dt;
      for (let k = 0; k < 3; k++) this.rot[i3 + k] = this.rot[i3 + k]! + this.spin[i3 + k]! * dt;
      const fade = Math.min(1, life / (this.maxLife[i]! * 0.3));
      this.p.set(this.pos[i3]!, this.pos[i3 + 1]!, this.pos[i3 + 2]!);
      this.q.setFromEuler(this.e.set(this.rot[i3]!, this.rot[i3 + 1]!, this.rot[i3 + 2]!));
      this.s.set(this.size[i * 2]! * fade, this.size[i * 2 + 1]! * fade, 1);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.alive = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshLambertMaterial).dispose();
    this.mesh.dispose();
  }
}
