import { CircleGeometry, Color, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector4 } from "three";
import { ATMOSPHERE_GLSL, NOISE_GLSL, globalUniforms } from "./common";

export interface PondShape {
  x: number;
  z: number;
  /** Radii of the bowl rim (ellipse) in world units. */
  rx: number;
  rz: number;
  level: number;
}

const MAX_RIPPLES = 4;

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying vec2 vLocal;
  void main() {
    vLocal = position.xz * 1.25; // 1.0 = bowl rim
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  varying vec3 vWorld;
  varying vec2 vLocal;
  ${NOISE_GLSL}
  ${ATMOSPHERE_GLSL}

  float waves(vec2 p) {
    return sin(p.x * 1.4 + uTime * 1.2) * 0.35
         + sin(p.y * 2.1 - uTime * 0.9 + p.x * 0.4) * 0.25
         + ktbNoise(p * 2.3 + vec2(uTime * 0.35, -uTime * 0.2)) * 0.6;
  }

  float ripples(vec2 p) {
    float sum = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (age < 0.0 || age > 2.4) continue;
      float d = length(p - r.xy);
      float front = age * 2.4;
      sum += sin((d - front) * 9.0) * exp(-abs(d - front) * 2.5) * (1.0 - age / 2.4) * r.w;
    }
    return sum;
  }

  void main() {
    vec2 p = vWorld.xz;
    float e = 0.12;
    float h0 = waves(p) + ripples(p);
    float hx = waves(p + vec2(e, 0.0)) + ripples(p + vec2(e, 0.0));
    float hz = waves(p + vec2(0.0, e)) + ripples(p + vec2(0.0, e));
    vec3 n = normalize(vec3((h0 - hx) / e * 0.18, 1.0, (h0 - hz) / e * 0.18));

    vec3 v = normalize(cameraPosition - vWorld);
    float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 refl = reflect(-v, n);
    vec3 sky = mix(uHorizon, uZenith, clamp(refl.y * 1.8, 0.0, 1.0));
    float spec = pow(max(dot(refl, uSunDir), 0.0), 220.0) * 4.0 + pow(max(dot(refl, uSunDir), 0.0), 18.0) * 0.12;

    float r = length(vLocal);
    vec3 body = mix(uDeep, uShallow, smoothstep(0.35, 1.0, r));
    vec3 color = mix(body, sky, fresnel) + vec3(1.0, 0.94, 0.8) * spec;
    float foam = smoothstep(0.86, 0.98, r) * (0.55 + 0.45 * sin(uTime * 1.4 + atan(vLocal.y, vLocal.x) * 7.0));
    color = mix(color, vec3(0.9, 0.92, 0.88), foam * 0.4);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #ifdef USE_FOG
      gl_FragColor.rgb = ktbAtmosphere(gl_FragColor.rgb, vWorld, vFogDepth);
    #endif
  }`;

export class Pond {
  readonly mesh: Mesh<CircleGeometry, ShaderMaterial>;
  private next = 0;

  constructor(
    readonly shape: PondShape,
    sky: { zenith: number; horizon: number },
  ) {
    const geometry = new CircleGeometry(1, 64);
    geometry.rotateX(-Math.PI / 2);
    const material = new ShaderMaterial({
      name: "ktb-water",
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uDeep: { value: new Color(0x1f3b3a) },
          uShallow: { value: new Color(0x4f6b4a) },
          uZenith: { value: new Color(sky.zenith) },
          uHorizon: { value: new Color(sky.horizon) },
          uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, -100, 0)) },
        },
      ]),
      vertexShader,
      fragmentShader,
    });
    material.uniforms.uTime = globalUniforms.uTime;
    material.uniforms.uSunDir = globalUniforms.uSunDir;

    this.mesh = new Mesh(geometry, material);
    this.mesh.name = "pond";
    this.mesh.position.set(shape.x, shape.level, shape.z);
    // Slightly larger than the bowl so the terrain cuts the shore line.
    this.mesh.scale.set(shape.rx * 1.25, 1, shape.rz * 1.25);
    this.mesh.userData.water = true;
  }

  /** Starts an expanding ripple ring at a world position. */
  ripple(x: number, z: number, strength = 1): void {
    const slot = this.mesh.material.uniforms.uRipples!.value[this.next] as Vector4;
    slot.set(x, z, globalUniforms.uTime.value, strength);
    this.next = (this.next + 1) % MAX_RIPPLES;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
