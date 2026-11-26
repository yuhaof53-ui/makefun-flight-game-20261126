// Ridge Runner — the delivery contracts: objectives, rings and score.
// Three sorties in order: a parcel run, a ring route, and a low-fuel return.
// Landing at a strip refuels the tank and banks the contract's reward.
import { MISSIONS, RINGS, RING_NORMALS, RUNWAYS, SCORE } from './config.js';

/** Fresh mission state: contract 1, no rings flown, no score. */
export function createMissions() {
  return {
    index: 0,
    ringsHit: 0,
    score: 0,
    tourDone: false,
    /** 'flying' | 'done' | 'failed' */
    status: 'flying',
    banner: '',
    bannerUntil: 0,
  };
}

function showBanner(missions, text, now, seconds = 3) {
  missions.banner = text;
  missions.bannerUntil = now + seconds;
}

function ringDistance(state, ring) {
  return Math.hypot(state.x - ring.x, state.y - ring.y, state.z - ring.z);
}

/** The strip a contract wants you on, or null while rings are the job. */
export function currentTarget(missions) {
  if (missions.index >= MISSIONS.length) return null;
  const id = MISSIONS[missions.index].id;
  if (id === 'parcel') return RUNWAYS[1];
  if (id === 'return') return RUNWAYS[0];
  return null;
}

/** One line for the HUD: what the pilot has to do right now. */
export function objectiveText(missions) {
  if (missions.tourDone) return 'Tour complete — free flight. Enjoy the valley.';
  if (missions.index >= MISSIONS.length) return 'Tour complete — free flight. Enjoy the valley.';
  const mission = MISSIONS[missions.index];
  if (mission.id === 'rings') return `${mission.title} — rings ${missions.ringsHit}/6`;
  return mission.title;
}

/** React to a landing: pay the contract that wanted this strip. */
export function onLanded(missions, stripId, state) {
  if (missions.tourDone || missions.index >= MISSIONS.length) {
    state.fuel = 100;
    return 'refuel';
  }
  const mission = MISSIONS[missions.index];
  state.fuel = 100;
  if (mission.id === 'parcel' && stripId === 'laketown') {
    missions.score += SCORE.DELIVERY + SCORE.LANDING;
    showBanner(missions, `Delivered! +${SCORE.DELIVERY + SCORE.LANDING}`, state.time, 3.5);
    missions.index += 1;
    return 'delivered';
  }
  if (mission.id === 'return' && stripId === 'pinefield') {
    missions.score += SCORE.DELIVERY + SCORE.LANDING + SCORE.TOUR_BONUS;
    missions.tourDone = true;
    missions.index += 1;
    showBanner(missions, `Home safe! Tour complete +${SCORE.DELIVERY + SCORE.LANDING + SCORE.TOUR_BONUS}`, state.time, 5);
    return 'tour-done';
  }
  missions.score += SCORE.LANDING;
  return 'landed';
}

/** React to a take-off: the return contract starts low on fuel. */
export function onTakeoff(missions, state) {
  if (missions.index < MISSIONS.length && MISSIONS[missions.index].id === 'return') {
    state.fuel = Math.min(state.fuel, 35);
    showBanner(missions, 'Fuel low — make every litre count.', state.time, 3.5);
  }
}

/**
 * Check the rings while flying the ring contract.
 * A ring counts when the plane crosses its gate plane within the ring's
 * radius — the crossing point, not a distance to the centre, so a fast pass
 * through the gate counts even when the turn after it is wide. `prev` is the
 * plane's position before this step. A near-centre pass counts too.
 * Returns 'ring' when a new ring is flown, 'rings-done' at the last one.
 */
export function checkRings(missions, state, prev) {
  if (missions.index >= MISSIONS.length) return '';
  if (MISSIONS[missions.index].id !== 'rings') return '';
  const next = RINGS[missions.ringsHit];
  if (!next) return '';
  const normal = RING_NORMALS[missions.ringsHit];
  let hit = false;
  if (prev) {
    const d0 = (prev.x - next.x) * normal.x + (prev.y - next.y) * normal.y + (prev.z - next.z) * normal.z;
    const d1 = (state.x - next.x) * normal.x + (state.y - next.y) * normal.y + (state.z - next.z) * normal.z;
    if ((d0 > 0 && d1 <= 0) || (d0 < 0 && d1 >= 0)) {
      const t = d0 / (d0 - d1);
      const cx = prev.x + (state.x - prev.x) * t;
      const cy = prev.y + (state.y - prev.y) * t;
      const cz = prev.z + (state.z - prev.z) * t;
      if (Math.hypot(cx - next.x, cy - next.y, cz - next.z) < next.r) hit = true;
    }
  }
  if (!hit && ringDistance(state, next) < next.r * 0.85) hit = true;
  if (hit) {
    missions.ringsHit += 1;
    missions.score += SCORE.RING;
    if (missions.ringsHit >= RINGS.length) {
      missions.score += SCORE.MISSION_BONUS;
      showBanner(missions, `Ring route complete! +${SCORE.RING + SCORE.MISSION_BONUS}`, state.time, 3.5);
      missions.index += 1;
      return 'rings-done';
    }
    showBanner(missions, `Ring ${missions.ringsHit}/6  +${SCORE.RING}`, state.time, 2);
    return 'ring';
  }
  return '';
}

/** The next ring the pilot should aim for, or null. */
export function nextRing(missions) {
  if (missions.index >= MISSIONS.length) return null;
  if (MISSIONS[missions.index].id !== 'rings') return null;
  return RINGS[missions.ringsHit] ?? null;
}
