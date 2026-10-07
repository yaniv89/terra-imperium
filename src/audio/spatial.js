// src/audio/spatial.js
// Battle sound only where the player is looking. The camera's view of the ground is a
// parallelogram (the isometric camera): its centre (cx, cz) and two half-extent vectors in battle
// tiles, `a` from the centre to the middle of the screen's right edge and `b` to the middle of its
// top edge (BattleRenderer.audioView). A sound's place in it, (u, v), is -1..1 on screen.
//   inside the view            full volume
//   beyond the edge            fades to zero over FADE (half a screen: one half-extent)
//   further, or screen hidden  silent: the caller must not even build the sound
export const FADE = 1; // half-extents beyond the edge (a half-extent is half a screen)
export const MIN_GAIN = 0.03; // quieter than this is not worth a voice

/** Where a ground point (tiles) sits on screen: u (right), v (up), -1..1 inside the view. */
export const viewCoords = (x, z, view) => {
  const dx = x - view.cx; const dz = z - view.cz;
  const det = view.ax * view.bz - view.az * view.bx;
  if (!det) return { u: 0, v: 0 };
  return { u: (dx * view.bz - dz * view.bx) / det, v: (view.ax * dz - view.az * dx) / det };
};

/**
 * How loud a sound at ground point (x, z) tiles is: { gain 0..1, pan -1..1, inside, dist }.
 * `dist` is the distance from the view centre in tiles. gain 0 means do not play.
 */
export const audibility = (x, z, view, { hidden = false } = {}) => {
  if (hidden) return { gain: 0, pan: 0, inside: false, dist: Infinity };
  if (!view) return { gain: 1, pan: 0, inside: true, dist: 0 }; // no camera yet: plain stereo
  const { u, v } = viewCoords(x, z, view);
  const dist = Math.hypot(x - view.cx, z - view.cz);
  const over = Math.max(Math.abs(u), Math.abs(v)) - 1;
  const inside = over <= 0;
  let gain = inside ? 1 : Math.max(0, 1 - over / FADE);
  if (gain < MIN_GAIN) gain = 0;
  return { gain, pan: Math.max(-1, Math.min(1, u)) * 0.8, inside, dist };
};

/** The ambient bed's target level from the fighting: the fight events' gains a second (an event on
 *  screen counts 1, at the edge less, off screen 0), saturating. Nothing on screen: silence. */
export const AMBIENCE_SATURATION = 40;
export const ambienceTarget = (fightGainPerSec) => 1 - Math.exp(-Math.max(0, fightGainPerSec) / AMBIENCE_SATURATION);
/** Ease the ambient level toward its target (time constant `tau` seconds). */
export const easeLevel = (level, target, dt, tau = 1.2) => level + (target - level) * (1 - Math.exp(-Math.max(0, dt) / tau));
