import { describe, it, expect } from 'vitest';
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNeighborIds } from '../data/regions';
import { MEN_PER_STRENGTH } from './aftermath';
import { recordBattleReport, BATTLE_REPORT_HISTORY } from './battleReports';
import { atGates } from './testWorld';

const unit = (id, classId, strength) => ({ id, classId, strength, maxStrength: strength, morale: 100, domain: 'land' });
const sum = (units) => units.reduce((s, u) => s + Math.max(0, u.strength), 0);

describe('resolveBattle timeline', () => {
  it('starts at the starting strengths, ends at the final ones, and never rises', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const r = resolveBattle({
        attackerUnits: [unit('a1', 'infantry', 600), unit('a2', 'cavalry', 400), unit('a3', 'ranged', 300)],
        defenderUnits: [unit('d1', 'infantry', 700), unit('d2', 'ranged', 300)],
        terrain: 'mixed', isAttackingFortification: false, rng: createRng(seed)
      });
      const t = r.report.timeline;
      expect(t[0]).toMatchObject({ round: 0, att: 1300, def: 1000 });
      const last = t[t.length - 1];
      expect(last.att).toBe(Math.round(sum(r.attackerUnits)));
      expect(last.def).toBe(Math.round(sum(r.defenderUnits)));
      for (let i = 1; i < t.length; i++) {
        expect(t[i].att).toBeLessThanOrEqual(t[i - 1].att);
        expect(t[i].def).toBeLessThanOrEqual(t[i - 1].def);
      }
    }
  });
});

describe('battle report history', () => {
  const invade = () => {
    let state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const from = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && getNeighborIds(id).some((n) => state.regions[n]?.owner === 'de'));
    const target = getNeighborIds(from).find((n) => state.regions[n]?.owner === 'de');
    state = {
      ...state,
      wars: [{ id: 'w', aggressor: 'fr', enemy: 'de', active: true, score: 0 }],
      resources: { ...state.resources, gold: 10000, mil: 1000 },
      units: {
        a1: { ...unit('a1', 'infantry', 1000), ownerId: 'fr', regionId: from, movesLeft: 1 },
        a2: { ...unit('a2', 'cavalry', 800), ownerId: 'fr', regionId: from, movesLeft: 1 },
        d1: { ...unit('d1', 'infantry', 600), ownerId: 'de', regionId: target, movesLeft: 1 }
      }
    };
    state = atGates(state, from, target); // the attack needs touching lands or an army beside the city
    return { state, next: gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: from, targetRegionId: target } }), from, target };
  };

  it('an auto-resolved invasion adds one entry with each side and the soldiers who fell', () => {
    const { state, next, target } = invade();
    expect(next.battleReports).toHaveLength(1);
    const e = next.battleReports[0];
    expect(e).toMatchObject({ targetRegionId: target, attackerNationId: 'fr', defenderNationId: 'de', playerSide: 'attacker', commanded: false, turn: state.turnNumber });
    expect(e.outcome).toBe(next.lastBattleReport.outcome);
    expect(e.sides.attacker.map((u) => u.id).sort()).toEqual(['a1', 'a2']);
    expect(e.sides.defender.map((u) => u.before)).toEqual([600]);
    const lostA = e.sides.attacker.reduce((s, u) => s + u.before - u.after, 0);
    expect(e.fallen.attacker).toBe(lostA * MEN_PER_STRENGTH);
    expect(e.timeline[0]).toMatchObject({ att: 1800, def: 600 });
  });

  it('keeps only the newest entries', () => {
    let state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const report = { outcome: 'attacker', attackerNationId: 'fr', defenderNationId: 'de' };
    for (let i = 0; i < BATTLE_REPORT_HISTORY + 5; i++) state = { ...state, ...recordBattleReport(state, report, { attackers: [], defenders: [] }) };
    expect(state.battleReports).toHaveLength(BATTLE_REPORT_HISTORY);
    expect(state.battleReports[0].id).toBe(`battle-${BATTLE_REPORT_HISTORY + 5}`);
  });
});
