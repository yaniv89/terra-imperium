// The march preview names why Auto fails and who stands near the city (newcomer playtest, round 3:
// "Hopeless: Sippar holds 1,600 men to your 10,000", then a battle at 8,590 against 20,000).
import { describe, expect, it } from 'vitest';
import { marchOddsText } from './marchOddsText';
import { MEN_PER_STRENGTH } from '../../engine/aftermath';

const s = (men) => men / MEN_PER_STRENGTH;
const base = { known: true, attackerStrength: s(10000), defenderStrength: s(1600), capture: 0, attacker: 0, standbyStrength: 0 };

describe('marchOddsText', () => {
  it('a militia-only city whose walls hold says so, with their HP', () => {
    const r = marchOddsText({ ...base, autoRule: 'attack', city: { hpBefore: 320, maxHp: 320, hpAfter: 278 } }, 'Sippar');
    expect(r.hopeless).toBe(true);
    expect(r.text).toMatch(/walls hold \(320 of 320 HP to about 278\)/);
  });
  it('a garrisoned city reads the battle win chance, not the capture Auto never makes', () => {
    const r = marchOddsText({ ...base, autoRule: 'garrison', attacker: 0.9 }, 'Sippar');
    expect(r.hopeless).toBe(false);
    expect(r.text).toMatch(/wins the battle 90%/);
  });
  it('names the enemy men seen standing near the city', () => {
    const r = marchOddsText({ ...base, capture: 0.8, standbyStrength: s(20000) }, 'Sippar');
    expect(r.text).toMatch(/20,000 more enemy men stand near it/);
  });
});
