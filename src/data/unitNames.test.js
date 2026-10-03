import { describe, it, expect } from 'vitest';
import { unitDisplayName, unitClassLabel } from './unitNames';
import { UNIT_ROSTER } from './unitClasses';

describe('unit names (plan P5.2)', () => {
  it('prints the roster name of the age, never the class', () => {
    expect(unitDisplayName('bronze', 'infantry')).toBe('Spearmen');
    expect(unitDisplayName('bronze', 'cavalry')).toBe('Chariots');
    expect(unitDisplayName('kingdoms', 'ranged')).toBe('Longbowmen');
    expect(unitDisplayName('modern', 'air')).toBe('Fighter Jet');
    expect(unitDisplayName('classical', 'naval', 'raider')).toBe('Bireme');
    expect(unitDisplayName('gunpowder', 'naval')).toBe('Frigate');
    expect(unitDisplayName('bronze', 'settler')).toBe('Settlers');
    expect(unitClassLabel('infantry')).toBe('Infantry');
    Object.entries(UNIT_ROSTER).forEach(([age, classes]) => Object.keys(classes).forEach((c) => expect(unitDisplayName(age, c)).not.toMatch(/^(Infantry|Cavalry|Ranged|Siege|Support|Air)$/)));
  });
});
