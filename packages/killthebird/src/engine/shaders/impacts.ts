import { AdditiveBlending, Color, Group, Mesh, PlaneGeometry, ShaderMaterial, type Vector3 } from "three";
import { globalUniforms } from "./common";

const POOL = 10;

const vertexShader = /* glsl */ `
  uniform float uScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Camera-facing billboard around the object's origin
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uScale;
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uStart;
  uniform float uLife;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float age = (uTime - uStart) / uLife;
    if (age < 0.0 || age > 1.0) discard;
    float d = length(vUv * 2.0 - 1.0);
    float radius = 0.15 + age * 0.8;
    float ring = smoothstep(radius - 0.14, radius, d) * (1.0 - smoothstep(radius, radius + 0.04, d));
    float flash = (1.0 - smoothstep(0.0, 0.45, d)) * (1.0 - smoothstep(0.0, 0.3, age));
    // four short sparks
    float a = atan(vUv.y - 0.5, vUv.x - 0.5);
    float sparks = pow(abs(cos(a * 2.0 + 0.6)), 24.0) * (1.0 - smoothstep(radius * 0.6, radius * 1.1, d)) * (1.0 - age);
    float alpha = (ring * 0.85 + flash * 1.2 + sparks * 0.7) * (1.0 - age * age);
    gl_FragColor = vec4(uColor * alpha, alpha);
  }`;

export const IMPACT_COLORS = {
  bird: new Color(1.0, 0.92, 0.7),
  bonus: new Color(0.5, 0.95, 1.0),
  ground: new Color(0.95, 0.85, 0.65),
  water: new Color(0.85, 0.95, 1.0),
} as const;

/** Pooled additive "hit" flashes rendered as camera-facing quads. */
export class Impacts {
  readonly group = new Group();
  private readonly meshes: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  private next = 0;
  private readonly geometry = new PlaneGeometry(1, 1);

  constructor() {
    this.group.name = "impacts";
    for (let i = 0; i < POOL; i++) {
      const material = new ShaderMaterial({
        name: "ktb-impact",
        uniforms: {
          uTime: globalUniforms.uTime,
          uStart: { value: -100 },
          uLife: { value: 0.45 },
          uScale: { value: 1 },
          uColor: { value: new Color() },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  /** `size` is the flash diameter in world units. */
  spawn(at: Vector3, color: Color, size: number, life = 0.45): void {
    const mesh = this.meshes[this.next]!;
    this.next = (this.next + 1) % POOL;
    mesh.position.copy(at);
    const u = mesh.material.uniforms;
    u.uStart!.value = globalUniforms.uTime.value;
    u.uLife!.value = life;
    u.uScale!.value = size;
    (u.uColor!.value as Color).copy(color);
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.meshes) m.material.dispose();
    this.group.removeFromParent();
  }
}
