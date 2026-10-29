import { describe, it, expect } from 'vitest';
import { setEraFocus, canRefocus, ERA_FOCUS_PICKS } from './eraGoals';
import { eraDawnCard } from './eventDeck';
import { peoplesWorld } from './testWorld';

// The player in `age` with the age's record `rec`.
const at = (age, rec) => {
  const S = peoplesWorld({ seed: 3, age });
  const me = S.playerNationId;
  return { ...S, nations: { ...S.nations, [me]: { ...S.nations[me], eraGoals: { [age]: rec } } } };
};

describe('chained era goals in the last three ages (lead 29 Oct)', () => {
  it('a met focus brings a new pick in the Modern age, up to three an age', () => {
    const s = at('modern', { met: ['expand'], focus: 'expand', picks: 1 });
    const card = eraDawnCard(s);
    expect(card).toMatchObject({ templateId: 'era_next', historyKey: 'dawn:modern:1' });
    expect(card.options.map((o) => o.effects.eraFocus)).not.toContain('expand');
    const me = s.playerNationId;
    const next = setEraFocus(s.nations[me], 'modern', card.options[0].effects.eraFocus);
    expect(next.eraGoals.modern).toMatchObject({ focus: card.options[0].effects.eraFocus, picks: 2 });
    expect(canRefocus({ met: ['expand', 'wealth'], focus: 'wealth', picks: ERA_FOCUS_PICKS }, 'modern')).toBe(false);
    expect(eraDawnCard({ ...s, eventHistory: { 'dawn:modern:1': 5 } })).toBe(null);
  });

  it('not before the Modern age, and not while the focus is open', () => {
    expect(eraDawnCard(at('gunpowder', { met: ['expand'], focus: 'expand' }))).toBe(null);
    expect(eraDawnCard(at('modern', { met: [], focus: 'expand' }))).toBe(null);
  });
});
