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

  // The hand-written descriptions in src/data/laws.js must match the data the engine applies.
  // KNOWN: private_property and collectivization call a gold multiplier "production" (reported to
  // the user; the card shows the data-derived wording instead). A new drift fails this test.
  it('flags exactly the known description drift', () => {
    expect(checkLawText().map((p) => p.lawId).sort()).toEqual(['collectivization', 'private_property']);
  });
});
