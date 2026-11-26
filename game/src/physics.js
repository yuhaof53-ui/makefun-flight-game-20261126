// Ridge Runner — the flight model: an arcade bush-plane model.
// Throttle makes speed, speed makes lift, bank makes the turn, and the wing
// quits below stall speed. Ground contact is a landing only on a strip, with
// the nose roughly straight and the descent gentle; anything else is a crash.
import { PLANE, RUNWAYS, LAKE } from './config.js';
import { terrainHeight, nearestRunway } from './terrain.js';
import { clamp, angleDiff } from './random.js';

const GRAVITY = 9.8;
const WHEEL_HEIGHT = 1.4;

/** Fresh flight state: parked on Pinefield, engine idling. */
export function createFlightState() {
  const home = RUNWAYS[0];
  const ground = terrainHeight(home.x, home.z);
  return {
    x: home.x, y: ground + WHEEL_HEIGHT, z: home.z,
    heading: home.heading, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    fuel: PLANE.FUEL_MAX, hull: PLANE.HULL_MAX,
    airborne: false, landed: false, crashed: false, crashReason: '',
    verticalSpeed: 0, groundSpeed: 0,
    time: 0,
  };
}

/** Forward unit vector from a heading. */
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/** True when the plane is over a runway footprint, with local coordinates. */
function runwayUnder(x, z) {
  const near = nearestRunway(x, z);
  if (!near) return null;
  const { strip, along, across } = near;
  if (Math.abs(along) > strip.length / 2 || Math.abs(across) > strip.width / 2) return null;
  return { strip, along, across };
}

function overLake(x, z) {
  return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius;
}

/**
 * Advance the flight state by dt seconds.
 * `input` is { pitch: -1..1, bank: -1..1, throttle: 0..1 }.
 * Returns an event string: '', 'takeoff', 'landed', 'bounced', 'crashed'.
 */
export function stepFlight(state, input, dt) {
  if (state.crashed) return '';
  state.time += dt;
  const ground = terrainHeight(state.x, state.z);

  // Throttle eases toward the pilot's setting; an empty tank forces idle.
  const wantThrottle = state.fuel <= 0 ? 0 : clamp(input.throttle, 0, 1);
  state.throttle += clamp(wantThrottle - state.throttle, -dt * 0.6, dt * 0.6);
  state.fuel = Math.max(0, state.fuel - state.throttle * PLANE.FUEL_BURN * dt);

  // Pitch and bank ease toward what the pilot asks; the wing answers only
  // when there is airspeed over it.
  const authority = clamp(state.speed / PLANE.STALL_SPEED, 0, 1);
  const targetPitch = clamp(input.pitch, -1, 1) * PLANE.MAX_PITCH * authority;
  const targetRoll = clamp(input.bank, -1, 1) * PLANE.MAX_BANK * authority;
  state.pitch += clamp(targetPitch - state.pitch, -PLANE.PITCH_RATE * dt, PLANE.PITCH_RATE * dt);
  state.roll += clamp(targetRoll - state.roll, -PLANE.ROLL_RATE * dt, PLANE.ROLL_RATE * dt);

  // Speed: thrust minus drag, minus the cost of climbing.
  const accel = state.throttle * PLANE.THRUST
    - PLANE.DRAG * state.speed * state.speed
    - GRAVITY * Math.sin(state.pitch) * 0.35;
  state.speed = Math.max(0, state.speed + accel * dt);

  // A banked turn: the heading follows the bank, faster when slow.
  // Convention: forward is (sin h, 0, cos h), so facing +Z the plane's right
  // is -X and a right bank (roll > 0) *decreases* the heading.
  let turnRate = (GRAVITY * Math.tan(state.roll)) / Math.max(state.speed, 8);
  turnRate = clamp(turnRate, -0.6, 0.6);
  state.heading -= turnRate * dt * (state.airborne ? 1 : 0.25);

  // Vertical speed: climb from pitch, minus the sink of a stalled wing.
  let sink = 0;
  if (state.speed < PLANE.STALL_SPEED) sink = (PLANE.STALL_SPEED - state.speed) * 0.55;
  const climb = state.speed * Math.sin(state.pitch) - sink;
  state.verticalSpeed = climb;

  const fwd = forwardOf(state.heading);
  const horizontal = state.speed * Math.cos(state.pitch);
  state.x += fwd.x * horizontal * dt;
  state.z += fwd.z * horizontal * dt;
  state.y += climb * dt;
  state.groundSpeed = horizontal;

  // Take-off: fast enough and the nose up, she flies.
  if (!state.airborne && state.speed >= PLANE.ROTATE_SPEED && state.pitch > 0.06) {
    state.airborne = true;
    state.landed = false;
    return 'takeoff';
  }

  // Rolling on the ground: stay glued to it, braking drags the speed down.
  if (!state.airborne) {
    state.y = ground + WHEEL_HEIGHT;
    if (state.throttle < 0.15) state.speed = Math.max(0, state.speed - 14 * dt);
    return '';
  }

  // In the air, near the ground: landing, a bounce, or a crash.
  if (state.y <= ground + WHEEL_HEIGHT) {
    if (overLake(state.x, state.z) && state.y <= LAKE.waterY + 1.0) {
      state.crashed = true;
      state.crashReason = 'lake';
      return 'crashed';
    }
    const strip = runwayUnder(state.x, state.z);
    const aligned = strip
      ? Math.min(
        Math.abs(angleDiff(state.heading, strip.strip.heading)),
        Math.abs(angleDiff(state.heading, strip.strip.heading + Math.PI)),
      ) < 0.45
      : false;
    if (strip && aligned && Math.abs(state.pitch) < 0.16 && state.speed >= 12 && state.speed <= 52) {
      if (climb >= -4.5) {
        state.airborne = false;
        state.landed = true;
        state.y = ground + WHEEL_HEIGHT;
        state.pitch = 0;
        state.roll = 0;
        return 'landed';
      }
      // Hard but survivable: she bounces and takes damage.
      state.hull -= 25;
      state.y = ground + WHEEL_HEIGHT + 2.5;
      state.verticalSpeed = 3;
      if (state.hull <= 0) {
        state.crashed = true;
        state.crashReason = 'hard-landing';
        return 'crashed';
      }
      return 'bounced';
    }
    if (climb < -2 || state.speed > 12) {
      state.crashed = true;
      state.crashReason = 'terrain';
      return 'crashed';
    }
    // A gentle touch on rough ground still ends the flight.
    state.crashed = true;
    state.crashReason = 'terrain';
    return 'crashed';
  }
  return '';
}
