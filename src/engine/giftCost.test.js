// A gift (playtest 22 Oct): the card's price (NationCard reads ACTION_COSTS.giftBribe) is what the
// reducer takes. An independent is never sent a major's gift: its own sheet has GIFT_INDEPENDENT.
import { it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { ACTION_COSTS } from '../data/actionCosts';
import { peoplesWorld, rivalOf } from './testWorld';

const W = peoplesWorld({ seed: 5 });
const ME = W.playerNationId;
const met = (s, b) => ({ ...s, fog: { ...s.fog, met: { ...s.fog.met, [ME]: { ...(s.fog.met?.[ME] || {}), [b]: 1 }, [b]: { ...(s.fog.met?.[b] || {}), [ME]: 1 } } } });
const rich = { ...W, resources: { ...W.resources, gold: 1000 } };

it('a gift to a people takes the price its button shows', () => {
  const other = rivalOf(W);
  const s = met(rich, other);
  const next = gameReducer(s, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: other } });
  expect(s.resources.gold - next.resources.gold).toBe(ACTION_COSTS.giftBribe.gold);
  expect(next.nations[other].hostility).toBeLessThan(s.nations[other].hostility);
});

it('a major\'s gift to an independent is refused and costs nothing', () => {
  const indep = Object.keys(W.nations).find((id) => W.nations[id].kind === 'independent');
  const s = met(rich, indep);
  const next = gameReducer(s, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: indep } });
  expect(next.resources.gold).toBe(s.resources.gold);
});
