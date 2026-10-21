import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getInvasionBattleContext } from './invasion';
import { neighbourWorld, rivalOf, withDecrees } from './testWorld';
import { GOVERNMENT_REFORMS } from '../data/government';

// Eight-ages plan U6: every rule that belongs to a nation reads that nation's own age, never the
// calendar (state.year / the old state.age).
const rich = () => {
  const s = neighbourWorld({ seed: 11 });
  return withDecrees({ ...s, resources: { ...s.resources, gold: 5000 } });
};

describe('nation-owned rules read the nation\'s age', () => {
  it('a Bronze nation in a late world cannot pick a Republic; a Classical one can', () => {
    const base = rich();
    const late = { ...base, year: 600, age: 'kingdoms', techAgeId: 'bronze' };
    const me = late.playerNationId;
    const refused = gameReducer(late, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'republic' } });
    expect(refused.nations[me].government?.type).not.toBe('republic');
    const classical = gameReducer({ ...late, techAgeId: 'classical' }, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'republic' } });
    expect(classical.nations[me].government.type).toBe('republic');
  });

  it('reforms offer tiers up to the nation\'s age only', () => {
    const base = rich();
    const me = base.playerNationId;
    const s = { ...base, year: 1600, age: 'gunpowder', techAgeId: 'classical', nations: { ...base.nations, [me]: { ...base.nations[me], government: { type: 'monarchy', reforms: {} } } } };
    const tier = (ageId) => GOVERNMENT_REFORMS.monarchy[ageId]?.[0]?.id;
    const kingdoms = gameReducer(s, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'kingdoms', reformId: tier('kingdoms') } });
    expect(kingdoms.nations[me].government.reforms.kingdoms).toBeUndefined();
    const classical = gameReducer(s, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'classical', reformId: tier('classical') } });
    expect(classical.nations[me].government.reforms.classical).toBe(tier('classical'));
  });

  it('a Classical defender against a Gunpowder attacker fights with its Classical roster', () => {
    const base = rich();
    const foe = rivalOf(base);
    const cityId = Object.keys(base.regions).find((id) => base.regions[id].owner === foe);
    const s = { ...base, year: 1700, age: 'gunpowder', techAgeId: 'gunpowder', nations: { ...base.nations, [foe]: { ...base.nations[foe], tech: { ...base.nations[foe].tech, ageId: 'classical' } } } };
    const ctx = getInvasionBattleContext(s, { targetRegionId: cityId, targetRegion: s.regions[cityId], defenderUnits: [] });
    expect(ctx.attackerAgeId).toBe('gunpowder');
    expect(ctx.defenderAgeId).toBe('classical');
  });
});
