import { describe, it, expect } from 'vitest';
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNeighborIds } from '../data/regions';
import { MEN_PER_STRENGTH } from './aftermath';
import { recordBattleReport, BATTLE_REPORT_HISTORY, unitFate, FATES } from './battleReports';
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
    // The garrison and the city's militia (battleInputs.js, master plan 6.7 row 19).
    const militia = e.sides.defender.filter((u) => u.id.startsWith('mil_'));
    expect(e.sides.defender.find((u) => u.id === 'd1').before).toBe(600);
    expect(militia.length).toBeGreaterThan(0);
    const militiaStart = militia.reduce((s, u) => s + u.before, 0);
    const lostA = e.sides.attacker.reduce((s, u) => s + u.before - u.after, 0);
    expect(e.fallen.attacker).toBe(lostA * MEN_PER_STRENGTH);
    expect(e.timeline[0]).toMatchObject({ att: 1800, def: 600 + militiaStart });
    expect(e.name).toMatch(/^Siege of /);
  });

  it('keeps only the newest entries', () => {
    let state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const report = { outcome: 'attacker', attackerNationId: 'fr', defenderNationId: 'de' };
    for (let i = 0; i < BATTLE_REPORT_HISTORY + 5; i++) state = { ...state, ...recordBattleReport(state, report, { attackers: [], defenders: [] }) };
    expect(state.battleReports).toHaveLength(BATTLE_REPORT_HISTORY);
    expect(state.battleReports[0].id).toBe(`battle-${BATTLE_REPORT_HISTORY + 5}`);
  });
});

describe('unit fates in the report', () => {
  it('maps each unit to one fate', () => {
    expect(unitFate({ strength: 0 }, { loser: false })).toBe('fellFighting');
    expect(unitFate({ strength: -3 }, { loser: true, gone: true })).toBe('fellFighting');
    expect(unitFate({ strength: 50 }, { loser: false })).toBe('held');
    expect(unitFate({ strength: 50, routed: true }, { loser: false })).toBe('pulledBack');
    expect(unitFate({ strength: 50 }, { loser: true })).toBe('withdrew');
    expect(unitFate({ strength: 50, routed: true }, { loser: true })).toBe('escaped');
    expect(unitFate({ strength: 50, routed: true }, { loser: true, gone: true })).toBe('runDown');
    expect(unitFate({ strength: 50 }, { loser: true, gone: true })).toBe('runDown');
    expect(FATES).toHaveLength(6);
  });

  it('records fates, men before and after, and cavalry pursuit', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const report = { outcome: 'attacker', attackerNationId: 'fr', defenderNationId: 'de' };
    const attackers = [{ id: 'c', classId: 'cavalry', strength: 300 }, { id: 'i', classId: 'infantry', strength: 200, routed: true, regiment: 3 }];
    const defenders = [
      { id: 'd0', classId: 'infantry', strength: 0, disposition: 'dead' },
      { id: 'd1', classId: 'infantry', strength: 120, routed: true, disposition: 'field' },
      { id: 'd2', classId: 'ranged', strength: 90, routed: true, disposition: 'fled' },
      { id: 'd3', classId: 'infantry', strength: 150, disposition: 'fled' }
    ];
    const before = { c: 400, i: 400, d0: 500, d1: 500, d2: 300, d3: 400 };
    const out = recordBattleReport(state, report, { attackers, defenders, beforeOf: (u) => before[u.id], goneIds: new Set(['d1']) });
    const e = out.battleReports[0];
    expect(e.sides.attacker.map((u) => u.fate)).toEqual(['held', 'pulledBack']);
    expect(e.sides.attacker[1]).toMatchObject({ regiment: 3, before: 400, after: 200 });
    expect(e.sides.defender.map((u) => u.fate)).toEqual(['fellFighting', 'runDown', 'escaped', 'withdrew']);
    expect(e.sides.defender[1].byCavalry).toBe(true);
    expect(e.sides.defender[2].byCavalry).toBeUndefined();
    // Without the outcome service's list, a loser still on the field counts as run down.
    const plain = recordBattleReport(state, report, { attackers: attackers.slice(1), defenders, beforeOf: (u) => before[u.id] }).battleReports[0];
    expect(plain.sides.defender[1]).toMatchObject({ fate: 'runDown', byCavalry: undefined });
    // A stalemate has no loser: everyone held or pulled back.
    const draw = recordBattleReport(state, { ...report, outcome: 'stalemate' }, { attackers, defenders, beforeOf: (u) => before[u.id] }).battleReports[0];
    expect(draw.sides.defender.map((u) => u.fate)).toEqual(['fellFighting', 'pulledBack', 'pulledBack', 'held']);
  });
});
