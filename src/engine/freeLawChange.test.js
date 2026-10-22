// Report rank 11: each age advance grants one law change for no decree (nation.freeLawChange).
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { LAW_CATEGORIES, canEnactLaw, lawChangeCost } from '../data/laws';
import { ACTION_COSTS } from '../data/actionCosts';
import { neighbourWorld } from './testWorld';
import { pickAILaw } from './aiEconomy';

const S = neighbourWorld({ seed: 11 });
const ME = S.playerNationId;
const enactable = (s, skip = null) => Object.entries(LAW_CATEGORIES).flatMap(([c, laws]) => laws.map((l) => [c, l.id])).find(([c, id]) => c !== skip && canEnactLaw(s, ME, c, id));
const withFree = (s, id = ME) => ({ ...s, nations: { ...s.nations, [id]: { ...s.nations[id], freeLawChange: true, ruler: { ...s.nations[id].ruler, decrees: 0 } } } });

describe('free law change at an age advance (rank 11)', () => {
  it('costs nothing while the nation holds it, a decree otherwise', () => {
    expect(lawChangeCost({ freeLawChange: true })).toEqual({});
    expect(lawChangeCost({})).toBe(ACTION_COSTS.changeLaw);
  });

  it('the player changes one law with no decree, then the next one costs a decree again', () => {
    const s = withFree(S);
    const [category, lawId] = enactable(s);
    const done = gameReducer(s, { type: ActionTypes.CHANGE_LAW, payload: { category, lawId } });
    expect(done.nations[ME].laws[category]).toBe(lawId);
    expect(done.nations[ME].freeLawChange).toBe(false);
    expect(done.nations[ME].ruler.decrees).toBe(0);
    const next = enactable(done, category);
    if (next) expect(gameReducer(done, { type: ActionTypes.CHANGE_LAW, payload: { category: next[0], lawId: next[1] } })).toBe(done);
  });

  it('an AI with no decree may still pick a law while it holds the free change', () => {
    const ai = Object.keys(S.nations).find((id) => id !== ME && S.nations[id].economy && S.nations[id].ruler);
    const broke = { ...S.nations[ai], ruler: { ...S.nations[ai].ruler, decrees: 0 } };
    expect(pickAILaw(S, ai, broke)).toBeNull();
    const free = withFree(S, ai);
    expect(pickAILaw(free, ai, free.nations[ai])).not.toBeNull();
  });
});
