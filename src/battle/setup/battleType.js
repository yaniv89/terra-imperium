// src/battle/setup/battleType.js
// Battle types (plans/civ-map-rework.md, D5; workstream 6). The situation on the map decides the
// type, and the type decides the objective the sim ends on (src/battle/sim/step.js checkEnd) and
// the words the HUD shows. Pure data and one chooser.
//   field     armies meet on open ground: rout the enemy or destroy LOSS_DECISIVE of its strength;
//             the defender also wins by holding to the clock with more strength left
//   river     the attacker crosses a river edge: it wins by holding the far bank (the defender's
//             half of the field) with RIVER_HOLD_SHARE of its strength when the clock runs out
//   ambush    the defender waits in forest, jungle or hills with no road: the attacker enters in
//             column and loses at once if it is down AMBUSH_LOSS within AMBUSH_SECONDS
//   assault   an assault on a city: hold the keep for 30 seconds (objectives.js)
//   sally     the garrison attacks the besiegers: burn SALLY_ENGINES siege engines or the camp
//   landing   a fleet lands on a defended coast: hold the beachhead for LANDING_HOLD_SECONDS
//   raid      raiders (an independent's party, plans/independent-cities.md 4.4) come for loot: they
//             win by burning RAID_LOOT_NEEDED of the RAID_LOOT_TARGETS loot targets (a depot, the
//             fields, a trade post) and getting away by their own edge; the defender wins by
//             killing or driving them off before that. The one light battle: no base-building.
//   sack      a raid on a weak city: the raiders win by burning SACK_BURN_NEEDED of the town's
//             buildings and houses and getting away. The city is never taken.
import { FIELD_BATTLE_TICKS, SIEGE_BATTLE_TICKS, RAID_BATTLE_TICKS, SACK_BATTLE_TICKS } from '../sim/constants';

export const LOSS_DECISIVE = 0.6;
export const RIVER_HOLD_SHARE = 0.4;
export const AMBUSH_SECONDS = 120;
export const AMBUSH_LOSS = 0.3;
export const LANDING_HOLD_SECONDS = 60;
export const SALLY_ENGINES = 2;
export const AMBUSH_TERRAIN = new Set(['forest', 'jungle', 'hills']);
export const RAID_LOOT_TARGETS = 3;
export const RAID_LOOT_NEEDED = 2;
export const SACK_BURN_NEEDED = 2;
export const RAID_TYPES = new Set(['raid', 'sack']);

// Auto-resolve reads the type too (src/engine/battle.js resolveBattle): the attacker's output is
// scaled so the quick battle keeps parity with the objective the tactical sim would set.
export const RIVER_ATTACK_MULT = 0.85;    // crossing under fire
export const AMBUSH_ATTACK_MULT = 0.8;    // entering cover in column
export const LANDING_ATTACK_MULT = 0.75;  // wading ashore (the old amphibious penalty)
export const SALLY_ATTACK_MULT = 1;       // the sally must burn engines or the camp: no edge in the quick battle (parity harness)
export const AUTO_ATTACK_MULT = { field: 1, river: RIVER_ATTACK_MULT, ambush: AMBUSH_ATTACK_MULT, assault: 1, sally: SALLY_ATTACK_MULT, landing: LANDING_ATTACK_MULT }; // a raid's odds: autoBattle.js (RAID_MULT, RAID_SLIP)
export const autoAttackerMult = (type) => AUTO_ATTACK_MULT[type] ?? 1;
// The river's size changes the crossing (mapgen.js: a stream is narrow with three fords, a great
// river wide with one), so the quick battle scales the river odds by size too, measured with the
// battle-lab parity harness (RIVER_SIZES=1,2,3): index = size class (1 stream, 2 river, 3 great).
export const RIVER_SIZE_ATTACK_ADJUST = [1, 1.12, 1, 0.94];
export const riverAttackAdjust = (size) => RIVER_SIZE_ATTACK_ADJUST[size] ?? 1;

export const BATTLE_TYPES = {
  field: { label: 'Field battle', attacker: `Rout the enemy or destroy ${Math.round(LOSS_DECISIVE * 100)}% of its strength`, defender: 'Rout them, or hold to the clock with more strength left', limitTicks: FIELD_BATTLE_TICKS },
  river: { label: 'River crossing', attacker: `Hold the far bank with ${Math.round(RIVER_HOLD_SHARE * 100)}% of your strength when the clock runs out`, defender: 'Hold the bank', limitTicks: FIELD_BATTLE_TICKS },
  ambush: { label: 'Ambush', attacker: `Survive the first ${AMBUSH_SECONDS / 60} minutes, then rout them`, defender: `Cost the attacker ${Math.round(AMBUSH_LOSS * 100)}% in the first ${AMBUSH_SECONDS / 60} minutes`, limitTicks: FIELD_BATTLE_TICKS },
  assault: { label: 'Siege assault', attacker: 'Breach the keep and hold it for 30 seconds', defender: 'Hold to the clock', limitTicks: SIEGE_BATTLE_TICKS },
  sally: { label: 'Sally', attacker: `Burn ${SALLY_ENGINES} siege engines or the camp`, defender: 'Hold the camp', limitTicks: FIELD_BATTLE_TICKS },
  landing: { label: 'Landing', attacker: `Hold the beachhead for ${LANDING_HOLD_SECONDS} seconds`, defender: 'Push them back into the sea', limitTicks: FIELD_BATTLE_TICKS },
  raid: { label: 'Raid', attacker: `Burn ${RAID_LOOT_NEEDED} of the ${RAID_LOOT_TARGETS} loot targets and get away by your edge`, defender: 'Kill the raiders or drive them off before they loot', limitTicks: RAID_BATTLE_TICKS },
  sack: { label: 'Sack', attacker: `Burn ${SACK_BURN_NEEDED} of the town's buildings or houses and get away`, defender: 'Kill the raiders or drive them off before they burn the town', limitTicks: SACK_BATTLE_TICKS },
  naval: { label: 'Sea battle', attacker: 'Sink or scatter the enemy fleet', defender: 'Hold the waters', limitTicks: FIELD_BATTLE_TICKS } // quick battle only today (navalBattle.js)
};

/** The battle type for a situation: { raid (raiders came for loot), landing, sally, city (a city battle), fortLevel, tileContext, fromTile }. */
export const battleTypeOf = ({ raid = false, landing = false, sally = false, city = false, fortLevel = 0, tileContext = null, fromTile = null } = {}) => {
  if (raid) return city ? 'sack' : 'raid';
  if (landing) return 'landing';
  if (sally) return 'sally';
  if (city && fortLevel > 0) return 'assault';
  if (tileContext) {
    const approach = fromTile != null ? tileContext.sectors.find((s) => s.tile === fromTile) : null;
    if (approach?.river) return 'river';
    if (!city && AMBUSH_TERRAIN.has(tileContext.terrain) && !tileContext.roads) return 'ambush';
  }
  return 'field';
};
