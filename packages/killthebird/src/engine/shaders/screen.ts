import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { NOISE_GLSL, globalUniforms } from "./common";

/**
 * Full-screen finishing pass drawn as the last object of the scene (no render
 * targets needed): vignette, animated film grain and a warm muzzle flash.
 */
export class ScreenOverlay {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;

  constructor() {
    const material = new ShaderMaterial({
      name: "ktb-screen",
      uniforms: {
        uTime: globalUniforms.uTime,
        uAspect: { value: 16 / 9 },
        uVignette: { value: 0.42 },
        uGrain: { value: 0.045 },
        uFlash: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uAspect;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uFlash;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          vec2 c = vUv - 0.5;
          c.x *= mix(1.0, uAspect, 0.6);
          float d = length(c);
          float vignette = smoothstep(0.38, 0.95, d) * uVignette;
          float flash = uFlash * (0.55 + 0.45 * smoothstep(0.6, 0.0, d));
          float grain = (ktbHash(vUv * vec2(1733.0, 977.0) + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
          float alpha = clamp(vignette + flash * 0.22 + abs(grain), 0.0, 1.0);
          vec3 dark = vec3(0.06, 0.04, 0.02);
          vec3 warm = vec3(1.0, 0.86, 0.6);
          vec3 color = mix(dark, warm, clamp(flash * 0.22 / max(alpha, 1e-3), 0.0, 1.0));
          color = mix(color, vec3(step(0.0, grain)), abs(grain) / max(alpha, 1e-3));
          gl_FragColor = vec4(color, alpha);
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), material);
    this.mesh.name = "screen-overlay";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
  }

  setAspect(aspect: number): void {
    this.mesh.material.uniforms.uAspect!.value = aspect;
  }

  flash(): void {
    this.mesh.material.uniforms.uFlash!.value = 1;
  }

  update(dt: number): void {
    const u = this.mesh.material.uniforms.uFlash!;
    u.value = Math.max(0, u.value - dt * 9);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}
