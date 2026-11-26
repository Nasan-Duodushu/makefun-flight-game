// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and over (landed or crashed).
//
// ?seed=N fixes the ring pattern. ?shot=start|play|land|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_FUEL_EMPTY, EVENT_LANDED, EVENT_LEG, EVENT_RING, EVENT_WALL } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long a centre message stays on screen, in seconds. */
const MESSAGE_SECONDS = 2.6;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

let world = createWorld(createRandom(seed));
let screen = SCREEN_TITLE;
let best = readBest();
let message = '';
let messageUntil = 0;

function showMessage(text) {
  message = text;
  messageUntil = world.time + MESSAGE_SECONDS;
}

function handleEvents() {
  for (const event of world.drainEvents()) {
    if (event.type === EVENT_RING) {
      showMessage(`RING +${event.points} — fuel topped up`);
    } else if (event.type === EVENT_LEG) {
      const names = { 2: 'LEG 2 — CANYON SLALOM', 3: 'LEG 3 — FINAL APPROACH: RUNWAY 27' };
      showMessage(`${names[event.leg] ?? 'LEG ' + event.leg}  +${event.bonus}`);
    } else if (event.type === EVENT_WALL) {
      showMessage('WALL SCRAPE — hull damage');
    } else if (event.type === EVENT_FUEL_EMPTY) {
      showMessage('FUEL EMPTY — gliding, find a ring');
    } else if (event.type === EVENT_LANDED) {
      screen = SCREEN_OVER;
      if (world.score > best) {
        best = world.score;
        saveBest(best);
      }
    } else if (event.type === EVENT_CRASH) {
      screen = SCREEN_OVER;
      if (world.score > best) {
        best = world.score;
        saveBest(best);
      }
    }
  }
}

function restart() {
  world = createWorld(createRandom(seed));
  screen = SCREEN_PLAY;
  message = 'LEG 1 — FLY THE RINGS';
  messageUntil = world.time + MESSAGE_SECONDS;
}

function frame(now) {
  const dt = Math.min(MAX_FRAME, (now - frame.last) / 1000 || 0);
  frame.last = now;
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
  if (actions & ACTION_CONFIRM) {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) restart();
  }
  if (screen === SCREEN_PLAY) {
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(STEP, remaining);
      world.step(step, input.stick());
      remaining -= step;
    }
    handleEvents();
  }
  const shown = world.time < messageUntil ? message : '';
  renderer.draw(world, screen, best, shown);
  status.textContent =
    screen === SCREEN_TITLE
      ? 'Copper Canyon Courier — press Enter to take off'
      : screen === SCREEN_PAUSED
        ? 'Paused'
        : screen === SCREEN_OVER
          ? world.landed
            ? `Delivered — score ${world.score}`
            : `Down in the canyon — score ${world.score}`
          : `Leg ${world.leg}/3 · ${Math.round(world.speed)} kt · ${Math.round(world.alt)} ft · score ${world.score}`;
  requestAnimationFrame(frame);
}
frame.last = 0;

if (shot) {
  // A staged screenshot: play the real rules forward, paint twice, signal ready.
  const staged = stageShot(shot, world);
  screen = staged.screen;
  best = staged.best;
  renderer.draw(world, screen, best, staged.message ?? '');
  renderer.draw(world, screen, best, staged.message ?? '');
  window.__shotReady = true;
} else {
  renderer.draw(world, screen, best, '');
  requestAnimationFrame(frame);
}
