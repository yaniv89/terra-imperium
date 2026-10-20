// src/components/battle/peaceDealModel.test.js
// W13 Peace deal: the demands come with their cost and, live, accept or "N short" from the
// engine's own ledger; the counter-offer fits what they give; the war score is from your side.
import { describe, expect, it } from 'vitest';
import { addCity } from '../../engine/testWorld';
import { getPeaceAcceptance } from '../../engine/peace';
import { peaceDealModel, peaceCandidates, peaceOfferModel, refusalReason } from './peaceDealModel';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 2, age: 'bronze' });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

const WORLD = (() => {
  const first = addCity(peoplesWorld({ seed: 2, age: 'bronze' }), FR_ID);
  const foe = addCity(first.state, DE_ID, { near: first.cityId });
  return { state: foe.state, foeCity: foe.cityId };
})();

const atWar = (battleScore = 30) => {
  const s = WORLD.state;
  const war = { id: 'w13', aggressor: FR_ID, enemy: DE_ID, active: true, startTurn: Math.max(0, s.turnNumber - 9), battleScore, tickScore: 0, score: battleScore, cb: 'none', goal: null };
  return {
    ...s,
    wars: [...s.wars, war],
    regions: { ...s.regions, [WORLD.foeCity]: { ...s.regions[WORLD.foeCity], occupiedBy: FR_ID } },
    nations: { ...s.nations, [DE_ID]: { ...s.nations[DE_ID], warExhaustion: 40 } }
  };
};

describe('PEACE-01/02 the offer says what it does', () => {
  it('a refused white peace gives willingness, price and reasons, not "they are winning"', () => {
    const s = atWar(0);
    const m = peaceDealModel(s, 'w13', new Set());
    if (!m.whitePeace.accepted) {
      expect(m.whitePeace.text).toMatch(/willingness is -?[0-9]+ and the price is [0-9]+/);
      expect(m.whitePeace.text).not.toMatch(/winning/);
    }
    expect(refusalReason({ total: -4, cost: 5, breakdown: [{ label: 'Capital secure', value: -10 }, { label: 'War situation', value: 0 }] })).toMatch(/capital secure -10/);
  });

  it('a reparations offer lists the city that stays theirs, the payment and the truce end turn', () => {
    const s0 = atWar(0);
    const war = s0.wars.at(-1);
    // They hold a city they took from us in this war.
    const mine = Object.values(s0.regions).find((r) => r.owner === FR_ID);
    const s = { ...s0, regions: { ...s0.regions, [mine.id]: { ...mine, owner: DE_ID, conquest: { warId: war.id, from: FR_ID } } } };
    const offer = { from: DE_ID, warId: war.id, terms: [{ type: 'reparations' }] };
    const m = peaceOfferModel(s, offer);
    expect(m.ownership.some((t) => /stays/.test(t))).toBe(true);
    expect(m.money[0]).toMatch(/reparations/);
    expect(m.truceEndsTurn).toBeGreaterThan(s.turnNumber);
    expect(m.themWinning).toBe(m.score < 0);
  });
});

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
    const engine = getPeaceAcceptance(s, s.wars.at(-1), FR_ID, m.terms);
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
