import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Sphere,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { range, type Rng } from "../rng";
import { ATMOSPHERE_GLSL, globalUniforms } from "./common";

export interface GrassBand {
  zNear: number;
  zFar: number;
  /** Blades per square metre before clumping. */
  density: number;
  minHeight: number;
  maxHeight: number;
}

export interface GrassFieldOptions {
  rng: Rng;
  height(x: number, z: number): number;
  /** Clumping noise in roughly [-1, 1]. */
  clump(x: number, z: number): number;
  halfWidth(z: number): number;
  blocked(x: number, z: number): boolean;
  bands: GrassBand[];
}

/** One tapered blade: 7 vertices, 5 triangles, x in [-0.5, 0.5], y in [0, 1]. */
function bladeGeometry(): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  const levels = [
    [0, 1],
    [0.38, 0.78],
    [0.72, 0.45],
  ] as const;
  const pos: number[] = [];
  for (const [t, w] of levels) pos.push(-0.5 * w, t, 0, 0.5 * w, t, 0);
  pos.push(0, 1, 0);
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
  return g;
}

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec3 aOffset;
  attribute vec4 aParams; // height, width, angle, dryness
  attribute float aRand;
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindStrength;
  varying float vT;
  varying float vDry;
  varying float vRand;
  varying vec3 vWorld;

  void main() {
    float t = position.y;
    float h = aParams.x;
    vec3 p = vec3(position.x * aParams.y, t * h, 0.0);
    float c = cos(aParams.z);
    float s = sin(aParams.z);
    p = vec3(p.x * c, p.y, p.x * s);

    // Wind: travelling waves across the field plus slow gusts
    float ph = uTime * 2.1 - dot(aOffset.xz, uWindDir) * 0.35 + aRand * 1.5;
    float gust = 0.55 + 0.45 * sin(uTime * 0.43 - aOffset.x * 0.03);
    float sway = (0.3 + 0.7 * (sin(ph) * 0.5 + 0.5)) * gust * uWindStrength;
    float bend = t * t * h;
    vec2 natural = vec2(cos(aParams.z * 2.7), sin(aParams.z * 2.7)) * 0.22;
    vec2 lean = uWindDir * sway * 0.55 + natural;
    p.xz += lean * bend;
    p.y -= dot(lean, lean) * bend * 0.35;

    vec3 world = aOffset + p;
    vWorld = world;
    vT = t;
    vDry = aParams.w;
    vRand = aRand;
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uSunDir;
  ${ATMOSPHERE_GLSL}
  uniform vec3 uRoot;
  uniform vec3 uTip;
  uniform vec3 uDry;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  varying float vT;
  varying float vDry;
  varying float vRand;
  varying vec3 vWorld;

  void main() {
    vec3 base = mix(uRoot, uTip, smoothstep(0.0, 1.0, vT));
    base = mix(base, uDry * (0.75 + 0.45 * vT), vDry);
    base *= 0.82 + 0.36 * vRand;
    float ao = mix(0.38, 1.0, smoothstep(0.0, 0.65, vT));
    vec3 view = normalize(vWorld - cameraPosition);
    float backlight = pow(max(dot(view, uSunDir), 0.0), 3.0) * vT;
    vec3 color = base * (uAmbient + uSunColor) * ao + uSunColor * base * backlight * 0.9;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #ifdef USE_FOG
      gl_FragColor.rgb = ktbAtmosphere(gl_FragColor.rgb, vWorld, vFogDepth);
    #endif
  }`;

/** Thousands of wind-blown grass blades in a single instanced draw call. */
export function createGrassField(options: GrassFieldOptions): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const { rng } = options;
  const offsets: number[] = [];
  const params: number[] = [];
  const rands: number[] = [];

  for (const band of options.bands) {
    const zMid = (band.zNear + band.zFar) / 2;
    const half = options.halfWidth(zMid);
    const area = 2 * half * Math.abs(band.zFar - band.zNear);
    const candidates = Math.round(area * band.density);
    for (let i = 0; i < candidates; i++) {
      const x = range(rng, -half, half);
      const z = range(rng, band.zNear, band.zFar);
      const keep = 0.25 + 0.75 * Math.max(0, options.clump(x, z) * 0.5 + 0.5);
      if (rng() > keep || options.blocked(x, z)) continue;
      offsets.push(x, options.height(x, z) - 0.03, z);
      const dry = rng() < 0.18 ? range(rng, 0.6, 1) : 0;
      params.push(range(rng, band.minHeight, band.maxHeight) * (0.75 + keep * 0.35), range(rng, 0.045, 0.085), range(rng, 0, Math.PI * 2), dry);
      rands.push(rng());
    }
  }

  const geometry = bladeGeometry();
  geometry.setAttribute("aOffset", new InstancedBufferAttribute(new Float32Array(offsets), 3));
  geometry.setAttribute("aParams", new InstancedBufferAttribute(new Float32Array(params), 4));
  geometry.setAttribute("aRand", new InstancedBufferAttribute(new Float32Array(rands), 1));
  geometry.instanceCount = rands.length;
  geometry.boundingSphere = new Sphere(new Vector3(0, 0, -20), 140);

  const material = new ShaderMaterial({
    name: "ktb-grass",
    side: DoubleSide,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uRoot: { value: new Color(0x3d5222) },
        uTip: { value: new Color(0x9aa448) },
        uDry: { value: new Color(0xb8a25c) },
        uSunColor: { value: new Color(0xfff0d6).multiplyScalar(0.62) },
        uAmbient: { value: new Color(0xb9cce0).multiplyScalar(0.42) },
      },
    ]),
    vertexShader,
    fragmentShader,
  });
  // Shared (not cloned) so the global clock and wind drive this material too.
  material.uniforms.uTime = globalUniforms.uTime;
  material.uniforms.uWindDir = globalUniforms.uWindDir;
  material.uniforms.uWindStrength = globalUniforms.uWindStrength;
  material.uniforms.uSunDir = globalUniforms.uSunDir;

  const mesh = new Mesh(geometry, material);
  mesh.name = "grass-field";
  mesh.frustumCulled = false;
  return mesh;
}
