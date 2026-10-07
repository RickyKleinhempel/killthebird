import type { Material, MeshStandardMaterial } from "three";
import { ATMOSPHERE_GLSL, NOISE_GLSL, globalUniforms } from "./common";

export interface PatchOptions {
  /** Vertex sway driven by the per-vertex `aWind` attribute (metres). */
  wind?: boolean;
  /** Fine procedural colour variation for the ground. */
  groundDetail?: boolean;
  /** Soft sky-coloured rim light that separates silhouettes from the background. */
  rim?: boolean;
}

const WIND_VERTEX = /* glsl */ `
{
  vec4 kw = modelMatrix * vec4(transformed, 1.0);
  float ph = uTime * 1.7 + kw.x * 0.21 + kw.z * 0.13;
  float gust = 0.55 + 0.45 * sin(uTime * 0.37 + kw.x * 0.02 + kw.z * 0.01);
  float sway = (sin(ph) * 0.65 + sin(ph * 2.13 + 1.3) * 0.25 + 0.45) * gust * uWindStrength;
  vec2 d = uWindDir * sway * aWind;
  // leaf flutter
  d += vec2(sin(uTime * 7.3 + kw.y * 3.1 + kw.x), cos(uTime * 6.1 + kw.z * 2.7 + kw.y)) * 0.12 * aWind;
  transformed.x += d.x;
  transformed.z += d.y;
  transformed.y -= dot(d, d) * 0.25;
}
`;

const WORLD_POS_VERTEX = /* glsl */ `
{
  vec4 kp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    kp = instanceMatrix * kp;
  #endif
  vKtbWorld = (modelMatrix * kp).xyz;
}
`;

const GROUND_DETAIL = /* glsl */ `
{
  vec2 gp = vKtbWorld.xz;
  float n1 = ktbFbm(gp * 0.08);
  float n2 = ktbNoise(gp * 1.7);
  float n3 = ktbNoise(gp * 6.5);
  diffuseColor.rgb *= 0.8 + 0.32 * n1 + 0.1 * n2 + 0.07 * n3;
  float dry = smoothstep(0.56, 0.8, ktbFbm(gp * 0.035 + 7.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.2, 1.08, 0.72), dry * 0.55);
}
`;

const RIM = /* glsl */ `
{
  vec3 kv = normalize(vViewPosition);
  float rim = pow(1.0 - clamp(dot(normal, kv), 0.0, 1.0), 3.0);
  float skyward = clamp(normal.y * 0.6 + 0.5, 0.0, 1.0);
  outgoingLight += vec3(0.62, 0.68, 0.75) * rim * skyward * 0.28;
}
`;

const PATCHED = Symbol("ktbPatched");

/**
 * Extends a built-in MeshStandardMaterial with the game's look via
 * onBeforeCompile: aerial perspective fog (always), optional wind sway,
 * ground detail and rim light. Idempotent.
 */
export function patchMaterial<T extends MeshStandardMaterial>(material: T, options: PatchOptions = {}): T {
  const tagged = material as T & { [PATCHED]?: string };
  const key = `ktb:${options.wind ? "w" : ""}${options.groundDetail ? "g" : ""}${options.rim ? "r" : ""}`;
  if (tagged[PATCHED] === key) return material;
  tagged[PATCHED] = key;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.uniforms.uWindDir = globalUniforms.uWindDir;
    shader.uniforms.uWindStrength = globalUniforms.uWindStrength;
    shader.uniforms.uSunDir = globalUniforms.uSunDir;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vKtbWorld;
${options.wind ? "attribute float aWind;\nuniform float uTime;\nuniform vec2 uWindDir;\nuniform float uWindStrength;" : ""}`,
      )
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${options.wind ? WIND_VERTEX : ""}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${WORLD_POS_VERTEX}`);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vKtbWorld;\nuniform vec3 uSunDir;\n${NOISE_GLSL}`)
      .replace("#include <fog_pars_fragment>", `#include <fog_pars_fragment>\n${ATMOSPHERE_GLSL}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${options.groundDetail ? GROUND_DETAIL : ""}`)
      .replace("#include <opaque_fragment>", `${options.rim ? RIM : ""}\n#include <opaque_fragment>`)
      .replace(
        "#include <fog_fragment>",
        `#ifdef USE_FOG\n  gl_FragColor.rgb = ktbAtmosphere(gl_FragColor.rgb, vKtbWorld, vFogDepth);\n#endif`,
      );
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return material;
}

const variants = new WeakMap<Material, Map<string, MeshStandardMaterial>>();

/** A patched clone of `base` with extra options (e.g. wind), cached per base material. */
export function materialVariant(base: MeshStandardMaterial, options: PatchOptions): MeshStandardMaterial {
  let byKey = variants.get(base);
  if (!byKey) variants.set(base, (byKey = new Map()));
  const key = JSON.stringify(options);
  let variant = byKey.get(key);
  if (!variant) {
    variant = patchMaterial(base.clone(), options);
    variant.name = `${base.name}+${Object.keys(options).filter((k) => options[k as keyof PatchOptions]).join("+")}`;
    byKey.set(key, variant);
  }
  return variant;
}
