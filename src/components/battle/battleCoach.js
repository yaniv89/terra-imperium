// src/components/battle/battleCoach.js
// The battle's control words in one place (RTS-01), kept true to the real input mapping in
// src/battle/input/gestures.js and selection.js: a touch screen gets touch words, a mouse gets mouse
// words, never the other way round. Also the first-battle coach: three short steps, skippable,
// shown once per device (localStorage, read defensively), never a modal and never holding the
// battle clock.

export const COACH_KEY = 'ti.coach.firstBattle';
let shownThisSession = false; // storage blocked (private mode): at most once a session

/** Has this device seen the coach? Storage that throws or is missing counts as not seen. */
export const coachSeen = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  if (shownThisSession) return true;
  try { return storage?.getItem(COACH_KEY) === '1'; } catch { return false; }
};

/** Remember the coach was shown (it never comes back on this device, or this session). */
export const markCoachSeen = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  shownThisSession = true;
  try { storage?.setItem(COACH_KEY, '1'); } catch { /* storage blocked */ }
};

/** For tests: forget the session flag. */
export const resetCoachSession = () => { shownThisSession = false; };

/** The three steps: [{ title, text }]. */
export const coachSteps = (mouse) => (mouse
  ? [
    { title: 'Select and move', text: 'Click a squad to select it (drag a box for more), then right click the ground to send it there. Right drag draws a battle line.' },
    { title: 'Attack', text: 'Right click an enemy to attack it. Or click Attack (key A), then click the ground: they fight anything on the way.' },
    { title: 'Camera and pause', text: 'The wheel zooms. Hold Space or Alt and drag, use the arrow keys or the screen edge to move the camera. Orders given while paused show at once and start when you resume.' }
  ]
  : [
    { title: 'Select and move', text: 'Tap a squad to select it, then tap the ground to send it there. Drag from a selected squad to draw a battle line.' },
    { title: 'Attack', text: 'Tap an enemy to attack it. Or tap Attack, then tap the ground: they fight anything on the way. A long press on the ground does the same.' },
    { title: 'Camera and pause', text: 'Drag one finger to move the camera, pinch two fingers to zoom. Orders given while paused show at once and start when you resume.' }
  ]);

/** The deployment card's words. */
export const deployHelp = (mouse) => (mouse
  ? 'Click a squad, then right click inside your zone to place it. Right drag draws a battle line.'
  : 'Tap a squad, then tap inside your zone to place it. Drag from a selected squad to draw a line.');

/** The camera line under "More about this battle". */
export const cameraHelp = (mouse) => (mouse
  ? 'Hold Space (or Alt) and drag, use the arrow keys or the screen edge to move the camera; the wheel zooms where the pointer is.'
  : 'Drag one finger to move the camera, pinch two fingers to zoom.');

/** A mouse is the main pointer: a fine pointer and no touch screen. A touch laptop starts with
 *  touch words and switches at the first mouse click (TacticalBattleScreen.jsx). */
export const mouseFirst = (win = typeof window !== 'undefined' ? window : null) => {
  if (!win?.matchMedia) return false;
  const fine = !!win.matchMedia('(pointer: fine)').matches;
  const touch = (win.navigator?.maxTouchPoints || 0) > 0 || !!win.matchMedia('(any-pointer: coarse)').matches;
  return fine && !touch;
};
