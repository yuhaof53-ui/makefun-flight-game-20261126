// Ridge Runner — seeded random numbers and smooth 2D value noise.
// The valley, the trees and the cloud drift all come from one fixed seed, so the
// world looks the same on every load and every screenshot is reproducible.

/** Mulberry32: a small, fast seeded PRNG with a full 32-bit period. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 2D hash: the same (x, y) cell always gives the same value. */
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1], bilinear over hashed lattice cells. */
export function noise2(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const ux = smooth(fx);
  const uy = smooth(fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Two octaves of value noise, still in roughly [0, 1]. */
export function fbm2(x, y, seed) {
  return noise2(x, y, seed) * 0.65 + noise2(x * 2.13 + 5.2, y * 2.13 + 1.3, seed) * 0.35;
}

/** Clamp helper used by the flight model and the terrain builder. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Smoothstep between two edges, 0 below `low`, 1 above `high`. */
export function smoothstep(low, high, value) {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Shortest signed difference between two headings, in (-PI, PI]. */
export function angleDiff(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
