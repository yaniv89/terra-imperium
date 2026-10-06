// src/components/battle/peaceDealModel.test.js
// W13 Peace deal: the demands come with their cost and, live, accept or "N short" from the
// engine's own ledger; the counter-offer fits what they give; the war score is from your side.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { addCity } from '../../engine/testWorld';
import { getPeaceAcceptance } from '../../engine/peace';
import { peaceDealModel, peaceCandidates } from './peaceDealModel';

const WORLD = (() => {
  const first = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 2 }), 'fr');
  const foe = addCity(first.state, 'de', { near: first.cityId });
  return { state: foe.state, foeCity: foe.cityId };
})();

const atWar = (battleScore = 30) => {
  const s = WORLD.state;
  const war = { id: 'w13', aggressor: 'fr', enemy: 'de', active: true, startTurn: Math.max(0, s.turnNumber - 9), battleScore, tickScore: 0, score: battleScore, cb: 'none', goal: null };
  return {
    ...s,
    wars: [...s.wars, war],
    regions: { ...s.regions, [WORLD.foeCity]: { ...s.regions[WORLD.foeCity], occupiedBy: 'fr' } },
    nations: { ...s.nations, de: { ...s.nations.de, warExhaustion: 40 } }
  };
};

describe('W13 peaceDealModel', () => {
  it('lists the occupied city, gold and the other terms with their costs', () => {
    const s = atWar();
    const c = peaceCandidates(s, s.wars.at(-1));
    expect(c[0]).toMatchObject({ group: 'land', key: `cede:${WORLD.foeCity}` });
    expect(c.every((x) => Number.isFinite(x.cost) && x.cost > 0)).toBe(true);
    expect(c.some((x) => x.key === 'reparations')).toBe(true);
  });

  it('says live whether they accept, from the same ledger as the engine', () => {
    const s = atWar();
    const m0 = peaceDealModel(s, 'w13', new Set());
    expect(m0.score).toBeGreaterThan(0);
    expect(m0.scoreParts.find((p) => p.id === 'battles').value).toBe(30);
    expect(m0.exhaustion.theirs).toBe(40);
    const all = new Set(m0.rows.map((r) => r.key).filter((k) => !k.startsWith('gold:') || k === 'gold:500'));
    const m = peaceDealModel(s, 'w13', all);
    const engine = getPeaceAcceptance(s, s.wars.at(-1), 'fr', m.terms);
    expect(m.accepted).toBe(engine.accepted);
    expect(m.willingness).toBe(engine.total);
    if (!m.accepted) {
      expect(m.short).toBe(engine.cost - engine.total);
      expect(m.rows.filter((r) => r.on).every((r) => /^Refuses: too much, \d+ short$/.test(r.status))).toBe(true);
    }
  });

  it('the counter-offer fits within what they give', () => {
    const s = atWar(60);
    const m = peaceDealModel(s, 'w13', new Set());
    expect(m.counter).not.toBeNull();
    expect(m.counter.worth).toBeLessThanOrEqual(m.counter.budget);
    const loaded = peaceDealModel(s, 'w13', new Set(m.counter.keys));
    expect(loaded.accepted).toBe(true);
  });
});
