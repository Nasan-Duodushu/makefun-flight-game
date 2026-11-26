// Keyboard and pointer input. Held keys give a stick position; one-shot presses
// (start or restart, pause) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const BANK_LEFT = new Set(['ArrowLeft', 'KeyA']);
const BANK_RIGHT = new Set(['ArrowRight', 'KeyD']);
const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = { bankLeft: false, bankRight: false, pitchUp: false, pitchDown: false, thrUp: false, thrDown: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (BANK_LEFT.has(event.code)) held.bankLeft = true;
    else if (BANK_RIGHT.has(event.code)) held.bankRight = true;
    else if (PITCH_UP.has(event.code)) held.pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) held.pitchDown = true;
    else if (THROTTLE_UP.has(event.code)) held.thrUp = true;
    else if (THROTTLE_DOWN.has(event.code)) held.thrDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    // Arrow keys and Space scroll the page: keep the game from doing so.
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (BANK_LEFT.has(event.code)) held.bankLeft = false;
    else if (BANK_RIGHT.has(event.code)) held.bankRight = false;
    else if (PITCH_UP.has(event.code)) held.pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) held.pitchDown = false;
    else if (THROTTLE_UP.has(event.code)) held.thrUp = false;
    else if (THROTTLE_DOWN.has(event.code)) held.thrDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The stick this frame: bank and pitch -1..1, throttle trim -1..1. */
    stick() {
      return {
        bank: (held.bankRight ? 1 : 0) - (held.bankLeft ? 1 : 0),
        pitch: (held.pitchUp ? 1 : 0) - (held.pitchDown ? 1 : 0),
        throttle: (held.thrUp ? 1 : 0) - (held.thrDown ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
