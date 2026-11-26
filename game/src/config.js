// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, horizonY: 330 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The plane: speeds in knots, altitudes in feet, distances in metres. */
export const PLANE = {
  minSpeed: 55, // below this the wings stop flying
  cruiseSpeed: 120,
  maxSpeed: 210,
  climbRate: 9, // ft per second at full climb
  sinkRate: 12, // ft per second at full descent
  bankRate: 95, // degrees of bank per second at full stick
  turnRate: 26, // degrees of heading per second at full bank
  accel: 26, // knots per second at full throttle
  drag: 9, // knots per second of drag at cruise
  fuelDrain: 0.85, // percent of tank per second at full throttle
  fuelRing: 6, // percent of tank a ring gives back
  wallDamage: 14, // damage per wall scrape (plus a bounce)
  groundDamage: 100, // hitting the ground outside the runway ends the flight
};

/** The route: three legs along one track, in metres. */
export const TRACK = {
  leg1End: 3000, // ring run over the mesa
  leg2End: 6500, // canyon slalom
  leg3End: 9000, // final approach and the dirt airstrip
  runwayStart: 8200, // the runway threshold along the track
  runwayLength: 700,
};

export const RING = {
  count: 14,
  radius: 42, // metres: lateral + vertical miss allowed
  points: 100,
  legComplete: 250,
  landingMax: 500, // soft-landing bonus, scaled by vertical speed and centreline
};

export const PALETTE = {
  skyTop: '#232c52',
  skyMid: '#5a4a7a',
  horizon: '#e8845a',
  sunCore: '#ffd98a',
  sunGlow: '#f7a55c',
  ridgeFar: '#6b5578',
  ridgeMid: '#54405f',
  ridgeNear: '#3d2c46',
  groundFar: '#8a5a3c',
  groundNear: '#5e3a28',
  canyonWall: '#7a4632',
  canyonShade: '#4a2a20',
  runway: '#3a3a40',
  runwayLine: '#f2e6c8',
  ring: '#ffd94d',
  ringGlow: '#ff9d2e',
  planeBody: '#e8b04b',
  planeWing: '#c98f2e',
  planeDark: '#7a5a22',
  prop: 'rgba(240,240,240,0.35)',
  panel: '#1c2030',
  panelEdge: '#3a415c',
  gaugeFace: '#10131f',
  gaugeLit: '#8ef0c0',
  gaugeAmber: '#ffb347',
  gaugeRed: '#ff5a4e',
  text: '#f2ead8',
  muted: '#b8a98f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'copper-canyon-courier.best';
