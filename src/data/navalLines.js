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
import { AGE_ORDER } from './ages';

export const NAVAL_BOMBARD = 10;
export const NAVAL_LINES = {
  warship: { id: 'warship', label: 'Warship', role: 'Fights fleets, blockades, bombards a besieged coast.', from: 'bronze', names: ['War Galley', 'Trireme', 'Cog', 'Frigate', 'Destroyer'], cargo: [1, 1, 2, 2, 2], air: 0, combat: 1, sight: 0, bombard: true },
  transport: { id: 'transport', label: 'Transport', role: 'Carries an army; weak in a fight.', from: 'classical', names: ['Longship', 'Longship', 'Carrack', 'Galleon', 'Landing ship'], cargo: [3, 3, 4, 5, 6], air: 0, combat: 0.4, sight: 0, bombard: false },
  raider: { id: 'raider', label: 'Raider', role: 'Plunders sea trade; sees far; carries nothing.', from: 'classical', names: ['Bireme', 'Bireme', 'Corsair', 'Privateer', 'Submarine'], cargo: [0, 0, 0, 0, 0], air: 0, combat: 0.8, sight: 102, bombard: false },
  carrier: { id: 'carrier', label: 'Carrier', role: 'Holds two air units; sees far.', from: 'modern', names: ['Carrier', 'Carrier', 'Carrier', 'Carrier', 'Carrier'], cargo: [0, 0, 0, 0, 0], air: 2, combat: 0.6, sight: 102, bombard: false }
};
export const NAVAL_LINE_IDS = Object.keys(NAVAL_LINES);

const ageIndex = (ageId) => Math.max(0, AGE_ORDER.indexOf(ageId));
export const navalLineOf = (unit) => (unit?.navalLine && NAVAL_LINES[unit.navalLine] ? unit.navalLine : 'warship');
export const navalLinesFor = (ageId) => NAVAL_LINE_IDS.filter((id) => ageIndex(ageId) >= ageIndex(NAVAL_LINES[id].from));
export const navalCargo = (line, ageId) => NAVAL_LINES[line]?.cargo[ageIndex(ageId)] ?? 1;
/** Aircraft a ship of this line carries (the carrier's two; airPower.js). */
export const navalAir = (line) => NAVAL_LINES[line]?.air ?? 0;
export const navalName = (line, ageId) => NAVAL_LINES[line]?.names[ageIndex(ageId)] || 'Fleet';
export const navalCombatMult = (line) => NAVAL_LINES[line]?.combat ?? 1;
// Extra sight in km (sight.js adds it to SIGHT_FLEET_KM; 102 km is one ring at frequency 75).
export const navalSightBonus = (line) => NAVAL_LINES[line]?.sight ?? 0;
export const navalBombards = (unit) => !!NAVAL_LINES[navalLineOf(unit)]?.bombard;
