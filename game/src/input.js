// Keyboard + mouse, read once a frame. Actions are edge-triggered (pressed this frame);
// movement is level-triggered (held). The game never reads keys anywhere else.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_INTERACT = 32;

const KEYMAP = {
  Enter: ACTION_CONFIRM, Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE, Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  KeyF: ACTION_PUNCH,
  KeyQ: ACTION_INTERACT,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a) actions |= a;
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseDown(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
    mouseDown = true; actions |= ACTION_SHOOT;
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
  }
  function onMouseUp() { mouseDown = false; }
  function onBlur() { keys.clear(); mouseDown = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** -1/0/1 drive + strafe for this frame. */
    move() {
      let x = 0; let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    runHeld() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takeActions() { const a = actions; actions = 0; return a; },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    anyKey() { return keys.size > 0; },
  };
}
