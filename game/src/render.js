// Paints the flight: a dusk chase view over the canyon, the plane in frame,
// the next ring or the runway ahead, and a lit instrument panel. Everything is
// drawn from the world state, so the screenshots are the game itself.

import { FIELD, PALETTE, FONT, TRACK, RING } from './config.js';
import { canyonHalfWidth, legAt, nextRing } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const W = FIELD.width;
const H = FIELD.height;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  // Size the backing store to the element on screen (times the device pixel
  // ratio, so text stays crisp on retina displays), and keep it sized on
  // resize. Without this the canvas stays at its 300x150 default and the
  // browser stretches a tiny, blurry frame over the whole window.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }
  resize();
  window.addEventListener('resize', resize);

  function fit() {
    const scale = Math.min(canvas.width / W, canvas.height / H);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - W * scale) / 2, (canvas.height - H * scale) / 2);
  }

  /** Where a point ahead of the plane lands on screen. `ahead` in metres. */
  function project(world, ahead, lateral, altFt) {
    const horizon = FIELD.horizonY - world.pitch * 4;
    const depth = Math.max(60, ahead);
    const scale = 900 / depth;
    const x = W / 2 + (lateral - world.x * 0.7) * scale * 0.9 - world.heading * 6;
    // Vertical exaggeration: a real low approach puts the runway almost on
    // the horizon, a sliver no screenshot can read, so the world is drawn
    // with twice the true vertical scale and the strip stays visible.
    const y = horizon + (world.alt - altFt) * scale * 0.3;
    return { x, y, scale };
  }

  function drawSky(world) {
    const horizon = FIELD.horizonY - world.pitch * 4;
    const g = ctx.createLinearGradient(0, 0, 0, horizon + 40);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon + 40);
    // Low sun, drifting with the heading so turning moves it.
    const sunX = W * 0.68 - world.heading * 7;
    const sunY = horizon - 26;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(247,165,92,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Thin cloud bands, parallaxed by distance travelled.
    ctx.fillStyle = 'rgba(242,220,200,0.20)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 317 + world.distance * 0.02) % (W + 260)) - 130;
      const cy = 70 + i * 38 - world.pitch * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 120, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRidges(world) {
    const horizon = FIELD.horizonY - world.pitch * 4;
    const layers = [
      { peaks: world.ridges[0], color: PALETTE.ridgeFar, base: 46, amp: 60 },
      { peaks: world.ridges[1], color: PALETTE.ridgeMid, base: 34, amp: 84 },
      { peaks: world.ridges[2], color: PALETTE.ridgeNear, base: 20, amp: 110 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, horizon + layer.base);
      const n = layer.peaks.length;
      for (let i = 0; i <= 24; i++) {
        const px = (i / 24) * W;
        const peak = layer.peaks[(i + Math.floor(world.distance / 240)) % n];
        const py = horizon + layer.base - peak * layer.amp * (0.7 + 0.3 * Math.sin(i * 1.7));
        ctx.lineTo(px, py);
      }
      ctx.lineTo(W, horizon + layer.base);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGround(world) {
    const horizon = FIELD.horizonY - world.pitch * 4;
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, PALETTE.groundFar);
    g.addColorStop(1, PALETTE.groundNear);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, W, H - horizon);
    // Canyon walls: two shaded masses closing in as the canyon narrows.
    const half = canyonHalfWidth(world.distance);
    const wallIn = 300 - half; // how far the walls intrude on screen
    const vpX = W / 2 - world.heading * 6;
    ctx.fillStyle = PALETTE.canyonWall;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(vpX - 90 - wallIn * 0.4, horizon + 26);
    ctx.lineTo(vpX - 150 - wallIn, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, horizon);
    ctx.lineTo(vpX + 90 + wallIn * 0.4, horizon + 26);
    ctx.lineTo(vpX + 150 + wallIn, H);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // Wall shading on the inner faces.
    ctx.fillStyle = PALETTE.canyonShade;
    ctx.beginPath();
    ctx.moveTo(vpX - 90 - wallIn * 0.4, horizon + 26);
    ctx.lineTo(vpX - 150 - wallIn, H);
    ctx.lineTo(vpX - 110 - wallIn, H);
    ctx.lineTo(vpX - 70 - wallIn * 0.4, horizon + 26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(vpX + 90 + wallIn * 0.4, horizon + 26);
    ctx.lineTo(vpX + 150 + wallIn, H);
    ctx.lineTo(vpX + 110 + wallIn, H);
    ctx.lineTo(vpX + 70 + wallIn * 0.4, horizon + 26);
    ctx.closePath();
    ctx.fill();
    // Ground texture: perspective lines racing toward the vanishing point.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(vpX + i * 26, horizon + 30);
      ctx.lineTo(vpX + i * 190, H);
      ctx.stroke();
    }
    // The river: a copper ribbon winding down the canyon floor.
    ctx.strokeStyle = 'rgba(120,180,220,0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(vpX - 40, horizon + 60);
    ctx.bezierCurveTo(vpX - 120, horizon + 150, vpX + 90, horizon + 220, vpX - 30, H);
    ctx.stroke();
  }

  function drawRunway(world) {
    const toThreshold = TRACK.runwayStart - world.distance;
    if (toThreshold > 2600 || world.distance > TRACK.runwayStart + TRACK.runwayLength) return;
    const near = project(world, Math.max(120, toThreshold + TRACK.runwayLength), 0, 0);
    const far = project(world, Math.max(120, toThreshold), 0, 0);
    const nearW = 1500 / Math.max(120, toThreshold + TRACK.runwayLength) * 60;
    const farW = 1500 / Math.max(120, toThreshold) * 60;
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(far.x - farW, far.y);
    ctx.lineTo(far.x + farW, far.y);
    ctx.lineTo(near.x + nearW, near.y);
    ctx.lineTo(near.x - nearW, near.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes and threshold bars.
    // far.y is the threshold edge (lower on screen), near.y the far end.
    const trapH = far.y - near.y;
    ctx.fillStyle = PALETTE.runwayLine;
    const numberY = far.y - trapH * 0.45;
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const y = far.y + (near.y - far.y) * t;
      // Leave the band where the runway number sits clear of dashes.
      if (Math.abs(y - numberY) < 16) continue;
      const w = farW + (nearW - farW) * t;
      ctx.fillRect(far.x + (near.x - far.x) * t - w * 0.08, y, w * 0.16, 7);
    }
    // Runway number, painted on the strip itself (centred on the trapezoid
    // and sized to it), so it never floats detached below a thin strip.
    if (toThreshold < 900 && trapH > 16) {
      ctx.font = `bold ${Math.round(Math.min(64, Math.max(14, trapH * 0.6)))}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(20,20,28,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText('27', (far.x + near.x) / 2, numberY);
      ctx.fillStyle = PALETTE.runwayLine;
      ctx.fillText('27', (far.x + near.x) / 2, numberY);
    }
  }

  function drawRings(world) {
    for (const ring of world.rings) {
      if (ring.passed) continue;
      const ahead = ring.d - world.distance;
      if (ahead < 40 || ahead > 2400) continue;
      const p = project(world, ahead, ring.x, ring.alt);
      // The ring's screen radius uses the same projection scale as its
      // centre, so a ring you can fly through looks fly-throughable — but
      // cap it, so a ring a few metres ahead does not swallow the frame,
      // and fade it out as you pass through it.
      const r = Math.min(200, (RING.radius * 900) / Math.max(60, ahead) * 0.9);
      if (r < 3) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, 2400 / ahead) * (ahead < 120 ? ahead / 120 : 1);
      ctx.strokeStyle = PALETTE.ringGlow;
      ctx.lineWidth = Math.max(2, r * 0.22);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.ring;
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 0.86, r * 0.79, 0, 0, Math.PI * 2);
      ctx.stroke();
      // The next ring gets a chevron pointing at it.
      if (ring === nextRing(world)) {
        ctx.fillStyle = PALETTE.ring;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r - 18);
        ctx.lineTo(p.x - 10, p.y - r - 34);
        ctx.lineTo(p.x + 10, p.y - r - 34);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPlane(world) {
    const px = W / 2 + world.x * 0.12 - world.heading * 1.4;
    const py = H - 178 - world.pitch * 2.2;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((world.bank * Math.PI) / 180 / 2.4);
    // Prop blur.
    ctx.fillStyle = PALETTE.prop;
    ctx.beginPath();
    ctx.ellipse(0, -46, 34, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-118, -6);
    ctx.lineTo(-30, -26);
    ctx.lineTo(30, -26);
    ctx.lineTo(118, -6);
    ctx.lineTo(104, 8);
    ctx.lineTo(-104, 8);
    ctx.closePath();
    ctx.fill();
    // Tailplane and fin.
    ctx.fillStyle = PALETTE.planeDark;
    ctx.beginPath();
    ctx.moveTo(-52, 44);
    ctx.lineTo(-14, 26);
    ctx.lineTo(14, 26);
    ctx.lineTo(52, 44);
    ctx.lineTo(40, 52);
    ctx.lineTo(-40, 52);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(-10, 52);
    ctx.lineTo(10, 52);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    const body = ctx.createLinearGradient(-16, 0, 16, 0);
    body.addColorStop(0, PALETTE.planeDark);
    body.addColorStop(0.5, PALETTE.planeBody);
    body.addColorStop(1, PALETTE.planeDark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.quadraticCurveTo(18, -30, 15, 10);
    ctx.quadraticCurveTo(12, 44, 0, 56);
    ctx.quadraticCurveTo(-12, 44, -15, 10);
    ctx.quadraticCurveTo(-18, -30, 0, -58);
    ctx.fill();
    // Canopy glass.
    ctx.fillStyle = 'rgba(140,220,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -26, 9, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights: red port, green starboard, both lit.
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-116, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#59e389';
    ctx.beginPath();
    ctx.arc(116, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(world, screen, message) {
    // Top tape: airspeed, altitude, heading, fuel, damage, score.
    ctx.fillStyle = 'rgba(16,19,32,0.82)';
    ctx.fillRect(0, 0, W, 44);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, 44, W, 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`IAS ${Math.round(world.speed)} kt`, 18, 23);
    ctx.fillText(`ALT ${Math.round(world.alt)} ft`, 218, 23);
    const hdg = ((Math.round(world.heading) % 360) + 360) % 360;
    ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 418, 23);
    ctx.fillText(`LEG ${world.leg}/3`, 590, 23);
    ctx.fillText(`RINGS ${world.ringsHit}/${RING.count}`, 700, 23);
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE ${world.score}`, W - 18, 23);
    // Fuel and damage bars under the tape.
    bar(18, 54, 220, 10, world.fuel / 100, world.fuel < 25 ? PALETTE.gaugeRed : PALETTE.gaugeAmber, 'FUEL');
    bar(W - 238, 54, 220, 10, 1 - world.damage / 100, world.damage > 60 ? PALETTE.gaugeRed : PALETTE.gaugeLit, 'HULL');
    // Centre message.
    if (message) {
      ctx.textAlign = 'center';
      ctx.font = `bold 30px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(message, W / 2, 120);
      ctx.shadowBlur = 0;
    }
    // Warnings.
    let warnY = 150;
    ctx.font = `bold 20px ${FONT}`;
    if (world.fuel < 25 && screen === SCREEN_PLAY) {
      ctx.fillStyle = world.time % 1 < 0.5 ? PALETTE.gaugeRed : PALETTE.gaugeAmber;
      ctx.fillText('LOW FUEL — FLY THROUGH A RING', W / 2, warnY);
      warnY += 28;
    }
    if (world.damage > 60 && screen === SCREEN_PLAY) {
      ctx.fillStyle = PALETTE.gaugeRed;
      ctx.fillText('HULL CRITICAL', W / 2, warnY);
    }
  }

  function bar(x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + h + 10);
  }

  function drawInstruments(world) {
    // Lit instrument cluster along the bottom. The gauges sit high enough
    // that their labels still land inside the panel, not past its edge.
    const cy = H - 62;
    ctx.fillStyle = 'rgba(16,19,32,0.88)';
    ctx.fillRect(0, H - 108, W, 108);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, H - 108, W, 2);
    gauge(W / 2 - 190, cy, 44, 'ATT', (g) => {
      // Artificial horizon: sky/ground ball rolled with the bank.
      g.save();
      g.beginPath();
      g.arc(0, 0, 38, 0, Math.PI * 2);
      g.clip();
      g.rotate((-world.bank * Math.PI) / 180);
      g.translate(0, world.pitch * 2);
      g.fillStyle = '#3f6db3';
      g.fillRect(-40, -40, 80, 40);
      g.fillStyle = '#7a5230';
      g.fillRect(-40, 0, 80, 40);
      g.fillStyle = '#f2ead8';
      g.fillRect(-40, -1, 80, 2);
      g.restore();
      g.strokeStyle = PALETTE.gaugeLit;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-16, 0);
      g.lineTo(16, 0);
      g.stroke();
    });
    gauge(W / 2, cy, 44, 'ALT', (g) => {
      needle(g, world.alt / 900);
      g.fillStyle = PALETTE.gaugeLit;
      g.font = `bold 15px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(String(Math.round(world.alt)), 0, 22);
    });
    gauge(W / 2 + 190, cy, 44, 'IAS', (g) => {
      needle(g, (world.speed - 40) / 190);
      g.fillStyle = PALETTE.gaugeLit;
      g.font = `bold 15px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(String(Math.round(world.speed)), 0, 22);
    });
    // Throttle lever on the right.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('THR', W - 150, cy - 34);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W - 150, cy - 26, 14, 64);
    ctx.fillStyle = PALETTE.gaugeAmber;
    ctx.fillRect(W - 150, cy + 38 - world.throttle * 64, 14, world.throttle * 64);
  }

  function gauge(cx, cy, r, label, drawFace) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = PALETTE.gaugeFace;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawFace(ctx);
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r + 14);
  }

  function needle(g, frac) {
    const a = -Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
    g.strokeStyle = PALETTE.gaugeLit;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
    g.stroke();
    g.fillStyle = PALETTE.text;
    g.beginPath();
    g.arc(0, 0, 4, 0, Math.PI * 2);
    g.fill();
  }

  function drawTitle(world, best) {
    // A heavier dim than the play scene: the title text has to read over
    // bright rings and sun glow, not just over the sky.
    ctx.fillStyle = 'rgba(10,12,24,0.68)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 10;
    ctx.font = `bold 58px ${FONT}`;
    ctx.fillText('COPPER CANYON COURIER', W / 2, 190);
    ctx.font = `24px ${FONT}`;
    ctx.fillStyle = PALETTE.sunCore;
    ctx.fillText('A bush-pilot mail run at dusk — rings, canyon, runway.', W / 2, 232);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('← → bank and turn · ↑ ↓ pitch · W / S throttle · P pause', W / 2, 300);
    ctx.fillText('Fly the rings for fuel and points. Land soft on runway 27.', W / 2, 332);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('Press Enter to take off', W / 2, 400);
    ctx.shadowBlur = 0;
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `18px ${FONT}`;
      ctx.fillText(`Best delivery: ${best} points`, W / 2, 440);
    }
  }

  function drawOver(world, best) {
    ctx.fillStyle = 'rgba(10,12,24,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 52px ${FONT}`;
    const title = world.landed ? 'DELIVERED' : 'DOWN IN THE CANYON';
    ctx.fillText(title, W / 2, 240);
    ctx.font = `24px ${FONT}`;
    const reason = world.landed
      ? `Mail delivered — soft landing, ${world.ringsHit} rings flown.`
      : world.endReason === 'ground'
        ? 'The canyon floor is not a runway.'
        : world.endReason === 'airframe'
          ? 'The airframe gave up after too many wall scrapes.'
          : 'You flew past the airstrip — the mail goes back.';
    ctx.fillStyle = PALETTE.sunCore;
    ctx.fillText(reason, W / 2, 288);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(`Score ${world.score}   ·   Best ${Math.max(best, world.score)}`, W / 2, 350);
    ctx.font = `20px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press Enter to fly again', W / 2, 410);
  }

  function draw(world, screen, best, message) {
    fit();
    ctx.clearRect(0, 0, W, H);
    drawSky(world);
    drawRidges(world);
    drawGround(world);
    drawRunway(world);
    drawRings(world);
    drawPlane(world);
    drawHud(world, screen, message);
    drawInstruments(world);
    if (screen === SCREEN_TITLE) drawTitle(world, best);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(10,12,24,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED — press P to fly on', W / 2, H / 2);
    }
    if (screen === SCREEN_OVER) drawOver(world, best);
  }

  return { draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER };
}
