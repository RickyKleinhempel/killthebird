/**
 * Edge scrolling: maps the pointer's horizontal position (0 = left edge,
 * 1 = right edge of the game) to a scroll factor in [-1, 1].
 * Inside the centre area the factor is 0; inside an edge zone it grows
 * quadratically towards the border so small incursions scroll gently.
 */
export function edgeScrollFactor(u: number, edge: number): number {
  if (edge <= 0) return 0;
  const x = Math.min(1, Math.max(0, u));
  if (x < edge) {
    const t = (edge - x) / edge;
    return -(t * t);
  }
  if (x > 1 - edge) {
    const t = (x - (1 - edge)) / edge;
    return t * t;
  }
  return 0;
}

export interface ScrollState {
  x: number;
  velocity: number;
}

/**
 * Integrates the camera position with exponential velocity smoothing and
 * clamps it to [-range, range]. Hitting a bound stops the camera.
 * Writes into `out` (may be `state` itself) to avoid a per-frame allocation.
 */
export function stepScroll(
  state: ScrollState,
  targetVelocity: number,
  dt: number,
  range: number,
  out: ScrollState = { x: 0, velocity: 0 },
  responsiveness = 9,
): ScrollState {
  const blend = 1 - Math.exp(-responsiveness * dt);
  let velocity = state.velocity + (targetVelocity - state.velocity) * blend;
  let x = state.x + velocity * dt;
  if (x < -range) {
    x = -range;
    velocity = 0;
  } else if (x > range) {
    x = range;
    velocity = 0;
  }
  out.x = x;
  out.velocity = velocity;
  return out;
}

/** Half width of the visible area at a given depth for a perspective camera. */
export function halfWidthAtDepth(depth: number, verticalFovDeg: number, aspect: number): number {
  return Math.abs(depth) * Math.tan(((verticalFovDeg / 2) * Math.PI) / 180) * aspect;
}

/**
 * Keeps the horizontal field of view wide on portrait/narrow screens by
 * widening the vertical FOV below a reference aspect ratio.
 */
export function fovForAspect(baseFovDeg: number, aspect: number, referenceAspect = 1.35): number {
  if (aspect >= referenceAspect) return baseFovDeg;
  const halfTan = Math.tan(((baseFovDeg / 2) * Math.PI) / 180) * (referenceAspect / aspect);
  return Math.min(80, (Math.atan(halfTan) * 360) / Math.PI);
}
