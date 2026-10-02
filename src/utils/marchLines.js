// src/utils/marchLines.js
// The march lines the map draws (plan §4g): the route being planned (a preview) and every march of
// your armies under way. One line per stack: the provinces in order, with the turn each step is
// reached, so the map can number the turns ("1", "2", "3") where each turn's march ends. Pure.
import { scheduleSteps } from '../engine/routes';

// `steps` = the provinces after the start; `stepTurns` = the turn of each. Returns the indexes in
// `points` (start included) where a turn's march ends, with that turn's number.
export const turnMarks = (stepTurns) => {
  const marks = [];
  stepTurns.forEach((t, i) => { if (i === stepTurns.length - 1 || stepTurns[i + 1] !== t) marks.push({ index: i + 1, turn: t }); });
  return marks;
};

export const getMarchLines = (state, preview = null) => {
  const lines = [];
  const groups = new Map();
  Object.values(state.units).forEach((u) => {
    if (u.ownerId !== state.playerNationId || !u.route?.length) return;
    const key = `${u.regionId}|${u.route.join(',')}`;
    if (!groups.has(key)) groups.set(key, u);
  });
  groups.forEach((u, key) => {
    const stepTurns = scheduleSteps(state, u.route, u.routePace || 2, u.routeBank || 0);
    lines.push({ key: `route:${key}`, kind: 'active', points: [u.regionId, ...u.route], marks: turnMarks(stepTurns), halted: !!u.routeHalt });
  });
  if (preview?.ok) {
    const haltIndex = preview.haltAt ? preview.path.indexOf(preview.haltAt) : -1;
    lines.push({ key: 'preview', kind: 'preview', points: preview.path, marks: turnMarks(preview.stepTurns), haltIndex });
  }
  return lines;
};
