// src/components/battle/battleCoach.js
// The battle's control words in one place (RTS-01), kept true to the real input mapping in
// src/battle/input/gestures.js and selection.js: a touch screen gets touch words, a mouse gets mouse
// words, never the other way round. Also the first-battle coach: three short steps, skippable,
// shown once per device (localStorage, read defensively), never a modal and never holding the
// battle clock.

import { t } from '../../i18n/core';

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
export const coachSteps = (mouse) => [1, 2, 3].map((i) => ({ title: t(`bt.coach.${mouse ? 'mouse' : 'touch'}.${i}.title`), text: t(`bt.coach.${mouse ? 'mouse' : 'touch'}.${i}.text`) }));

/** The deployment card's words. */
export const deployHelp = (mouse, naval = false) => t(`${mouse ? 'bt.coach.deployMouse' : 'bt.coach.deployTouch'}${naval ? 'Naval' : ''}`);

/** The camera line under "More about this battle". */
export const cameraHelp = (mouse) => t(mouse ? 'bt.coach.cameraMouse' : 'bt.coach.cameraTouch');

/** A mouse is the main pointer: a fine pointer and no touch screen. A touch laptop starts with
 *  touch words and switches at the first mouse click (TacticalBattleScreen.jsx). */
export const mouseFirst = (win = typeof window !== 'undefined' ? window : null) => {
  if (!win?.matchMedia) return false;
  const fine = !!win.matchMedia('(pointer: fine)').matches;
  const touch = (win.navigator?.maxTouchPoints || 0) > 0 || !!win.matchMedia('(any-pointer: coarse)').matches;
  return fine && !touch;
};
