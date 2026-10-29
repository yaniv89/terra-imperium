import { describe, it, expect } from 'vitest';
import { armyView } from './warModel';
import { unitName as unitDisplayName } from '../../i18n/gameText';

describe('armyView', () => {
  it('names each regiment by its own age: an old regiment in a newer army keeps its name (manual playtest 29 Oct)', () => {
    const v = armyView([{ classId: 'infantry', strength: 500, ageId: 'bronze' }, { classId: 'infantry', strength: 300 }], { ageId: 'kingdoms' });
    expect(v.lines.map((l) => l.name).sort()).toEqual([unitDisplayName('bronze', 'infantry'), unitDisplayName('kingdoms', 'infantry')].sort());
    expect(unitDisplayName('bronze', 'infantry')).not.toBe(unitDisplayName('kingdoms', 'infantry'));
  });
});
