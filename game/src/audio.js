// Ridge Runner — sound: everything is synthesised in WebAudio.
// An engine hum that follows the throttle, wind that follows the speed, a
// chime when a ring is flown and a thud on landing. No audio files, no fetch.
// The context is created on the first key press, so autoplay rules are happy.
export function createAudio() {
  return {
    ctx: null, master: null, engineOsc: null, engineOsc2: null,
    engineGain: null, windSrc: null, windGain: null, windFilter: null,
    muted: false,
  };
}

function ensureContext(audio) {
  if (audio.ctx) return true;
  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.ctx.destination);

    // Engine: two detuned saws through a low-pass, pitch follows throttle.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineOsc2 = audio.ctx.createOscillator();
    audio.engineOsc2.type = 'sawtooth';
    audio.engineOsc2.frequency.value = 55 * 1.5;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    audio.engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();

    // Wind: looped noise through a band-pass, louder and higher with speed.
    const length = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    audio.windSrc = audio.ctx.createBufferSource();
    audio.windSrc.buffer = buffer;
    audio.windSrc.loop = true;
    audio.windFilter = audio.ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 500;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSrc.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSrc.start();
    return true;
  } catch {
    return false;
  }
}

/** Start the audio graph. Safe to call on every key press. */
export function startAudio(audio) {
  if (!ensureContext(audio)) return;
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
}

/** Follow the flight state: engine pitch with throttle, wind with speed. */
export function updateAudio(audio, state) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  const throttle = state.airborne ? state.throttle : state.throttle * 0.7;
  audio.engineOsc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime((52 + throttle * 68) * 1.5, t, 0.1);
  audio.engineGain.gain.setTargetAtTime(state.throttle > 0.02 ? 0.05 + throttle * 0.075 : 0, t, 0.15);
  const wind = Math.min(1, state.speed / 78);
  audio.windGain.gain.setTargetAtTime(state.airborne ? wind * 0.12 : 0, t, 0.2);
  audio.windFilter.frequency.setTargetAtTime(380 + wind * 900, t, 0.2);
}

function blip(audio, freq, dur, type, gain, when = 0) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A bright two-note chime when a ring is flown. */
export function playRing(audio) {
  blip(audio, 880, 0.35, 'sine', 0.22);
  blip(audio, 1318, 0.5, 'sine', 0.18, 0.09);
}

/** A low thud for a touchdown, and a softer one for a bounce. */
export function playThud(audio, hard = false) {
  blip(audio, hard ? 55 : 75, hard ? 0.4 : 0.25, 'sine', hard ? 0.5 : 0.3);
}

/** A short click for menus and the camera switch. */
export function playClick(audio) {
  blip(audio, 660, 0.08, 'square', 0.06);
}

/** Toggle mute; returns the new muted state. */
export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}
