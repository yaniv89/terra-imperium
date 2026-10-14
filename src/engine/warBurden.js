// src/engine/warBurden.js
// War exhaustion from what a war really costs (lane CB09, I121 and addendum X22). It used to rise a
// flat 5 a turn, so every war reached the white-peace bar of 80 (diplomacy.js) on both sides after
// 16 turns whatever happened, and "as worn out by the war as you are" was said of wars with no
// battle at all. Now, for a nation at war, each turn:
//   rise = WE_RISE_BASE                                   (men under arms, trade cut)
//        + WE_RISE_PER_BESIEGED x min(cap, own cities under siege)
//        + WE_RISE_LOST_LAND x share of its cities an enemy holds in a live war
// times its laws' warExhaustionMult (lawRules.js). Battles add their own share on top
// (aftermath.js applyBattleWarExhaustion: the loser 2 + 12 x its losses, the winner 1). At peace it
// decays as before. A quiet war now takes 40 turns to exhaust both sides; a war with no fighting
// for WAR_STALEMATE_IDLE_TURNS only makes the AI offer the player a white peace (diplomacy.js); AI vs AI wars never end that way.
// Pure; one pass over the cities for every nation at war.
export const WE_RISE_BASE = 2;
export const WE_RISE_PER_BESIEGED = 1;
export const WE_RISE_BESIEGED_CAP = 3;
export const WE_RISE_LOST_LAND = 10;

/**
 * Burden inputs per nation in `atWar` (a Set of ids): { cities, besieged, occupied, lost } from the cities
 * (occupied: own cities an enemy occupies; lost: cities taken from it in a live war).
 * `isLiveWar(warId)` says whether a conquest's war still runs (a city taken in it is still "lost").
 */
export const warBurdenInputs = (regions, atWar, isLiveWar) => {
  const out = new Map();
  if (!atWar.size) return out;
  const entry = (id) => { let e = out.get(id); if (!e) { e = { cities: 0, besieged: 0, occupied: 0, lost: 0 }; out.set(id, e); } return e; };
  for (const id in regions) {
    const c = regions[id];
    if (!c || !c.owner) continue;
    if (atWar.has(c.owner)) {
      const e = entry(c.owner);
      e.cities += 1;
      if (c.siege?.by) e.besieged += 1;
      if (c.occupiedBy && c.occupiedBy !== c.owner) e.occupied += 1;
    }
    const from = c.conquest?.from;
    if (from && from !== c.owner && atWar.has(from) && isLiveWar(c.conquest.warId)) { const e = entry(from); e.lost += 1; }
  }
  return out;
};

/** The exhaustion a nation at war gains this turn before its laws. */
export const warExhaustionRise = ({ cities = 0, besieged = 0, occupied = 0, lost = 0 } = {}) => {
  const total = cities + lost; // a lost city no longer counts among its own
  const lostShare = total > 0 ? (occupied + lost) / total : 0;
  return WE_RISE_BASE + WE_RISE_PER_BESIEGED * Math.min(WE_RISE_BESIEGED_CAP, besieged) + WE_RISE_LOST_LAND * lostShare;
};
