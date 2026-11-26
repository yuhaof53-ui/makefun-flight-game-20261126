// Ridge Runner — the screenshot scenes behind ?shot=start|play|rings|landing.
// Each scene plays the real rules forward from a fresh flight, steered by a
// simple autopilot (bank toward the target, pitch to hold altitude, throttle
// to hold speed), so every frame is what a short game really looks like, and
// the same seed always gives the same frame.
import { RINGS, RUNWAYS } from './config.js';
import { createFlightState, stepFlight, forwardOf } from './physics.js';
import { createMissions, checkRings, onLanded, onTakeoff } from './missions.js';
import { terrainHeight } from './terrain.js';
import { angleDiff, clamp } from './random.js';

const STEP = 1 / 60;
const PLAY_SECONDS = 14;
const RINGS_SECONDS = 42;

/** Steer toward a point at a target altitude, at a target speed. */
export function autopilot(state, target, targetAlt, targetSpeed) {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const wantHeading = Math.atan2(dx, dz);
  const headingErr = angleDiff(wantHeading, state.heading);
  // A right bank *decreases* the heading (forward is (sin h, 0, cos h)), so a
  // positive heading error needs a *left* bank: the sign is inverted here.
  const bank = clamp(-headingErr * 1.4, -1, 1);
  const altErr = targetAlt - state.y;
  const pitch = clamp(altErr * 0.02, -1, 1);
  const speedErr = targetSpeed - state.speed;
  const throttle = clamp(0.55 + speedErr * 0.03, 0, 1);
  return { pitch, bank, throttle };
}

/** A point on the route line `from` → `to`, a lookahead past the plane's
    closest point on that line: steering at it keeps the plane on the line
    instead of orbiting the point, which a fast plane cannot turn onto. */
function lineTarget(state, from, to, lookahead) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = clamp(((state.x - from.x) * dx + (state.z - from.z) * dz) / len2, 0, 1);
  const len = Math.sqrt(len2);
  return {
    x: from.x + dx * t + (dx / len) * lookahead,
    z: from.z + dz * t + (dz / len) * lookahead,
  };
}

/** Run the sim forward for `seconds`, steering at `target` the whole way. */
function flyFor(state, missions, seconds, target, targetAlt, targetSpeed, onEvent) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = autopilot(state, target, targetAlt, targetSpeed);
    const prev = { x: state.x, y: state.y, z: state.z };
    const event = stepFlight(state, input, STEP);
    if (event === 'landed' && onEvent) onEvent('landed', state);
    if (event === 'takeoff' && onEvent) onEvent('takeoff', state);
    if (event === 'crashed') break;
    checkRings(missions, state, prev);
    if (state.crashed) break;
  }
}

/** Fly along the line `from` → `to`, looking ahead of the closest point. */
function flyLine(state, missions, seconds, from, to, targetAlt, targetSpeed) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = lineTarget(state, from, to, 120);
    const input = autopilot(state, target, targetAlt, targetSpeed);
    const prev = { x: state.x, y: state.y, z: state.z };
    const event = stepFlight(state, input, STEP);
    if (event === 'crashed') break;
    checkRings(missions, state, prev);
    if (state.crashed) break;
  }
}

/** Fly the ring route, always steering at the next unflown ring. */
function flyRings(state, missions, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const next = RINGS[missions.ringsHit] ?? RINGS[RINGS.length - 1];
    const from = missions.ringsHit === 0
      ? { x: RUNWAYS[0].x, z: RUNWAYS[0].z }
      : RINGS[missions.ringsHit - 1];
    const target = lineTarget(state, from, next, 120);
    const input = autopilot(state, target, next.y, 48);
    const prev = { x: state.x, y: state.y, z: state.z };
    const event = stepFlight(state, input, STEP);
    if (event === 'crashed') break;
    checkRings(missions, state, prev);
    if (state.crashed) break;
  }
}

/**
 * Set the flight and mission state to the named scene and return the screen
 * and camera view to draw over it. Names: start, play, rings, landing.
 */
export function stageShot(name, state, missions) {
  const fresh = createFlightState();
  Object.assign(state, fresh);
  Object.assign(missions, { index: 0, ringsHit: 0, score: 0, tourDone: false, status: 'flying', banner: '', bannerUntil: 0 });

  if (name === 'play') {
    state.throttle = 0.7;
    flyFor(state, missions, 3, { x: 60, z: 0 }, 90, 48);
    flyLine(state, missions, PLAY_SECONDS, { x: 0, z: 700 }, { x: RINGS[1].x, z: RINGS[1].z }, RINGS[1].y, 48);
    return { screen: 'play', view: 'chase', time: 26 };
  }
  if (name === 'rings') {
    missions.index = 1;
    state.throttle = 0.7;
    flyFor(state, missions, 3, { x: 60, z: 0 }, 90, 48);
    flyRings(state, missions, RINGS_SECONDS);
    return { screen: 'play', view: 'chase', time: 36 };
  }
  if (name === 'landing') {
    const strip = RUNWAYS[1];
    const ground = terrainHeight(strip.x, strip.z);
    // Start on final: 520 m out on the centreline, aligned with the strip,
    // 42 m up, already flying — then play the real rules down the glidepath.
    // Laketown's runway points east into the mountain, so the approach comes
    // from the east, down the valley, not from the rock face to the west.
    const out = 520;
    state.x = strip.x + Math.sin(strip.heading) * out;
    state.z = strip.z + Math.cos(strip.heading) * out;
    state.y = ground + 42;
    state.heading = strip.heading + Math.PI;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 38;
    state.throttle = 0.42;
    state.airborne = true;
    for (let i = 0; i < Math.round(14 / STEP); i += 1) {
      // A 3.4-degree glidepath: aim for the threshold at 6 m, higher the
      // further out, so the plane arrives low over the numbers, not in a dive.
      const dist = Math.hypot(state.x - strip.x, state.z - strip.z);
      const glideAlt = ground + 6 + dist * 0.06;
      const input = autopilot(state, { x: strip.x, z: strip.z }, glideAlt, 34);
      const event = stepFlight(state, input, STEP);
      if (event === 'landed' || event === 'crashed') break;
      if (dist < 60) break;
    }
    return { screen: 'play', view: 'cockpit', time: 52 };
  }
  // start: parked on Pinefield at dawn light, title screen over it.
  return { screen: 'title', view: 'chase', time: 0 };
}

export { forwardOf };
