import {
  Box3,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Sphere,
  Uint16BufferAttribute,
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
  /** Width (x) of one culling tile in metres. */
  tileWidth?: number;
}

/** Tip lean per metre of blade height: wind (times sway <= uWindStrength) and the natural lean. */
export const WIND_LEAN = 0.55;
export const NATURAL_LEAN = 0.22;
/** Strongest uWindStrength the tile bounds allow for before blades could lean out of them. */
export const MAX_WIND_STRENGTH = 1.5;
const MAX_LEAN = WIND_LEAN * MAX_WIND_STRENGTH + NATURAL_LEAN;
/** Half the widest blade (0.085) plus slack for float rounding. */
const BLADE_PAD = 0.05;

export type GrassTile = Mesh<InstancedBufferGeometry, ShaderMaterial>;

/** Grass split into x tiles per band, so off-screen blades are frustum culled. */
export class GrassField extends Group {
  constructor(readonly material: ShaderMaterial) {
    super();
    this.name = "grass-field";
  }

  get tiles(): readonly GrassTile[] {
    return this.children as GrassTile[];
  }

  dispose(): void {
    for (const tile of this.tiles) tile.geometry.dispose();
    this.material.dispose();
  }
}

/** Blades of one tile, in generation order, with their swept bounds. */
interface Bucket {
  offsets: number[];
  params: number[];
  rands: number[];
  box: Box3;
}

/** One tapered blade: 7 vertices, 5 triangles, x in [-0.5, 0.5], y in [0, 1]. */
function bladeAttributes(): { position: BufferAttribute; index: BufferAttribute } {
  const levels = [
    [0, 1],
    [0.38, 0.78],
    [0.72, 0.45],
  ] as const;
  const pos: number[] = [];
  for (const [t, w] of levels) pos.push(-0.5 * w, t, 0, 0.5 * w, t, 0);
  pos.push(0, 1, 0);
  return {
    position: new BufferAttribute(new Float32Array(pos), 3),
    index: new Uint16BufferAttribute([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6], 1),
  };
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
    vec2 natural = vec2(cos(aParams.z * 2.7), sin(aParams.z * 2.7)) * ${NATURAL_LEAN};
    vec2 lean = uWindDir * sway * ${WIND_LEAN} + natural;
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

/** Thousands of wind-blown grass blades, one instanced draw call per visible tile. */
export function createGrassField(options: GrassFieldOptions): GrassField {
  const { rng } = options;
  const tileWidth = options.tileWidth ?? 10;
  if (!(tileWidth > 0)) throw new RangeError(`grass tileWidth must be positive, got ${tileWidth}`);
  // Tiles keyed by band and x column; blades keep their generation order.
  const buckets = new Map<string, Bucket>();
  const corner = new Vector3();

  for (const [b, band] of options.bands.entries()) {
    const zMid = (band.zNear + band.zFar) / 2;
    const half = options.halfWidth(zMid);
    const area = 2 * half * Math.abs(band.zFar - band.zNear);
    const candidates = Math.round(area * band.density);
    for (let i = 0; i < candidates; i++) {
      const x = range(rng, -half, half);
      const z = range(rng, band.zNear, band.zFar);
      const keep = 0.25 + 0.75 * Math.max(0, options.clump(x, z) * 0.5 + 0.5);
      if (rng() > keep || options.blocked(x, z)) continue;
      const key = `${b}:${Math.floor(x / tileWidth)}`;
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = { offsets: [], params: [], rands: [], box: new Box3() }));
      const y = options.height(x, z) - 0.03;
      bucket.offsets.push(x, y, z);
      const dry = rng() < 0.18 ? range(rng, 0.6, 1) : 0;
      const h = range(rng, band.minHeight, band.maxHeight) * (0.75 + keep * 0.35);
      bucket.params.push(h, range(rng, 0.045, 0.085), range(rng, 0, Math.PI * 2), dry);
      bucket.rands.push(rng());
      // Swept blade: roots at y, tip at most h above, leaning up to h * MAX_LEAN.
      const r = h * MAX_LEAN + BLADE_PAD;
      bucket.box.expandByPoint(corner.set(x - r, y - BLADE_PAD, z - r));
      bucket.box.expandByPoint(corner.set(x + r, y + h + BLADE_PAD, z + r));
    }
  }

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

  const field = new GrassField(material);
  const { position, index } = bladeAttributes();
  for (const bucket of buckets.values()) {
    // Tiles share the blade's base vertices and index.
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute("position", position);
    geometry.setIndex(index);
    geometry.setAttribute("aOffset", new InstancedBufferAttribute(new Float32Array(bucket.offsets), 3));
    geometry.setAttribute("aParams", new InstancedBufferAttribute(new Float32Array(bucket.params), 4));
    geometry.setAttribute("aRand", new InstancedBufferAttribute(new Float32Array(bucket.rands), 1));
    geometry.instanceCount = bucket.rands.length;
    geometry.boundingBox = bucket.box;
    geometry.boundingSphere = bucket.box.getBoundingSphere(new Sphere());

    const tile: GrassTile = new Mesh(geometry, material);
    tile.name = "grass-tile";
    field.add(tile);
  }
  return field;
}
