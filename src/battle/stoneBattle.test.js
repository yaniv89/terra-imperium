// src/battle/stoneBattle.test.js
// Stone Age battles (eight ages plan, Phase C U37 to U40): the roster without horses, the guard on
// foot, Stone battle stats, and a Stone battle that plays to an end the same way twice.
import { describe, it, expect } from 'vitest';
import { getAvailableClasses, guardClassOf } from '../data/unitClasses';
import { getBattleStats } from './data/battleStats';
import { buildSetupFromArmies } from './setup/buildBattleSetup';
import { runHeadless } from './sim/headless';
import { createWorld } from './sim/world';
import { battleModelPairs } from './render/unitModels';
import { navalLinesFor } from '../data/navalLines';
import { buildableFor, buildingArt, ecoName, trainableRoles } from './data/economy';
import { ART } from './art/artFiles';
import { projectileFor } from './art/projectiles';
import { getBattlePowers } from '../engine/invasion';
import { replayBattle, replayUntil } from './sim/replay';
import { firePower } from './sim/effects';

const army = (prefix, classes, commanderId = null) => classes.map((classId, i) => ({
  id: `${prefix}${i}`, classId, strength: 800, maxStrength: 1000, morale: 100, promotions: [], commanderId: i === 0 ? commanderId : null, domain: 'land', xp: 0
}));
const stoneSetup = (seed, extra = {}) => buildSetupFromArmies({
  regionId: 'stone-test', terrain: 'forest', seed, attackerAgeId: 'stone', defenderAgeId: 'stone',
  attackerUnits: army('a', ['infantry', 'infantry', 'ranged', 'support'], 'g1'), defenderUnits: army('d', ['infantry', 'infantry', 'ranged']),
  generals: { g1: { id: 'g1', name: 'Chief', skill: 2 } }, controllers: ['ai', 'ai'], ...extra
});

describe('Stone roster and battle stats (U37)', () => {
  it('Stone has no cavalry and no air; its transports are dugout canoes', () => {
    expect(getAvailableClasses('stone')).not.toContain('cavalry');
    expect(getAvailableClasses('stone')).not.toContain('air');
    expect(navalLinesFor('stone')).toEqual(['transport']);
    expect(navalLinesFor('bronze')).toEqual(['warship']);
  });

  it("a Stone general's guard is infantry, a Bronze one's cavalry, and the model list follows", () => {
    expect(guardClassOf('stone')).toBe('infantry');
    expect(guardClassOf('bronze')).toBe('cavalry');
    const setup = stoneSetup(3);
    const w = createWorld(setup);
    expect(w.squads.find((q) => q.isGeneral).classId).toBe('infantry');
    expect(battleModelPairs(setup).map((p) => p.join(':'))).not.toContain('stone:cavalry');
  });

  it('Hunters shoot short and fast; a Warband loses heart faster; no Stone squad fights in ranks', () => {
    expect(getBattleStats('ranged', 'stone').range).toBeLessThan(getBattleStats('ranged', 'bronze').range);
    expect(getBattleStats('ranged', 'stone').attackTicks).toBeLessThan(getBattleStats('ranged', 'bronze').attackTicks);
    expect(getBattleStats('infantry', 'stone').moraleLoss).toBeGreaterThan(1);
    expect(getBattleStats('infantry', 'stone').noFormation).toBe(true);
    expect(getBattleStats('infantry', 'bronze').noFormation).toBeUndefined();
  });

  it('a Stone vs Stone battle runs to an end, the same way twice', () => {
    const a = runHeadless(stoneSetup(7));
    const b = runHeadless(stoneSetup(7));
    expect(a.world.ended).toBeTruthy();
    expect(a.hash).toBe(b.hash);
  });
});

describe('Stone battle economy and art (U38)', () => {
  it('trains no cavalry, offers no stable, and names its buildings', () => {
    expect(trainableRoles('stone')).not.toContain('cavalry');
    expect(buildableFor('stone')).not.toContain('stable');
    expect(ecoName('hall', 'stone')).toBe('Longhouse');
    expect(ecoName('hall', 'bronze')).toBe('Town hall');
  });

  it('every Stone building resolves to the Stone file', () => {
    buildableFor('stone').forEach((id) => expect(buildingArt(id, 'stone', (a) => ART.rts(a)?.ageId === a)?.file, id).toBe('rts-stone'));
  });

  it('Hunters loose arrows, a Warband throws javelins, a lookout slings stones; Stone crosses at a ford', () => {
    expect(projectileFor('ranged', 'stone')).toBe('arrow');
    expect(projectileFor('infantry', 'stone')).toBe('javelin');
    expect(projectileFor('tower', 'stone')).toBe('sling-stone');
    expect(ART.projectiles('stone')?.ageId).toBe('stone');
    expect(ART.bridge('stone')?.material).toBe('ford');
  });
});

describe('Stone commander powers (U39)', () => {
  const powers = [getBattlePowers(null, 'a', 'stone'), getBattlePowers(null, 'd', 'stone')];
  const setup = () => stoneSetup(5, { powers, controllers: ['player', 'ai'] });

  it('a Stone commander brings War Cry and Ambush; a Bronze one keeps Rally Cry and Arrow Storm', () => {
    expect(powers[0]).toEqual([{ id: 'rallyCry', label: 'War Cry' }, { id: 'ambush' }]);
    expect(getBattlePowers(null, 'a', 'bronze').map((p) => p.id)).toEqual(['rallyCry', 'arrowStorm']);
  });

  it('Ambush hides the troops around the aimed spot, and a battle with it replays to the same hash', () => {
    const w0 = createWorld(setup());
    const me = w0.squads.find((q) => q.side === 0 && !q.isGeneral);
    const log = [{ tick: 20, seq: 0, type: 'power', power: 'ambush', x: me.x, y: me.y }];
    const { world } = replayUntil(setup(), log, 21);
    expect(world.squads[me.idx].hiddenUntil).toBeGreaterThan(world.tick);
    const a = replayBattle(setup(), log);
    const b = replayBattle(setup(), log);
    expect(a.dropped).toBe(0);
    expect(a.hash).toBe(b.hash);
  });

  it('a side whose age has no Ambush cannot fire it', () => {
    const w = createWorld(buildSetupFromArmies({ regionId: 'bronze-test', terrain: 'plains', seed: 5, attackerAgeId: 'bronze', defenderAgeId: 'bronze',
      attackerUnits: army('a', ['infantry', 'ranged']), defenderUnits: army('d', ['infantry']), powers: [getBattlePowers(null, 'a', 'bronze'), []] }));
    w.supply[0] = 1000;
    expect(firePower(w, 0, 'ambush', 0, 0)).toBe(false);
  });
});
