// The flight: one track in three legs, rings to fly through, canyon walls to
// respect, fuel to mind, and a dirt airstrip to land on. Everything is pure
// numbers here — no drawing — so the unit tests can drive it headless.
//
// Units: distance in metres along the track, lateral offset in metres from the
// centreline, altitude in feet, speed in knots, heading in degrees.

import { PLANE, RING, TRACK } from './config.js';

export const EVENT_RING = 'ring';
export const EVENT_LEG = 'leg';
export const EVENT_WALL = 'wall';
export const EVENT_CRASH = 'crash';
export const EVENT_LANDED = 'landed';
export const EVENT_FUEL_EMPTY = 'fuel-empty';

/** Metres the plane covers per knot per second (1 knot = 0.51444 m/s). */
const KT_TO_MS = 0.51444;
/** Feet per metre, for the altitude the HUD shows. */
const FT_PER_M = 3.28084;

/** Half-width of the flyable canyon, in metres, along the track. */
export function canyonHalfWidth(distance) {
  if (distance < TRACK.leg1End) return 260; // open mesa
  if (distance < TRACK.leg2End) {
    // the canyon narrows as the slalom tightens, then opens for the approach
    const t = (distance - TRACK.leg1End) / (TRACK.leg2End - TRACK.leg1End);
    return 260 - 150 * Math.sin((t * Math.PI) / 2);
  }
  return 260;
}

/** Which leg the plane is flying, 1–3. */
export function legAt(distance) {
  if (distance < TRACK.leg1End) return 1;
  if (distance < TRACK.leg2End) return 2;
  return 3;
}

export function createWorld(random) {
  // Rings: seeded along the first two legs, alternating sides and heights so
  // the pilot has to work the stick, never a straight line of free points.
  const rings = [];
  for (let i = 0; i < RING.count; i++) {
    const d = 350 + (i * (TRACK.leg2End - 500)) / RING.count;
    const side = i % 2 === 0 ? -1 : 1;
    rings.push({
      d,
      x: side * (40 + random() * 110),
      alt: 180 + random() * 220, // feet
      passed: false,
      scored: false,
    });
  }

  // Ridge profiles for the renderer: three parallax layers of seeded peaks.
  const ridges = [0, 1, 2].map((layer) => {
    const peaks = [];
    for (let i = 0; i <= 24; i++) {
      peaks.push(0.35 + random() * (0.65 - layer * 0.16));
    }
    return peaks;
  });

  const world = {
    time: 0,
    distance: 0,
    x: 0, // lateral offset from the centreline, metres
    alt: 320, // feet
    speed: PLANE.cruiseSpeed, // knots
    heading: 0, // degrees off the route heading
    bank: 0, // degrees of bank, -60..60
    pitch: 0, // degrees of pitch, -12..12
    throttle: 0.62,
    fuel: 100,
    damage: 0,
    score: 0,
    ringsHit: 0,
    leg: 1,
    verticalSpeed: 0, // feet per second, signed
    landed: false,
    crashed: false,
    endReason: null,
    fuelWarned: false,
    events: [],
    rings,
    ridges,
  };

  function emit(type, data) {
    world.events.push({ type, ...data, at: world.time });
  }

  /** Advance the flight by dt seconds. `stick` is {bank:-1..1, pitch:-1..1, throttle:-1..1}. */
  function step(dt, stick) {
    if (world.landed || world.crashed) return;
    world.time += dt;

    // Throttle: the stick trims it, the tank decides whether it answers.
    world.throttle = clamp(world.throttle + stick.throttle * dt * 0.55, 0, 1);
    if (world.fuel <= 0 && world.throttle > 0) {
      world.throttle = 0;
      if (!world.fuelWarned) {
        world.fuelWarned = true;
        emit(EVENT_FUEL_EMPTY, {});
      }
    }
    world.fuel = Math.max(0, world.fuel - PLANE.fuelDrain * world.throttle * dt);

    // Speed: throttle pushes, drag pulls, and a steep bank costs speed.
    const target = PLANE.minSpeed + world.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    world.speed += clamp(target - world.speed, -PLANE.drag * dt * 2, PLANE.accel * dt);
    world.speed -= Math.abs(world.bank) * 0.02 * dt;
    world.speed = Math.max(PLANE.minSpeed * 0.55, world.speed);

    // Bank, heading and lateral drift: the turn follows the bank.
    const bankTarget = stick.bank * 55;
    world.bank += clamp(bankTarget - world.bank, -PLANE.bankRate * dt, PLANE.bankRate * dt);
    world.heading += (world.bank / 55) * PLANE.turnRate * dt;
    world.heading = clamp(world.heading, -38, 38);
    world.x += Math.sin((world.heading * Math.PI) / 180) * world.speed * KT_TO_MS * dt;
    // The route pulls the plane gently back to the centreline when wings level.
    world.x -= world.x * 0.02 * dt;

    // Pitch and altitude: climb costs speed, a stall sinks the plane.
    const pitchTarget = stick.pitch * 11;
    world.pitch += clamp(pitchTarget - world.pitch, -30 * dt, 30 * dt);
    world.verticalSpeed = world.pitch * 14 - (world.speed < PLANE.minSpeed ? 22 : 0);
    world.alt += world.verticalSpeed * dt;
    world.alt = Math.max(0, Math.min(900, world.alt));
    // Touchdown: a gentle descent is a proportional chase of the ground, so
    // the altitude asymptotes toward zero without ever crossing it — the
    // plane would skim at a fraction of a foot forever, never landing and
    // never crashing. Inches up and still sinking is contact: call it zero
    // and let the ground check below decide landing or crash.
    if (world.alt < 0.5 && world.verticalSpeed < 0) world.alt = 0;

    // Forward motion along the track.
    world.distance += world.speed * KT_TO_MS * dt;

    // Legs.
    const leg = legAt(world.distance);
    if (leg !== world.leg) {
      world.leg = leg;
      world.score += RING.legComplete;
      emit(EVENT_LEG, { leg, bonus: RING.legComplete });
    }

    // Rings: crossing a ring's distance scores it if the plane is inside it.
    for (const ring of rings) {
      if (ring.passed || world.distance < ring.d) continue;
      ring.passed = true;
      const dx = world.x - ring.x;
      const dz = (world.alt - ring.alt) * 0.3048; // feet to metres
      if (Math.hypot(dx, dz) <= RING.radius) {
        ring.scored = true;
        world.ringsHit += 1;
        world.score += RING.points;
        world.fuel = Math.min(100, world.fuel + PLANE.fuelRing);
        emit(EVENT_RING, { points: RING.points, total: world.ringsHit });
      }
    }

    // Canyon walls: scraping one costs damage and bounces the plane back in.
    const half = canyonHalfWidth(world.distance);
    if (Math.abs(world.x) > half) {
      world.x = Math.sign(world.x) * half;
      world.heading = -world.heading * 0.4;
      world.bank = -world.bank * 0.3;
      world.damage = Math.min(100, world.damage + PLANE.wallDamage);
      emit(EVENT_WALL, { damage: world.damage });
    }
    if (world.damage >= 100) {
      world.crashed = true;
      world.endReason = 'airframe';
      emit(EVENT_CRASH, { reason: 'airframe' });
      return;
    }

    // The ground: only a runway landing in leg 3 is survivable.
    if (world.alt <= 0) {
      const onRunway =
        world.leg === 3 &&
        world.distance >= TRACK.runwayStart &&
        world.distance <= TRACK.runwayStart + TRACK.runwayLength &&
        Math.abs(world.x) <= 22 &&
        Math.abs(world.verticalSpeed) <= 9 &&
        world.speed <= 150;
      if (onRunway) {
        world.landed = true;
        const softness = 1 - Math.abs(world.verticalSpeed) / 9;
        const centre = 1 - Math.abs(world.x) / 22;
        const bonus = Math.round(RING.landingMax * (0.4 + 0.6 * softness * centre));
        world.score += bonus;
        emit(EVENT_LANDED, { bonus, softness, centre });
      } else {
        world.crashed = true;
        world.endReason = 'ground';
        emit(EVENT_CRASH, { reason: 'ground' });
      }
      return;
    }

    // Running out of track without landing is a missed approach, not a crash.
    if (world.distance >= TRACK.leg3End + TRACK.runwayLength) {
      world.crashed = true;
      world.endReason = 'overshoot';
      emit(EVENT_CRASH, { reason: 'overshoot' });
    }
  }

  function drainEvents() {
    const out = world.events;
    world.events = [];
    return out;
  }

  // The returned object IS the live state: step() mutates it in place, so the
  // renderer and the loop always read fresh numbers (a spread copy would go stale).
  world.step = step;
  world.drainEvents = drainEvents;
  world.legAt = legAt;
  world.canyonHalfWidth = canyonHalfWidth;
  return world;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Distance to the next unscored ring, in metres, or null when none is ahead. */
export function nextRing(world) {
  for (const ring of world.rings) {
    if (!ring.passed && ring.d > world.distance) return ring;
  }
  return null;
}
