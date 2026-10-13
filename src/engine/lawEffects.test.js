import { describe, it, expect } from 'vitest';
import { LAW_CATEGORIES } from '../data/laws';
import { lawEffectLines, unappliedKeys, checkLawText } from './lawEffects';

describe('law effects shown to the player', () => {
  it('every effect and rule key of every law is applied by the engine', () => {
    Object.values(LAW_CATEGORIES).flat().forEach((law) => expect(unappliedKeys(law), law.id).toEqual([]));
  });

  it('wording comes from the data', () => {
    const law = Object.values(LAW_CATEGORIES).flat().find((l) => l.id === 'mass_conscription');
    const text = lawEffectLines(law).map((l) => l.text).join('; ');
    expect(text).toContain('+60% manpower');
    expect(text).toContain('+2 unrest');
    expect(text).toContain('army upkeep -10%');
    expect(text).toContain('war exhaustion rises 20% slower');
  });

  // The hand-written descriptions in src/data/laws.js must agree with the data the engine applies
  // (private_property and collectivization used to say "production" for a gold multiplier).
  it('every written description agrees with the data', () => {
    expect(checkLawText()).toEqual([]);
    const all = Object.values(LAW_CATEGORIES).flat();
    all.filter((l) => l.effects?.goldMult).forEach((l) => expect(l.description, l.id).not.toMatch(/production/i));
    const byId = Object.fromEntries(all.map((l) => [l.id, l]));
    expect(byId.private_property.description).toContain('+15% gold income');
    expect(byId.collectivization.description).toContain('+25% gold income');
  });
});
