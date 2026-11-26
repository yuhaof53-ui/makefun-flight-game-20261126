// Ridge Runner — tuning, world layout, missions and keys.
// One place for every number a designer would want to change. All distances are
// metres, all speeds metres per second, all angles radians unless noted.
export const WORLD = {
  /** Half-size of the square terrain, in metres. */
  SIZE: 1200,
  /** Fixed seed: the same valley, lake and strips every visit. */
  SEED: 20261126,
  /** Terrain mesh resolution (segments per side). */
  MESH_SEGMENTS: 170,
};

export const PLANE = {
  /** Stall speed: below this the wing stops flying and the nose drops. */
  STALL_SPEED: 26,
  /** Level-flight top speed at full throttle. */
  MAX_SPEED: 78,
  /** Take-off rotation speed. */
  ROTATE_SPEED: 30,
  /** Thrust acceleration at full throttle, m/s^2. */
  THRUST: 9.5,
  /** Quadratic drag coefficient. */
  DRAG: 0.0016,
  /** How fast the bank eases toward the pilot's target. */
  ROLL_RATE: 1.9,
  /** How fast the pitch eases toward the pilot's target. */
  PITCH_RATE: 1.5,
  /** Steepest bank the pilot can command. */
  MAX_BANK: 1.05,
  /** Steepest pitch the pilot can command. */
  MAX_PITCH: 0.42,
  /** Fuel burn at full throttle, units per second. */
  FUEL_BURN: 0.5,
  /** Fuel tank size. */
  FUEL_MAX: 100,
  /** Hull integrity at the start of a sortie. */
  HULL_MAX: 100,
};

export const RUNWAYS = [
  {
    id: 'pinefield',
    name: 'Pinefield',
    /** Centre of the strip. */
    x: 0, z: 700,
    /** Heading of the runway, radians; forward = (sin h, 0, cos h). Pinefield
        faces north, down the valley toward the rings and Laketown. */
    heading: Math.PI,
    length: 280, width: 20,
  },
  {
    id: 'laketown',
    name: 'Laketown',
    x: -480, z: -600,
    heading: Math.PI / 2,
    length: 240, width: 18,
  },
];

export const LAKE = { x: -430, z: -480, radius: 170, waterY: 1.8 };

/** The ring route: six glowing gates down the valley, flown in order. */
export const RINGS = [
  { x: 120, y: 62, z: 480, r: 18 },
  { x: 60, y: 84, z: 0, r: 18 },
  { x: -180, y: 72, z: -300, r: 18 },
  { x: -430, y: 58, z: -480, r: 18 },
  { x: -200, y: 125, z: -820, r: 18 },
  { x: 150, y: 155, z: -960, r: 18 },
];

/** Each ring faces along the route: the normal its gate plane faces. */
export const RING_NORMALS = RINGS.map((ring, i) => {
  const prev = RINGS[Math.max(0, i - 1)];
  const next = RINGS[Math.min(RINGS.length - 1, i + 1)];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dz = next.z - prev.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
});

/** The three delivery contracts, flown in order. */
export const MISSIONS = [
  {
    id: 'parcel',
    title: 'Contract 1 — Parcel Run',
    brief: 'Take off from Pinefield, deliver the parcel to Laketown strip.',
    reward: 500,
  },
  {
    id: 'rings',
    title: 'Contract 2 — Ring Route',
    brief: 'Fly all six sky rings in order. Each ring pays 100.',
    reward: 200,
  },
  {
    id: 'return',
    title: 'Contract 3 — Dusk Return',
    brief: 'Fuel is low. Bring her home to Pinefield and land her gently.',
    reward: 500,
  },
];

export const SCORE = {
  RING: 100,
  DELIVERY: 500,
  LANDING: 150,
  MISSION_BONUS: 200,
  TOUR_BONUS: 400,
};

export const KEYS = {
  PITCH_UP: ['ArrowUp', 'KeyW'],
  PITCH_DOWN: ['ArrowDown', 'KeyS'],
  BANK_LEFT: ['ArrowLeft', 'KeyA'],
  BANK_RIGHT: ['ArrowRight', 'KeyD'],
  THROTTLE_UP: ['ShiftLeft', 'ShiftRight', 'Equal'],
  THROTTLE_DOWN: ['ControlLeft', 'ControlRight', 'Minus'],
  CAMERA: ['KeyC'],
  PAUSE: ['KeyP', 'Escape'],
  RESTART: ['KeyR'],
  CONFIRM: ['Enter', 'Space'],
  MUTE: ['KeyM'],
};

/** Colours for the valley: one dusk-lit alpine palette. */
export const PALETTE = {
  sky: 0x9fc4e8,
  fog: 0xc3d9ec,
  sun: 0xfff2cf,
  terrainLow: 0x5d7d4a,
  terrainHigh: 0x8a7a5c,
  rock: 0x7d7468,
  snow: 0xe8eef2,
  sand: 0xb9a06a,
  water: 0x3f7fb8,
  planeOrange: 0xe86a1c,
  planeCream: 0xf2e6c9,
  planeDark: 0x2b2f36,
  ring: 0xffb020,
  ringDone: 0x46d160,
  runway: 0x3a3d42,
};
