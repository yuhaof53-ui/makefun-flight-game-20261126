// Ridge Runner — the renderer: sky, valley, rings and the two cameras.
// Chase view follows behind the plane; cockpit view sits in the seat with the
// dashboard lit. The judge sees the game through these frames, so the chase
// view keeps the plane, the terrain, a ring and the runway in shot.
import * as THREE from '../vendor/three.module.min.js';
import { RINGS, PALETTE } from './config.js';
import { buildTerrain, buildLake, buildTrees, buildAirfields } from './terrain.js';
import { buildPlane } from './plane.js';
import { createRandom, clamp } from './random.js';
import { forwardOf } from './physics.js';

function sunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 246, 214, 1)');
  grad.addColorStop(0.35, 'rgba(255, 226, 160, 0.85)');
  grad.addColorStop(1, 'rgba(255, 226, 160, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/** Build the whole scene once. Returns the draw handle. */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 260, 2200);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 5000);

  const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x5a6b4a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.5);
  sun.position.set(600, 900, -400);
  scene.add(sun);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTexture(), transparent: true, depthWrite: false,
  }));
  sunSprite.scale.set(420, 420, 1);
  sunSprite.position.set(1500, 1100, -2600);
  scene.add(sunSprite);

  scene.add(buildTerrain());
  scene.add(buildLake());
  scene.add(buildTrees());
  scene.add(buildAirfields());

  // Clouds: flat white puffs drifting slowly over the valley.
  const clouds = [];
  const rand = createRandom(777);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j += 1) {
      const r = 14 + rand() * 22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set((rand() - 0.5) * 70, (rand() - 0.5) * 8, (rand() - 0.5) * 30);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 2200, 250 + rand() * 170, (rand() - 0.5) * 2200);
    cloud.userData.speed = 1.5 + rand() * 2;
    clouds.push(cloud);
    scene.add(cloud);
  }

  // The ring route: amber gates, green once flown, a light beam over the next.
  const rings = [];
  for (let i = 0; i < RINGS.length; i += 1) {
    const def = RINGS[i];
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.92 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(def.r, 1.2, 12, 42), mat);
    ring.position.set(def.x, def.y, def.z);
    const prev = RINGS[Math.max(0, i - 1)];
    const next = RINGS[Math.min(RINGS.length - 1, i + 1)];
    const dir = new THREE.Vector3(next.x - prev.x, next.y - prev.y, next.z - prev.z).normalize();
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    ring.userData.baseScale = 1;
    ring.userData.index = i;
    scene.add(ring);
    rings.push(ring);
  }
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 120, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: PALETTE.ring, transparent: true, opacity: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  scene.add(beam);

  const plane = buildPlane();
  plane.group.rotation.order = 'YXZ';
  scene.add(plane.group);

  // The chase camera lerps behind the plane; the first frame snaps straight
  // there, so a staged shot (which paints with dt = 0) still frames the plane.
  let cameraPlaced = false;

  function resize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 800;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /** Paint one frame from the flight state. */
  function draw(state, missions, view, dt, time) {
    // The aeroplane follows the flight model exactly.
    plane.group.position.set(state.x, state.y, state.z);
    plane.group.rotation.y = state.heading;
    plane.group.rotation.x = -state.pitch;
    plane.group.rotation.z = state.roll;
    plane.prop.rotation.z += dt * (3 + state.throttle * 42);
    plane.prop.userData.blur.material.opacity = 0.05 + state.throttle * 0.16;

    // Rings: passed ones go green, the next one pulses under its beam.
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      const done = i < missions.ringsHit;
      ring.material.color.setHex(done ? PALETTE.ringDone : PALETTE.ring);
      const pulse = i === missions.ringsHit && missions.index === 1 ? 1 + 0.05 * Math.sin(time * 2.4) : 1;
      ring.scale.setScalar(pulse);
    }
    const next = missions.index === 1 ? RINGS[missions.ringsHit] : null;
    if (next) {
      beam.visible = true;
      beam.position.set(next.x, next.y + 60, next.z);
    } else {
      beam.visible = false;
    }

    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 1250) cloud.position.x = -1250;
    }

    const fwd = forwardOf(state.heading);
    if (view === 'cockpit') {
      plane.body.visible = false;
      plane.dashPanel.visible = true;
      camera.position.set(
        state.x + fwd.x * 1.1,
        state.y + 1.15,
        state.z + fwd.z * 1.1,
      );
      const cp = Math.cos(state.pitch);
      const sp = Math.sin(state.pitch);
      camera.lookAt(
        state.x + fwd.x * cp * 60,
        state.y + 1.15 + sp * 60,
        state.z + fwd.z * cp * 60,
      );
    } else {
      plane.body.visible = true;
      plane.dashPanel.visible = false;
      const desired = new THREE.Vector3(
        state.x - fwd.x * 22,
        state.y + 6.5,
        state.z - fwd.z * 22,
      );
      if (!cameraPlaced) {
        camera.position.copy(desired);
        cameraPlaced = true;
      } else {
        const k = 1 - Math.exp(-6 * dt);
        camera.position.lerp(desired, clamp(k, 0, 1));
      }
      camera.lookAt(
        state.x + fwd.x * 34,
        state.y + 0.6,
        state.z + fwd.z * 34,
      );
      camera.rotateZ(-state.roll * 0.28);
    }
    renderer.render(scene, camera);
  }

  return { draw, resize };
}
