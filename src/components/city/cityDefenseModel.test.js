import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { cityManifestOf, cityHousingCap } from '../../engine/cityManifest';
import { cityDefenseModel } from './cityDefenseModel';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const cap = base.nations[base.playerNationId].capitalRegionId;

describe('the city sheet Defense tab (W05)', () => {
  it('explains the battle housing line by line and adds up to the cap', () => {
    const m = cityDefenseModel(base, cap);
    const manifest = cityManifestOf(base, cap);
    expect(m.housing).toBe(cityHousingCap(base, cap, manifest));
    expect(m.lines.map((l) => l.id)).toEqual(['houses', 'townhall']);
    expect(m.lines.reduce((s, l) => s + l.value, 0)).toBe(m.housing);
    expect(m.alert).toBeNull();
  });

  it('counts ruined houses out and says when the damage is repaired', () => {
    const manifest = cityManifestOf(base, cap);
    const [h0, h1] = manifest.structures.filter((s) => s.kind === 'house');
    const s = { ...base, regions: { ...base.regions, [cap]: { ...base.regions[cap], cityDamage: { ruined: { [h0.id]: 5, [h1.id]: 7 }, damaged: { townhall: 2 } } } } };
    const m = cityDefenseModel(s, cap);
    expect(m.lines.find((l) => l.id === 'ruined')).toMatchObject({ value: -(h0.housing + h1.housing) });
    expect(m.lines.reduce((sum, l) => sum + l.value, 0)).toBe(m.housing);
    expect(m.alert).toMatchObject({ ruined: 2, damaged: 1, rebuiltIn: 7, repairedIn: 2, paused: false });
    expect(m.alert.text).toBe('2 houses ruined, rebuilt in 7 turns; 1 damaged, repaired in 2 turns');
    const sieged = { ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], siege: { by: 'elam', hp: 10, maxHp: 20 } } } };
    expect(cityDefenseModel(sieged, cap).alert.text).toMatch(/paused: under siege/);
  });
});
