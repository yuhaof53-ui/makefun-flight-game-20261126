// Ridge Runner — the valley: heightfield, lake, trees and the two airstrips.
// The physics and the renderer share one height function, so what you see is
// exactly what you can hit. The valley floor is a flattened ribbon along a
// curving centreline; the mountains rise on either side of it.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, RUNWAYS, LAKE, PALETTE } from './config.js';
import { fbm2, noise2, clamp, smoothstep } from './random.js';

const SEED = WORLD.SEED;

/** The valley's centreline wanders east and west as you fly north. */
export function valleyCenter(z) {
  return 170 * Math.sin(z * 0.0016) + 60 * Math.sin(z * 0.004 + 1.7);
}

function flattenNear(height, x, z, cx, cz, radius, target) {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= radius) return height;
  const t = smoothstep(radius, radius * 0.45, d);
  return height + (target - height) * t;
}

/** Ground height in metres at world (x, z). */
export function terrainHeight(x, z) {
  const cx = valleyCenter(z);
  const d = Math.abs(x - cx);
  const rise = smoothstep(120, 750, d);
  let h = 4 + rise * rise * 380;
  h += (fbm2(x * 0.004, z * 0.004, SEED) - 0.5) * 52 * (0.3 + rise);
  h += (noise2(x * 0.02 + 7, z * 0.02, SEED) - 0.5) * 12 * rise;
  for (const strip of RUNWAYS) {
    h = flattenNear(h, x, z, strip.x, strip.z, 200, 3.5);
  }
  const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (lakeD < 200) {
    const floor = -2 + smoothstep(60, 200, lakeD) * 10;
    h = Math.min(h, floor);
  }
  return h;
}

/** Colour of the ground at (x, z, height): meadow, scree, rock, snow, sand. */
function groundColor(x, z, h) {
  const low = new THREE.Color(PALETTE.terrainLow);
  const high = new THREE.Color(PALETTE.terrainHigh);
  const rock = new THREE.Color(PALETTE.rock);
  const snow = new THREE.Color(PALETTE.snow);
  const sand = new THREE.Color(PALETTE.sand);
  const cx = valleyCenter(z);
  const d = Math.abs(x - cx);
  const c = low.clone().lerp(high, smoothstep(40, 260, h));
  c.lerp(rock, smoothstep(170, 240, h));
  c.lerp(snow, smoothstep(300, 360, h));
  if (d < 16) c.lerp(sand, 0.55 * (1 - d / 16));
  const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (lakeD < LAKE.radius + 30) c.lerp(sand, 0.5 * (1 - smoothstep(LAKE.radius, LAKE.radius + 30, lakeD)));
  const n = (fbm2(x * 0.05, z * 0.05, SEED + 3) - 0.5) * 0.14;
  c.offsetHSL(0, 0, n);
  return c;
}

/** The terrain mesh, with vertex colours baked in. */
export function buildTerrain() {
  const size = WORLD.SIZE * 2;
  const seg = WORLD.MESH_SEGMENTS;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const c = groundColor(x, z, h);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(geo, mat);
}

/** The lake: a still blue disc sunk into its basin. */
export function buildLake() {
  const geo = new THREE.CircleGeometry(LAKE.radius, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: PALETTE.water, transparent: true, opacity: 0.88, shininess: 120,
  });
  const lake = new THREE.Mesh(geo, mat);
  lake.position.set(LAKE.x, LAKE.waterY, LAKE.z);
  return lake;
}

/** Pine trees scattered on the lower slopes, kept clear of strips and the lake. */
export function buildTrees() {
  const rand = (n) => {
    let s = (WORLD.SEED + n * 97) >>> 0;
    s = (s + 0x6d2b79f5) >>> 0;
    let v = s;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
  const cone = new THREE.ConeGeometry(3.2, 11, 6);
  const mat = new THREE.MeshLambertMaterial({ color: 0x2e5230 });
  const count = 850;
  const trees = new THREE.InstancedMesh(cone, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 12) {
    tries += 1;
    const x = (rand(tries) - 0.5) * WORLD.SIZE * 2;
    const z = (rand(tries + 5000) - 0.5) * WORLD.SIZE * 2;
    const h = terrainHeight(x, z);
    if (h < 8 || h > 150) continue;
    if (Math.abs(x - valleyCenter(z)) < 60) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 12) continue;
    let onStrip = false;
    for (const strip of RUNWAYS) {
      if (Math.abs(x - strip.x) < 150 && Math.abs(z - strip.z) < 150) onStrip = true;
    }
    if (onStrip) continue;
    const scale = 0.7 + rand(tries + 9000) * 0.9;
    p.set(x, h + 5 * scale, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(tries + 3000) * Math.PI * 2);
    s.set(scale, scale, scale);
    m.compose(p, q, s);
    trees.setMatrixAt(placed, m);
    placed += 1;
  }
  trees.count = placed;
  return trees;
}

function buildStripMesh(strip) {
  // A group yawed to the runway heading; every child is placed in the
  // strip's own frame: along is local +Z, across is local +X.
  const group = new THREE.Group();
  group.position.set(strip.x, 0, strip.z);
  group.rotation.y = strip.heading;
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(strip.width, strip.length),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 3.6, 0);
  group.add(asphalt);
  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  const dashes = Math.floor(strip.length / 24);
  for (let i = 0; i < dashes; i += 1) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 9), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 3.75, -strip.length / 2 + 14 + i * 24);
    group.add(dash);
  }
  // Edge lights: small amber posts along both edges.
  const lightGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i <= 10; i += 1) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(side * (strip.width / 2 + 2), 4.4, -strip.length / 2 + (i / 10) * strip.length);
      group.add(lamp);
    }
  }
  // Windsock on a pole beside the strip.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.set(strip.width / 2 + 12, 8, strip.length / 2 - 20);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2.4;
  sock.position.set(strip.width / 2 + 14, 12, strip.length / 2 - 20);
  group.add(sock);
  return group;
}

/** Both airstrips, plus a hangar and fuel drums at Pinefield. */
export function buildAirfields() {
  const group = new THREE.Group();
  for (const strip of RUNWAYS) group.add(buildStripMesh(strip));
  const home = RUNWAYS[0];
  const hangar = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(22, 7, 16),
    new THREE.MeshLambertMaterial({ color: 0xb8452a }),
  );
  walls.position.y = 3.5;
  hangar.add(walls);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 22, 3, 1),
    new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 7;
  roof.scale.set(1, 1, 0.72);
  hangar.add(roof);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 5.5),
    new THREE.MeshLambertMaterial({ color: 0x3c4148 }),
  );
  door.position.set(0, 2.75, 8.05);
  hangar.add(door);
  hangar.position.set(home.x + 42, 3.5, home.z + 40);
  hangar.rotation.y = Math.PI / 2;
  group.add(hangar);
  const drumMat = new THREE.MeshLambertMaterial({ color: 0x2f6fb2 });
  for (let i = 0; i < 3; i += 1) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 10), drumMat);
    drum.position.set(home.x + 26 + i * 3, 4.7, home.z - 60);
    group.add(drum);
  }
  return group;
}

/** Distance from (x, z) to the nearest runway centreline, and which strip. */
export function nearestRunway(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const strip of RUNWAYS) {
    const dx = x - strip.x;
    const dz = z - strip.z;
    const along = dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading);
    const across = dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading);
    const d = Math.hypot(Math.max(0, Math.abs(along) - strip.length / 2), across);
    if (d < bestD) {
      bestD = d;
      best = { strip, along, across, distance: d };
    }
  }
  return best;
}
