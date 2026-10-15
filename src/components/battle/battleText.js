// src/components/battle/battleText.js
// The battle's data names in the current language (phase H5): squads, buildings of the battle
// economy, abilities, powers, battle types, structures, resources. The English text stays in
// src/battle (the source); Hebrew comes from locales/data/he.battle.js. Pure: reads the language of
// src/i18n/core.js, so the view models may call it.
import { dataText, translate } from '../../i18n/core';
import { unitRosterName } from '../../i18n/gameText';
import { getSquadDisplayName } from '../../battle/data/battleStats';
import { ecoName, NODE_KINDS } from '../../battle/data/economy';
import { ABILITIES, POWERS } from '../../battle/sim/effects';
import { BATTLE_TYPES, LOSS_DECISIVE, RIVER_HOLD_SHARE, AMBUSH_SECONDS, AMBUSH_LOSS, SALLY_ENGINES, LANDING_HOLD_SECONDS, RAID_LOOT_NEEDED, RAID_LOOT_TARGETS, SACK_BURN_NEEDED } from '../../battle/setup/battleType';
import { BUILDING_EFFECTS } from '../../battle/sim/buildings';

/** A squad's name ("Spearmen") by class and age. */
export const squadName = (classId, ageId) => unitRosterName(ageId, classId, getSquadDisplayName(classId, ageId));
/** A building, camp or laborer of the battle economy by id and age. */
export const ecoLabel = (id, ageId) => dataText(`beco.${ageId}.${id}`, dataText(`beco.${id}`, ecoName(id, ageId)));
/** The laborer's name for an age (Laborer, Villager, Engineer). */
export const workerLabel = (ageId) => ecoLabel('worker', ageId);
/** A unit role the economy trains: a laborer or a squad class. */
export const roleLabel = (role, ageId) => (role === 'worker' ? workerLabel(ageId) : squadName(role, ageId));
export const abilityLabel = (id) => dataText(`babil.${id}`, ABILITIES[id]?.label || id);
export const powerLabel = (id, english) => dataText(`bpower.${id}`, english ?? POWERS[id]?.label ?? id);

const TYPE_VARS = {
  field: { pct: Math.round(LOSS_DECISIVE * 100) },
  river: { pct: Math.round(RIVER_HOLD_SHARE * 100) },
  ambush: { min: AMBUSH_SECONDS / 60, pct: Math.round(AMBUSH_LOSS * 100) },
  sally: { n: SALLY_ENGINES },
  landing: { sec: LANDING_HOLD_SECONDS },
  raid: { need: RAID_LOOT_NEEDED, total: RAID_LOOT_TARGETS },
  sack: { n: SACK_BURN_NEEDED }
};
/** A battle type's text: field is 'label', 'attacker' or 'defender'. */
export const battleTypeText = (type, field) => dataText(`btype.${type}.${field}`, BATTLE_TYPES[type]?.[field] ?? '', TYPE_VARS[type]);
/** The objective of `side` (0 attacks, 1 defends) in a battle type. */
export const battleGoal = (type, side) => battleTypeText(type, side === 1 ? 'defender' : 'attacker');
export const buildingEffect = (category, fallback) => dataText(`beff.${category}`, BUILDING_EFFECTS[category] || fallback || '');
export const nodeLabel = (kind) => dataText(`bnode.${kind}`, NODE_KINDS[kind]?.label || kind);
/** A structure's word: keep, tower, gate ... ('bstruct.<kind>'). */
export const structureLabel = (kind, english) => dataText(`bstruct.${kind}`, english ?? kind);
/** A stock resource's name (food, wood, stone, gold). */
export const resourceWord = (res) => translate(`bt.res.${res}`);
