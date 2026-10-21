// U23: granting a card through an event choice, and its life span in reference turns.
import { describe, expect, it } from 'vitest';
import { applyEventEffects } from '../engine/applyEventEffects';
import { activeCards, grantBattleCard } from './battleCards';
import { peoplesWorld } from '../engine/testWorld';

describe('U23 battle cards', () => {
  const s = peoplesWorld({ seed: 7 });
  const P = s.playerNationId;

  it('an event option with effects.battleCard grants it to the player with an expiry', () => {
    const event = { id: 'x', options: [{ label: 'Pay the guide', effects: { battleCard: 'scouted' } }] };
    const next = applyEventEffects(s, event, 0);
    const [card] = next.nations[P].battleCards;
    expect(card.id).toBe('scouted');
    expect(card.expires).toBeGreaterThan(s.turnNumber);
    expect(activeCards(next.nations[P], s.turnNumber)).toHaveLength(1);
    expect(activeCards(next.nations[P], card.expires + 1)).toHaveLength(0);
  });

  it('a second grant of one kind renews it; an unknown card changes nothing', () => {
    const once = grantBattleCard(s.nations[P], 'traitor', { turn: 1, speed: s.gameSpeed, age: 'stone' });
    const twice = grantBattleCard(once, 'traitor', { turn: 9, speed: s.gameSpeed, age: 'stone' });
    expect(twice.battleCards).toHaveLength(1);
    expect(twice.battleCards[0].expires).toBeGreaterThan(once.battleCards[0].expires);
    expect(grantBattleCard(once, 'nope', { turn: 1 })).toBe(once);
  });
});
