// The screenshot scenes behind ?shot=start|play|land|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot (bank toward the
// next ring, pitch toward its height, throttle up when slow, ease off near the runway), so the
// frame is what a short game really looks like and the same seed always gives the same frame.
import { STEP, TRACK } from './config.js';
import { nextRing } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 2;
/** Stop the land scene this far along the track: the runway is in clear view. */
const LAND_DISTANCE = 7900;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 150;

/** Steer toward the next ring, or toward the runway centreline on final. */
function autopilot(world) {
  const stick = { bank: 0, pitch: 0, throttle: 0 };
  // Hold cruise speed: the stick trims the throttle, it never pulls it back
  // on its own, so without this the throttle ratchets to full and stays
  // there — 210 kt is too fast to turn onto a ring.
  const cruise = world.speed > 150 ? -1 : world.speed < 110 ? 1 : 0;
  if (world.distance >= TRACK.runwayStart - 1200) {
    // Final approach: hold the centreline, descend gently, throttle back.
    // A PD steer: bank against the offset AND against the heading, or the
    // plane weaves across the strip (a bank-only steer overshoots and
    // touches down off the centreline).
    stick.bank = clamp(-world.x / 60 - world.heading / 30, -1, 1);
    const targetAlt = Math.max(0, (TRACK.runwayStart + 200 - world.distance) * 0.12);
    stick.pitch = clamp((targetAlt - world.alt) / 120, -1, 1);
    stick.throttle = world.speed > 130 ? -1 : 0;
    return stick;
  }
  const ring = nextRing(world);
  if (ring) {
    const ahead = ring.d - world.distance;
    stick.bank = clamp((ring.x - world.x) / 90, -1, 1);
    stick.pitch = clamp((ring.alt - world.alt) / 90, -1, 1);
    stick.throttle = ahead < 500 && world.speed < 150 ? 1 : cruise;
  } else {
    stick.bank = clamp(-world.x / 120, -1, 1);
    stick.pitch = clamp((260 - world.alt) / 120, -1, 1);
    stick.throttle = cruise;
  }
  // Never fly into the ground: pull up hard below 60 ft.
  if (world.alt < 60) stick.pitch = 1;
  return stick;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Set `world` to the named scene (start, play, land or end; any other name is start) and return
 * the screen to draw over it, the best score to show, and a centre message for the frame.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'land' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { bank: 0, pitch: 0, throttle: 0 });
    return { screen: SCREEN_TITLE, best: 0, message: '' };
  }
  const limit = name === 'play' ? PLAY_SECONDS : END_LIMIT_SECONDS;
  let message = '';
  for (let i = 0; i < limit / STEP; i += 1) {
    world.step(STEP, autopilot(world));
    const events = world.drainEvents();
    for (const event of events) {
      if (event.type === 'ring') message = `RING +${event.points} — fuel topped up`;
      if (event.type === 'leg' && event.leg === 3) message = 'LEG 3 — FINAL APPROACH: RUNWAY 27';
    }
    if (world.landed || world.crashed) break;
    // The land scene stops on final, runway in view, rather than at a fixed
    // time: at a fixed time the plane is already skimming the ground and the
    // runway has collapsed to a sliver on the horizon.
    if (name === 'land' && world.distance >= LAND_DISTANCE) break;
  }
  if (name === 'land' && !world.landed) {
    // The autopilot missed the landing window: show the approach instead.
    return { screen: SCREEN_PLAY, best: world.score, message: 'LEG 3 — FINAL APPROACH: RUNWAY 27' };
  }
  const over = world.landed || world.crashed;
  // On the over screen the result says it all; drop the approach message so
  // it does not sit above DELIVERED / DOWN IN THE CANYON.
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.score, message: over ? '' : message };
}
