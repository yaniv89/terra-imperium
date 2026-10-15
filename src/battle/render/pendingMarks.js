// src/battle/render/pendingMarks.js
// Orders given while the battle is paused (RTS-03). The battle loop holds them until Resume (the
// sim applies them on its next step), so without these marks a paused order showed nothing at all.
// A mark is drawn steady (a ring where squads will go or strike, a footprint where a building will
// stand) for as long as the sim has not stepped past the tick it was given on. Drawing only: the
// sim and the replay never see these.
//
// mark: { kind: 'move' | 'attackMove' | 'attack' | 'rally' | 'power' | 'build', x, z (tiles),
//         color, squads?: [idx], size?, tx?, ty? (a building's footprint), tick }

export const MAX_PENDING_MARKS = 24;
// A newer order for the same squads replaces the older mark (only the last order counts).
const SQUAD_KINDS = new Set(['move', 'attackMove', 'attack']);

/** Add `mark` to `list` (mutated, newest last) and return the list. */
export const recordPendingMark = (list, mark) => {
  if (!mark) return list;
  const squads = SQUAD_KINDS.has(mark.kind) ? mark.squads || [] : [];
  if (squads.length) {
    for (let k = list.length - 1; k >= 0; k--) {
      const o = list[k];
      if (!SQUAD_KINDS.has(o.kind) || !o.squads?.length) continue;
      o.squads = o.squads.filter((i) => !squads.includes(i));
      if (!o.squads.length) list.splice(k, 1);
    }
  }
  list.push({ ...mark, squads: squads.length ? [...squads] : mark.squads });
  while (list.length > MAX_PENDING_MARKS) list.shift();
  return list;
};

/** Is the mark still waiting? Yes until the sim has stepped past the tick it was given on. */
export const markPending = (mark, tick) => tick == null || mark.tick == null || tick <= mark.tick;

/** The marks still waiting at sim tick `tick` (a new array; the order kept). */
export const livePendingMarks = (list, tick) => list.filter((m) => markPending(m, tick));
