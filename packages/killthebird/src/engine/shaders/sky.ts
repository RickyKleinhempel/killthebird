import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from "three";
import { NOISE_GLSL, globalUniforms } from "./common";

export interface SkyColors {
  zenith: number;
  horizon: number;
}

/**
 * Sky dome: gradient, warm horizon band towards the sun, sun disc with corona
 * and glare, slowly drifting procedural cirrus clouds, and dithering against
 * banding. The dome follows the camera, so it is always "infinitely" far away.
 * It is drawn after all opaque geometry and depth tested on the far plane, so
 * its costly fragment shader only runs for pixels that actually show sky.
 */
export function createSky(colors: SkyColors): Mesh<SphereGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({
    name: "ktb-sky",
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color(colors.zenith) },
      uHorizon: { value: new Color(colors.horizon) },
      uSunDir: globalUniforms.uSunDir,
      uTime: globalUniforms.uTime,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // on the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        float s = max(dot(dir, uSunDir), 0.0);

        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.6, h), 0.75));
        // warm haze band along the horizon, strongest towards the sun
        float band = pow(1.0 - clamp(abs(h), 0.0, 1.0), 7.0);
        col = mix(col, uHorizon * vec3(1.12, 1.0, 0.86), band * (0.25 + 0.55 * pow(s, 3.0)));

        // high cirrus, projected onto a plane above the camera
        if (h > 0.0) {
          vec2 uv = dir.xz / (h + 0.15);
          uv += vec2(uTime * 0.006, uTime * 0.002);
          float c = ktbFbm(uv * 1.6 + vec2(3.0, 9.0));
          float streak = ktbFbm(vec2(uv.x * 0.6, uv.y * 3.2) + 11.0);
          c = smoothstep(0.5, 0.85, c * 0.6 + streak * 0.5);
          c *= smoothstep(0.03, 0.22, h) * (1.0 - smoothstep(0.55, 0.95, h));
          vec3 cloud = mix(vec3(1.0, 0.99, 0.97), vec3(1.0, 0.9, 0.76), pow(s, 6.0));
          col = mix(col, cloud, c * 0.5);
        }

        // sun: glare, corona and a crisp disc
        col += vec3(1.0, 0.86, 0.62) * (pow(s, 6.0) * 0.16 + pow(s, 48.0) * 0.32 + pow(s, 500.0) * 1.1);
        col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.9993, 0.9996, s));

        col += (ktbHash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new Mesh(new SphereGeometry(1200, 32, 16), material);
  sky.name = "sky";
  sky.renderOrder = 100; // last in the opaque list; transparents still follow
  sky.frustumCulled = false;
  return sky;
}
