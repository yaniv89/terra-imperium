// src/engine/chronicle.js
// The game's story, kept small for the Chronicle reader (differentiation plan U28, KTD15).
// state.chronicle = { battleSeq, chapters: [chapter] }, one chapter per age the PLAYER has lived in
// (its research age, ageOf): { age, from, to?, label, tiles?, wars, cities, ambitions, battles }.
//   closing  the player's own age change closes the chapter ('to' turn, tiles = the player's tiles
//            as run-length pairs [start, length, ...] over sorted tile ids) and opens the next; a
//            rival's age change never does.
//   entries  { t: turn, ...facts } read from what changed this turn (tickChronicle(prev, next)), so
//            the sources stay untouched. Battles are read from battleReports past battleSeq, so a
//            battle is written once however often it is applied.
//   bounds   at most AGES chapters, CITY_LOG/WAR_LOG/AMBITION_LOG rows each, and the BATTLES_KEPT
//            biggest battles (men fallen) a chapter. `label` is the display year, a label only.
import { ageOf } from './nationState';
import { cityHolder } from './world/cities';
import { displayYear } from './displayYear';

export const BATTLES_KEPT = 6;
const CITY_LOG = 30;
const WAR_LOG = 20;
const AMBITION_LOG = 10;

const playerCities = (state) => {
  const out = {};
  Object.values(state.regions || {}).forEach((c) => { if (cityHolder(c) === state.playerNationId) out[c.id] = c; });
  return out;
};

/** The player's tiles as run-length pairs [start, length, ...] over sorted tile ids. */
export const tileRuns = (state) => {
  const mine = playerCities(state);
  const tiles = Object.keys(state.world?.tileOwner || {}).filter((t) => mine[state.world.tileOwner[t]]).map(Number).sort((a, b) => a - b);
  const runs = [];
  tiles.forEach((t) => {
    const n = runs.length;
    if (n && runs[n - 2] + runs[n - 1] === t) runs[n - 1] += 1; else runs.push(t, 1);
  });
  return runs;
};

const newChapter = (state) => ({ age: ageOf(state, state.playerNationId), from: state.turnNumber, label: displayYear(state), wars: [], cities: [], ambitions: [], battles: [] });
const cap = (list, add, n) => [...list, ...add].slice(-n);

/** Appends this turn's story to the chronicle. `prev` is the state before the turn, `next` after. */
export const tickChronicle = (prev, next) => {
  const me = next.playerNationId;
  if (!me || !next.regions) return next;
  let ch = next.chronicle || { battleSeq: next.battleReportSeq || 0, chapters: [] };
  let chapters = ch.chapters.length ? ch.chapters : [newChapter(prev)];
  let cur = chapters[chapters.length - 1];
  const t = next.turnNumber;

  const wars = (next.wars || []).filter((w) => w.startTurn === t && !prev.wars?.some((p) => p.id === w.id)).map((w) => ({ t, id: w.id, enemy: w.enemy, aggressor: w.aggressor }));
  const before = playerCities(prev);
  const after = playerCities(next);
  const cities = [
    ...Object.values(after).filter((c) => !before[c.id]).map((c) => ({ t, id: c.id, how: c.founderId === me && c.founded === t ? 'founded' : 'taken' })),
    ...Object.values(before).filter((c) => !after[c.id]).map((c) => ({ t, id: c.id, how: 'lost' }))
  ];
  const doneOf = (s) => s.nations?.[me]?.ambitions?.done?.length || 0;
  const ambitions = (next.nations?.[me]?.ambitions?.done || []).slice(doneOf(prev)).map((a) => ({ t, id: a.id }));
  const fresh = (next.battleReports || []).filter((b) => Number(b.id.slice(7)) > ch.battleSeq);
  const battles = fresh.map((b) => ({ t: b.turn, id: b.id, name: b.name, tile: b.tile, kind: b.kind, side: b.playerSide, outcome: b.outcome, fallen: b.fallen.attacker + b.fallen.defender }));

  cur = {
    ...cur,
    wars: cap(cur.wars, wars, WAR_LOG),
    cities: cap(cur.cities, cities, CITY_LOG),
    ambitions: cap(cur.ambitions, ambitions, AMBITION_LOG),
    battles: [...cur.battles, ...battles].sort((a, b) => b.fallen - a.fallen).slice(0, BATTLES_KEPT)
  };
  chapters = [...chapters.slice(0, -1), cur];
  const age = ageOf(next, me);
  if (age !== cur.age) chapters = [...chapters.slice(0, -1), { ...cur, to: t, tiles: tileRuns(next) }, { ...newChapter(next), age }];
  return { ...next, chronicle: { battleSeq: next.battleReportSeq || 0, chapters } };
};
