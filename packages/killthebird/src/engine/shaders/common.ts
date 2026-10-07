import { Vector2, Vector3 } from "three";

/**
 * Uniforms shared by every custom shader. Materials reference these objects
 * directly, so updating `.value` once per frame updates all of them.
 */
export const globalUniforms = {
  uTime: { value: 0 },
  /** Horizontal wind direction (normalised, xz). */
  uWindDir: { value: new Vector2(1, 0.3).normalize() },
  /** 0 = calm, 1 = normal breeze. */
  uWindStrength: { value: 1 },
  /** Direction towards the sun (normalised). Matches the sky's sun disc. */
  uSunDir: { value: new Vector3(-0.55, 0.42, -0.72).normalize() },
};

export type GlobalUniforms = typeof globalUniforms;

/** Cheap value noise + fbm, prefixed to avoid clashes with three's chunks. */
export const NOISE_GLSL = /* glsl */ `
float ktbHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float ktbNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ktbHash(i), ktbHash(i + vec2(1.0, 0.0)), u.x),
             mix(ktbHash(i + vec2(0.0, 1.0)), ktbHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float ktbFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ktbNoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
`;

/**
 * Aerial perspective. Replaces three's linear fog: thicker haze over low
 * ground, and the fog turns warm when looking towards the sun.
 * Must be inserted after <fog_pars_fragment> (needs fogColor/fogNear/fogFar)
 * and applied where three applies fog (after the colour space conversion).
 */
export const ATMOSPHERE_GLSL = /* glsl */ `
#ifdef USE_FOG
vec3 ktbAtmosphere(vec3 color, vec3 worldPos, float depth) {
  #ifdef FOG_EXP2
    float f = 1.0 - exp(-fogDensity * fogDensity * depth * depth);
  #else
    float f = smoothstep(fogNear, fogFar, depth);
  #endif
  // extra haze close to the ground (never less than the distance fog)
  float lowGround = exp(-max(worldPos.y - 1.0, 0.0) * 0.04);
  f = clamp(f * (1.0 + 0.3 * lowGround), 0.0, 1.0);
  vec3 view = normalize(worldPos - cameraPosition);
  float sun = pow(max(dot(view, uSunDir), 0.0), 5.0);
  vec3 tint = mix(fogColor, fogColor * vec3(1.16, 1.05, 0.84) + vec3(0.05, 0.035, 0.0), sun);
  return mix(color, tint, f);
}
#endif
`;
