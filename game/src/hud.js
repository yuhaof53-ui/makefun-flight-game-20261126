// Ridge Runner — the HUD: lit instruments over the 3D view.
// A DOM overlay for the numbers (altitude, speed, heading, throttle, fuel,
// hull), a canvas attitude indicator, a compass strip, mission toasts and the
// title / pause / crash screens. Everything is system fonts and CSS glow:
// the game loads no font, no image and no network request.
import { PLANE } from './config.js';
import { objectiveText } from './missions.js';
import { clamp } from './random.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

/** Build the HUD against the page's DOM. Expects the #hud elements. */
export function createHud(document_) {
  const el = (id) => document_.getElementById(id);
  const attitude = el('attitude');
  const hud = {
    alt: el('hud-alt'), spd: el('hud-spd'), hdg: el('hud-hdg'), vs: el('hud-vs'),
    thrFill: el('hud-thr-fill'), fuelFill: el('hud-fuel-fill'), hullFill: el('hud-hull-fill'),
    fuelText: el('hud-fuel-text'), score: el('hud-score'), objective: el('hud-objective'),
    toast: el('hud-toast'), compass: el('hud-compass'),
    title: el('screen-title'), pause: el('screen-pause'), crash: el('screen-crash'),
    crashReason: el('crash-reason'), crashScore: el('crash-score'),
    attitudeCtx: attitude ? attitude.getContext('2d') : null,
    attitude,
    lowFuelWarned: false,
  };
  return hud;
}

function headingLabel(deg) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(deg / 22.5) % 16];
}

function drawAttitude(hud, state) {
  const ctx = hud.attitudeCtx;
  if (!ctx || !hud.attitude) return;
  const w = hud.attitude.width;
  const h = hud.attitude.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-state.roll);
  ctx.translate(0, state.pitch * 90);
  ctx.fillStyle = '#2f6fb2';
  ctx.fillRect(-60, -60, 120, 60);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-60, 0, 120, 60);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-60, 0);
  ctx.lineTo(60, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffb020';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 4, cy);
  ctx.lineTo(cx, cy - 4);
  ctx.lineTo(cx + 4, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.lineTo(cx + 8, cy + 3);
  ctx.lineTo(cx - 8, cy + 3);
  ctx.closePath();
  ctx.fill();
}

function drawCompass(hud, state) {
  if (!hud.compass) return;
  const deg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
  const marks = [];
  for (let d = -60; d <= 60; d += 15) {
    const at = (Math.round(deg) + d + 360) % 360;
    const label = at % 90 === 0 ? ['N', 'E', 'S', 'W'][Math.round(at / 90) % 4] : String(at);
    marks.push(`<span style="left:${50 + d * 0.55}%">${label}</span>`);
  }
  hud.compass.innerHTML = marks.join('');
}

/** Refresh every readout from the flight state and the missions. */
export function updateHud(hud, state, missions) {
  const deg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
  if (hud.alt) hud.alt.textContent = `${Math.round((state.y - 3.5) * M_TO_FT)} ft`;
  if (hud.spd) hud.spd.textContent = `${Math.round(state.speed * MS_TO_KT)} kt`;
  if (hud.hdg) hud.hdg.textContent = `${String(Math.round(deg)).padStart(3, '0')}° ${headingLabel(deg)}`;
  if (hud.vs) {
    const vs = Math.round(state.verticalSpeed * M_TO_FT * 60);
    hud.vs.textContent = `${vs >= 0 ? '+' : ''}${vs} fpm`;
  }
  if (hud.thrFill) hud.thrFill.style.width = `${Math.round(state.throttle * 100)}%`;
  if (hud.fuelFill) {
    hud.fuelFill.style.width = `${Math.round((state.fuel / PLANE.FUEL_MAX) * 100)}%`;
    hud.fuelFill.classList.toggle('low', state.fuel < 25);
  }
  if (hud.fuelText) hud.fuelText.textContent = `${Math.round(state.fuel)}%`;
  if (hud.hullFill) {
    hud.hullFill.style.width = `${Math.round((state.hull / PLANE.HULL_MAX) * 100)}%`;
    hud.hullFill.classList.toggle('low', state.hull < 35);
  }
  if (hud.score) hud.score.textContent = String(missions.score);
  if (hud.objective) hud.objective.textContent = objectiveText(missions);
  const showToast = missions.banner && state.time < missions.bannerUntil;
  if (hud.toast) {
    hud.toast.textContent = showToast ? missions.banner : '';
    hud.toast.classList.toggle('show', Boolean(showToast));
  }
  if (hud.fuelText && state.fuel < 20 && state.airborne) {
    hud.fuelText.textContent = `LOW ${Math.round(state.fuel)}%`;
  }
  drawAttitude(hud, state);
  drawCompass(hud, state);
}

/** Show one screen overlay and hide the others. */
export function showScreen(hud, name) {
  const screens = { title: hud.title, pause: hud.pause, crash: hud.crash };
  for (const [key, el] of Object.entries(screens)) {
    if (el) el.classList.toggle('hidden', key !== name);
  }
}

/** Fill the crash screen with the reason and the final score. */
export function showCrash(hud, reason, score) {
  const reasons = {
    terrain: 'You hit the mountains. The valley keeps what it catches.',
    lake: 'You ditched in the lake. The water is cold and the parcel is wet.',
    'hard-landing': 'The landing broke her back. Next time, come in gentler.',
  };
  if (hud.crashReason) hud.crashReason.textContent = reasons[reason] ?? 'The flight ended badly.';
  if (hud.crashScore) hud.crashScore.textContent = `Score ${score}`;
  showScreen(hud, 'crash');
}

export function hideScreens(hud) {
  showScreen(hud, '');
}
