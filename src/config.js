/**
 * Scene constants for De Ophaalbrug. Metres; +Z faces the camera.
 * Canal runs along X; the bridge crosses it along Z.
 */
export const SLAB = { hx: 12, hz: 8, thick: 0.9 };

export const CANAL = {
  zBack: -0.6, // back quay edge (houses side)
  zFront: 5.0, // front quay edge (camera side)
  waterY: -0.5,
  floorY: -0.86,
  boatZ: 2.0,
};

export const BRIDGE = {
  x0: 0.0,
  x1: 3.0,
  cx: 1.5,
  hingeZ: CANAL.zBack,
  len: CANAL.zFront - CANAL.zBack, // 5.4
  deckY: 0.05,
  portalH: 4.2,
  maxLift: 1.36, // ~78 degrees
};

// Bike lanes. Facing -Z the right-hand lane is +X, so -Z traffic rides at x 2.1.
export const LANES = {
  bridgeAway: 2.1, // heading -Z, away from camera
  bridgeToward: 0.9, // heading +Z
  streetEast: -1.95, // back street, heading +X
  streetWest: -2.65, // back street, heading -X
  quayEast: 6.9, // front bike path, heading +X
  quayWest: 6.4, // front bike path, heading -X
  walk: 5.65, // front pavement by the water
};

export const STREET = { zNear: -1.4, zFar: -3.2, walkFar: -5.0 };
export const BARRIER = { frontZ: 5.3, backZ: -1.3 };

export const LOOP = 40.0;

export const POOL = { waterY: CANAL.waterY }; // wake template reads POOL.waterY

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
export const win = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const bell = (t, a, b, ramp = 0.35) =>
  smooth(win(t, a, a + ramp)) * (1 - smooth(win(t, b - ramp, b)));

export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Every walkable surface in this scene is at deck height 0. */
export function groundY() {
  return 0;
}

/**
 * Scalar keyframes [[t, v], ...] with monotone cubic (Fritsch–Carlson)
 * interpolation, so a mover eases without overshoot or a speed jump.
 */
export function keyed(keys) {
  const n = keys.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const h = keys[i + 1][0] - keys[i][0];
    const u = (t - keys[i][0]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * keys[i][1] +
      (u3 - 2 * u2 + u) * h * m[i] +
      (-2 * u3 + 3 * u2) * keys[i + 1][1] +
      (u3 - u2) * h * m[i + 1]
    );
  };
}
