// src/data/navalLines.js
// The four naval lines (plans/civ-map-rework.md, D5b; workstream 5). A fleet keeps `classId:
// 'naval'` (the domain every reader checks) and carries `navalLine`; an older record without one
// is a warship. Data only; the engine reads it through the helpers below.
//   warship    fights fleets, blockades, bombards a besieged coastal city (NAVAL_BOMBARD a ship a
//              turn, sieges.js); carries 1 unit, 2 from the Age of Kingdoms
//   transport  carries 3 to 6 units, fights at TRANSPORT_COMBAT; from the Classical age
//   raider     plunders sea trade (a blockader that counts alone), sees a tile further, fights at
//              RAIDER_COMBAT, carries nothing; from the Classical age
//   carrier    holds 2 air units, sees a tile further, fights at CARRIER_COMBAT; Modern
import { AGE_ORDER, FIRST_AGE_ID, isAgeAtLeast } from './ages';

export const NAVAL_BOMBARD = 10;
export const NAVAL_LINES = {
  warship: { id: 'warship', label: 'Warship', role: 'Fights fleets, blockades, bombards a besieged coast.', from: 'bronze', names: { bronze: 'War Galley', classical: 'Trireme', kingdoms: 'Cog', gunpowder: 'Frigate', modern: 'Destroyer' }, cargo: { bronze: 1, classical: 1, kingdoms: 2, gunpowder: 2, modern: 2 }, air: 0, combat: 1, sight: 0, bombard: true },
  transport: { id: 'transport', label: 'Transport', role: 'Carries an army; weak in a fight.', from: 'classical', names: { bronze: 'Longship', classical: 'Longship', kingdoms: 'Carrack', gunpowder: 'Galleon', modern: 'Landing ship' }, cargo: { bronze: 3, classical: 3, kingdoms: 4, gunpowder: 5, modern: 6 }, air: 0, combat: 0.4, sight: 0, bombard: false },
  raider: { id: 'raider', label: 'Raider', role: 'Plunders sea trade; sees far; carries nothing.', from: 'classical', names: { bronze: 'Bireme', classical: 'Bireme', kingdoms: 'Corsair', gunpowder: 'Privateer', modern: 'Submarine' }, cargo: { bronze: 0, classical: 0, kingdoms: 0, gunpowder: 0, modern: 0 }, air: 0, combat: 0.8, sight: 1, bombard: false },
  carrier: { id: 'carrier', label: 'Carrier', role: 'Holds two air units; sees far.', from: 'modern', names: { bronze: 'Carrier', classical: 'Carrier', kingdoms: 'Carrier', gunpowder: 'Carrier', modern: 'Carrier' }, cargo: { bronze: 0, classical: 0, kingdoms: 0, gunpowder: 0, modern: 0 }, air: 2, combat: 0.6, sight: 1, bombard: false }
};
export const NAVAL_LINE_IDS = Object.keys(NAVAL_LINES);

// Names and cargo are keyed by age id; an unknown age reads as the first age.
const knownAge = (ageId) => (AGE_ORDER.includes(ageId) ? ageId : FIRST_AGE_ID);
export const navalLineOf = (unit) => (unit?.navalLine && NAVAL_LINES[unit.navalLine] ? unit.navalLine : 'warship');
export const navalLinesFor = (ageId) => NAVAL_LINE_IDS.filter((id) => isAgeAtLeast(knownAge(ageId), NAVAL_LINES[id].from));
export const navalCargo = (line, ageId) => NAVAL_LINES[line]?.cargo[knownAge(ageId)] ?? 1;
/** Aircraft a ship of this line carries (the carrier's two; airPower.js). */
export const navalAir = (line) => NAVAL_LINES[line]?.air ?? 0;
export const navalName = (line, ageId) => NAVAL_LINES[line]?.names[knownAge(ageId)] || 'Fleet';
export const navalCombatMult = (line) => NAVAL_LINES[line]?.combat ?? 1;
export const navalSightBonus = (line) => NAVAL_LINES[line]?.sight ?? 0;
export const navalBombards = (unit) => !!NAVAL_LINES[navalLineOf(unit)]?.bombard;
