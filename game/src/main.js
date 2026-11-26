// Ridge Runner — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between four screens: title, play, paused and crashed.
// ?shot=start|play|rings|landing (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a shot.
import { createFlightState, stepFlight } from './physics.js';
import { createMissions, checkRings, onLanded, onTakeoff } from './missions.js';
import { createInput, attachInput, readCommand, drainActions } from './input.js';
import { createHud, updateHud, showScreen, showCrash, hideScreens } from './hud.js';
import { createRenderer } from './render.js';
import { createAudio, startAudio, updateAudio, playRing, playThud, playClick, toggleMute } from './audio.js';
import { stageShot } from './shots.js';
import { RUNWAYS } from './config.js';

const STEP = 1 / 60;
/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const flight = createFlightState();
const missions = createMissions();
const input = createInput();
const hud = createHud(document);
const audio = createAudio();
const renderer = createRenderer(canvas);
attachInput(input, canvas);

let screen = 'title';
let view = 'chase';
let elapsed = 0;
let last = performance.now();

/** The debug handle the playtest reads: live state, screen and mission. */
window.__flight = { state: flight, missions, get screen() { return screen; }, get view() { return view; } };

function resetFlight() {
  const fresh = createFlightState();
  Object.assign(flight, fresh);
  Object.assign(missions, createMissions());
  input.throttle = 0;
  screen = 'title';
  showScreen(hud, 'title');
}

function startGame() {
  screen = 'play';
  hideScreens(hud);
  startAudio(audio);
  playClick(audio);
}

function crash(reason) {
  screen = 'crash';
  missions.status = 'failed';
  showCrash(hud, reason, missions.score);
  playThud(audio, true);
}

function stepWorld(dt) {
  const command = readCommand(input, dt);
  const prev = { x: flight.x, y: flight.y, z: flight.z };
  const event = stepFlight(flight, command, dt);
  if (event === 'takeoff') {
    onTakeoff(missions, flight);
    playThud(audio, false);
  }
  if (event === 'landed') {
    const result = onLanded(missions, nearestStrip(), flight);
    if (result === 'delivered' || result === 'tour-done') playRing(audio);
    else playThud(audio, false);
  }
  if (event === 'bounced') playThud(audio, true);
  if (event === 'crashed') crash(flight.crashReason);
  const ringEvent = checkRings(missions, flight, prev);
  if (ringEvent === 'ring' || ringEvent === 'rings-done') playRing(audio);
  updateAudio(audio, flight);
}

function nearestStrip() {
  let best = RUNWAYS[0].id;
  let bestD = Infinity;
  for (const strip of RUNWAYS) {
    const d = Math.hypot(flight.x - strip.x, flight.z - strip.z);
    if (d < bestD) {
      bestD = d;
      best = strip.id;
    }
  }
  return best;
}

function frame(now) {
  const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  for (const action of drainActions(input)) {
    if (action === 'confirm' && screen === 'title') startGame();
    else if (action === 'confirm' && screen === 'crash') resetFlight();
    else if (action === 'pause' && screen === 'play') {
      screen = 'pause';
      showScreen(hud, 'pause');
    } else if (action === 'pause' && screen === 'pause') {
      screen = 'play';
      hideScreens(hud);
    } else if (action === 'restart') resetFlight();
    else if (action === 'camera') {
      view = view === 'chase' ? 'cockpit' : 'chase';
      playClick(audio);
    } else if (action === 'mute') toggleMute(audio);
    startAudio(audio);
  }
  if (screen === 'play') {
    let remaining = frameDt;
    while (remaining > 0) {
      const dt = Math.min(remaining, STEP);
      stepWorld(dt);
      remaining -= dt;
      if (flight.crashed) break;
    }
    elapsed += frameDt;
  }
  if (screen !== 'crash') updateHud(hud, flight, missions);
  renderer.draw(flight, missions, view, frameDt, elapsed);
  requestAnimationFrame(frame);
}

function runShot(name) {
  const staged = stageShot(name, flight, missions);
  screen = staged.screen;
  view = staged.view;
  elapsed = staged.time;
  if (screen === 'title') showScreen(hud, 'title');
  else hideScreens(hud);
  updateHud(hud, flight, missions);
  let painted = 0;
  function paint() {
    renderer.draw(flight, missions, view, 0, elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) {
  runShot(shot);
} else {
  showScreen(hud, 'title');
  window.__gameReady = true;
  requestAnimationFrame(frame);
}
