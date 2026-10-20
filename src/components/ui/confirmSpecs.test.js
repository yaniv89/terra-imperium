// src/components/ui/confirmSpecs.test.js
// H-08: declaring war and changing a law show a card first; the war card names the real opinion hit.
import { describe, it, expect } from 'vitest';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';
import { gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { opinionOf } from '../../engine/opinion';
import { declareWarConfirm, changeLawConfirm } from './confirmSpecs';

const world = peoplesWorld({ seed: 7 });
const me = world.playerNationId;
const foe = rivalOf(world, 0);

describe('two-step confirms (H-08)', () => {
  it('the war card shows the cost and the opinion hit the reducer really causes', () => {
    const metFoe = world.fog ? { fog: { ...world.fog, met: { ...world.fog.met, [me]: { ...world.fog.met?.[me], [foe]: true } } } } : {};
    const s = { ...world, ...metFoe, resources: { ...world.resources, gold: 5000, dip: 50, adm: 50, mil: 50 } };
    const card = declareWarConfirm(s, foe);
    expect(card.title).toMatch(/^Declare war on /);
    expect(card.confirmLabel).toBe('Declare war');
    const [cost, opinion] = card.rows;
    expect(cost.value).toMatch(/\d/);
    const after = gameReducer(s, { type: ActionTypes.DECLARE_WAR, payload: { nationId: foe } });
    expect(opinion.value).toBe(`${opinionOf(s, foe)} to ${opinionOf(after, foe)}`);
    expect(opinionOf(after, foe)).toBeLessThan(opinionOf(s, foe));
    expect(card.rows[1].tone).toBe('bad');
    expect(card.notes.length).toBeGreaterThan(0);
  });
  it('builds no card for a nation already at war, the player or an unknown people', () => {
    expect(declareWarConfirm(world, me)).toBeNull();
    expect(declareWarConfirm(world, 'nobody')).toBeNull();
  });
  it('the law card shows the cost and the new effect, and nothing for an unknown law', () => {
    const card = changeLawConfirm(world, 'taxation', 'land_tax', { adm: 100 });
    expect(card.title).toContain('Land Tax');
    expect(card.rows.map((r) => r.label)).toEqual(expect.arrayContaining(['Cost', 'After']));
    expect(changeLawConfirm(world, 'taxation', 'nope', { adm: 1 })).toBeNull();
  });
});
