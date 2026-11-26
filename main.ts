// Copper Canyon Courier — handover program (Node 22, standard library only).
//
// It hands the entry in: game/ and screenshots/ are copied from beside this
// file into /output, and /output/dossier.json is written with the kit's
// vendored buildDossier, exactly as the bounty asks. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deliberately boring: validate the inputs against the gate's
// caps first (so a bad screenshot fails here, loudly, instead of handing
// over an entry the scorer would refuse), copy, write the dossier, then
// read the dossier back and confirm it names the screenshots it carries.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, from the kit's gate (reference/gate.json): the dossier
// text is capped at 160 KiB, at most 4 screenshots of at most 256 KiB each,
// game/ at most 993 files and 48 MiB, and dossier.json at most 1.5 MiB.
const CAPS = {
  textMaxBytes: 163840,
  screenshotsMax: 4,
  screenshotMaxBytes: 262144,
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
  dossierMaxBytes: 1572864,
};

/** Fail with a plain message naming what is wrong and what to do about it. */
function refuse(why: string): never {
  throw new Error(`handover refused: ${why}`);
}

/** Count every file and directory under a folder, recursively, and total the files' bytes. */
function survey(dir: string): { entries: number; bytes: number } {
  let entries = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    entries += 1;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = survey(path);
      entries += sub.entries;
      bytes += sub.bytes;
    } else {
      bytes += statSync(path).size;
    }
  }
  return { entries, bytes };
}

/** Check game/ and screenshots/ against the caps before anything is copied. */
function checkInputs(): { shots: string[]; gameSurvey: { entries: number; bytes: number } } {
  const gameDir = join(here, 'game');
  if (!existsSync(join(gameDir, 'index.html'))) {
    refuse('game/index.html is missing — the game has no entry point');
  }
  const gameSurvey = survey(gameDir);
  if (gameSurvey.entries > CAPS.gameMaxFiles) {
    refuse(`game/ holds more than ${CAPS.gameMaxFiles} files and directories`);
  }
  if (gameSurvey.bytes > CAPS.gameMaxBytes) {
    refuse(`game/ is ${gameSurvey.bytes} bytes, over the 48 MiB gate cap`);
  }

  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) refuse('screenshots/ is missing — the gate needs 3–4 shots');
  const shots = readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > CAPS.screenshotsMax) {
    refuse(`expected 3–4 screenshots, found ${shots.length} — add or remove shots first`);
  }
  for (const name of shots) {
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-')) {
      refuse(`screenshot name ${JSON.stringify(name)} is not allowed by the gate`);
    }
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshotMaxBytes) {
      refuse(`screenshot ${name} is ${size} bytes, over the 256 KiB gate cap — recompress it`);
    }
    if (!/\.(png|jpe?g)$/i.test(name)) {
      refuse(`screenshot ${name} is not a PNG or JPEG`);
    }
  }
  return { shots, gameSurvey };
}

function handOver(): void {
  const { shots, gameSurvey } = checkInputs();

  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

  // A partial copy must not hand over silently: the output game/ has to
  // hold exactly what the input survey counted.
  const copied = survey(join(out, 'game'));
  if (copied.entries !== gameSurvey.entries || copied.bytes !== gameSurvey.bytes) {
    refuse(`copied game/ (${copied.entries} entries, ${copied.bytes} bytes) does not match the source (${gameSurvey.entries} entries, ${gameSurvey.bytes} bytes)`);
  }

  const dossierPath = join(out, 'dossier.json');
  writeFileSync(
    dossierPath,
    buildDossier(out, {
      text_max_bytes: CAPS.textMaxBytes,
      screenshots: { max: CAPS.screenshotsMax, max_bytes: CAPS.screenshotMaxBytes },
      game_max_files: CAPS.gameMaxFiles,
      game_max_bytes: CAPS.gameMaxBytes,
      game_path_max_bytes: 1000,
    }),
  );

  // Read the dossier back: it must parse, stay under its own cap, and name
  // every screenshot that was handed over, so a silent write failure or a
  // dropped shot is caught here rather than at the gate.
  const dossier = JSON.parse(readFileSync(dossierPath, 'utf8')) as { screenshots?: unknown };
  const dossierBytes = statSync(dossierPath).size;
  if (dossierBytes > CAPS.dossierMaxBytes) {
    refuse(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
  }
  const named = JSON.stringify(dossier);
  for (const shot of shots) {
    if (!named.includes(shot)) refuse(`dossier.json does not name screenshot ${shot}`);
  }
  console.log(
    `handed over game/ + ${shots.length} screenshots (${shots.join(', ')}) — dossier.json ${dossierBytes} bytes`,
  );
}

handOver();
