// The irregular looks reach the battle (checkpoint 07): an engine unit's `mercenary` (a hired band,
// src/engine/mercenaries.js) and `raidOf` (a raid party, src/engine/raids.js) survive the setup's
// copies, the sim's squads (q.original) and both render views (the worker's packed view and the
// plain one), and a raid or a sack draws its attackers as raiders.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from '../sim/world';
import { makeRenderView } from './view';
import { createViewPacker, createViewDecoder } from './packedView';
import { unitLookOf } from './unitModels';

const unit = (id, classId, extra = {}) => ({ id, classId, strength: 900, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', xp: 0, ...extra });
const setupOf = (over = {}) => buildSetupFromArmies({
  regionId: 'looks', terrain: 'plains', seed: 3, attackerAgeId: 'bronze', defenderAgeId: 'bronze', controllers: ['ai', 'ai'],
  attackerUnits: [unit('a0', 'cavalry', { raidOf: 'indep-x' }), unit('a1', 'infantry', { raidOf: 'indep-x' })],
  defenderUnits: [unit('d0', 'infantry', { mercenary: { from: 'indep-y', pay: 2 } }), unit('d1', 'ranged')],
  ...over
});
const looks = (views) => views.map((s) => `${s.side}:${s.classId}:${s.look}`).sort();

describe('irregular looks from the engine units to the drawn squads', () => {
  it('hired bands and raid parties keep their flags through setup, sim and both views', () => {
    const setup = setupOf({ battleType: 'raid', raid: true });
    expect(setup.sides[1].units[0].mercenary).toEqual({ from: 'indep-y', pay: 2 });
    const w = createWorld(setup);
    const want = ['0:cavalry:raider', '0:infantry:raider', '1:infantry:mercenary', '1:ranged:null'];
    expect(looks(makeRenderView(w, [], 1).squads)).toEqual(want);
    const decode = createViewDecoder();
    const { packed } = createViewPacker().pack(w, [], 1, { fog: false, slow: true });
    expect(looks(decode(packed).squads)).toEqual(want);
  });

  it('a raid or a sack draws its attackers as raiders even without the engine flag', () => {
    const setup = setupOf({ battleType: 'raid', raid: true, attackerUnits: [unit('a0', 'cavalry')] });
    expect(unitLookOf(null, setup, 0)).toBe('raider');
    expect(unitLookOf(null, setup, 1)).toBe(null);
    expect(unitLookOf(null, setupOf(), 0)).toBe(null);
  });
});
