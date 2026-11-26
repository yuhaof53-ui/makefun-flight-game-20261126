// Ridge Runner — input: keyboard and mouse, one mapping for both.
// Keyboard: arrows or WASD to fly, Shift/Ctrl for throttle, C for camera,
// P to pause, R to restart, Enter to start, M to mute. The mouse steers too:
// move it and the plane banks toward where you point; the wheel is throttle.
import { KEYS } from './config.js';
import { clamp } from './random.js';

/** Fresh input state: nothing pressed, mouse centred, throttle idle. */
export function createInput() {
  return {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseActive: false,
    wheel: 0,
    /** Throttle the pilot has set, 0..1. */
    throttle: 0,
    /** Edge-triggered actions consumed by the loop: 'confirm' | 'pause' | 'restart' | 'camera' | 'mute'. */
    queue: [],
  };
}

function matches(list, code) {
  return list.includes(code);
}

/** Wire the listeners onto the window and the canvas. */
export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    if (matches(KEYS.CONFIRM, event.code)) input.queue.push('confirm');
    if (matches(KEYS.PAUSE, event.code)) input.queue.push('pause');
    if (matches(KEYS.RESTART, event.code)) input.queue.push('restart');
    if (matches(KEYS.CAMERA, event.code)) input.queue.push('camera');
    if (matches(KEYS.MUTE, event.code)) input.queue.push('mute');
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    input.mouseActive = true;
  });
  canvas.addEventListener('mouseleave', () => {
    input.mouseActive = false;
  });
  canvas.addEventListener('wheel', (event) => {
    input.wheel = clamp(input.wheel - Math.sign(event.deltaY) * 0.08, -1, 1);
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('click', () => {
    input.queue.push('confirm');
  });
}

function keyDown(input, list) {
  return list.some((code) => input.keys.has(code));
}

/**
 * Read the pilot's command for this frame: { pitch, bank, throttle }.
 * Keyboard wins over the mouse; the wheel nudges the throttle up or down.
 */
export function readCommand(input, dt) {
  let pitch = 0;
  let bank = 0;
  if (keyDown(input, KEYS.PITCH_UP)) pitch += 1;
  if (keyDown(input, KEYS.PITCH_DOWN)) pitch -= 1;
  if (keyDown(input, KEYS.BANK_LEFT)) bank -= 1;
  if (keyDown(input, KEYS.BANK_RIGHT)) bank += 1;
  if (pitch === 0 && bank === 0 && input.mouseActive) {
    bank = clamp(input.mouseX * 1.4, -1, 1);
    pitch = clamp(-input.mouseY * 1.1, -1, 1);
  }
  if (keyDown(input, KEYS.THROTTLE_UP)) input.throttle = clamp(input.throttle + dt * 0.55, 0, 1);
  if (keyDown(input, KEYS.THROTTLE_DOWN)) input.throttle = clamp(input.throttle - dt * 0.55, 0, 1);
  if (input.wheel !== 0) {
    input.throttle = clamp(input.throttle + input.wheel * dt * 1.5, 0, 1);
    input.wheel *= Math.pow(0.02, dt);
    if (Math.abs(input.wheel) < 0.01) input.wheel = 0;
  }
  return { pitch, bank, throttle: input.throttle };
}

/** Take and clear the queued one-shot actions. */
export function drainActions(input) {
  const actions = input.queue;
  input.queue = [];
  return actions;
}
