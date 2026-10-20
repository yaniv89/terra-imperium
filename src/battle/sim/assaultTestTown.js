// src/battle/sim/assaultTestTown.js
// A walled town as the campaign builds it (the battle economy on, the real town from its manifest,
// its militia), for the tests of the mobile campaign audit's assault rows (H-02, H-03, H-04, H-26).
// Defaults: the Siwa assault (4 regiments of 588 against a small capital's garrison in the desert).
import { buildSetupFromArmies, commandedSetup } from '../setup/buildBattleSetup';
import { militiaFor } from '../../engine/battleInputs';
import { buildTownManifest, manifestHousing } from '../../data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../engine/siege';

const mk = (p, cls, strength = 1000) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
export const town = ({ seed = 1, tierId = 'small', ageId = 'kingdoms', fort = 1, att = ['infantry', 'infantry', 'cavalry', 'ranged'], strA = 588, def = ['infantry', 'cavalry'], strD = 190, controllers = ['player', 'ai'], terrain = 'desert', capital = true, buildings = {} } = {}) => {
  const cityManifest = buildTownManifest({ cityId: `t-${seed}`, ageId, tierId, style: 'europe', seed, defenseTier: 1, capital, buildings });
  const militia = militiaFor({ ownerId: 'defender', cityId: `t-${seed}`, housing: manifestHousing(cityManifest) });
  return commandedSetup(buildSetupFromArmies({
    regionId: `t-${seed}`, terrain, seed, attackerUnits: mk('a', att, strA), defenderUnits: [...mk('d', def, strD), ...militia],
    attackerAgeId: ageId, defenderAgeId: ageId, controllers, deposits: [], powers: [[], []], city: true,
    fortLevel: fort, isAttackingFortification: true, cityManifest, defenseReduction: getDefenseLevelDamageReductionMultiplier(fort),
    economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
  }));
};
export const army = (w, side) => w.squads.filter((q) => q.side === side && q.alive && q.onField && !q.worker && !q.isGeneral);

