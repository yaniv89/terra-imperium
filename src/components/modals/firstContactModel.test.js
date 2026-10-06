import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { metNations } from '../../engine/fog';
import { isIndependentNation } from '../../data/independents';
import { newContacts, contactCard, moodWord } from './firstContactModel';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const me = base.playerNationId;

describe('first contact (W03)', () => {
  it('lists majors met since the last look, never independents or the player', () => {
    const known = new Set(metNations(base));
    expect(newContacts(base, known)).toEqual([]);
    const stranger = Object.keys(base.nations).find((id) => id !== me && !known.has(id) && !isIndependentNation(base.nations[id]) && base.nations[id].capitalRegionId);
    const indep = Object.keys(base.nations).find((id) => !known.has(id) && isIndependentNation(base.nations[id]));
    const met = { ...base.fog.met, [me]: { ...(base.fog.met?.[me] || {}), [stranger]: 2, ...(indep ? { [indep]: 2 } : {}) } };
    const s = { ...base, fog: { ...base.fog, met } };
    expect(newContacts(s, known)).toEqual([stranger]);
    expect(newContacts({ ...s, fog: { ...s.fog, on: false } }, known)).toEqual([]);
  });

  it('describes the people met: title, capital, mood, cities seen, border', () => {
    const other = Object.keys(base.nations).find((id) => id !== me && !isIndependentNation(base.nations[id]) && base.nations[id].capitalRegionId);
    const card = contactCard(base, other);
    expect(card).toMatchObject({ id: other, title: base.nations[other].name });
    expect(card.capital).toBe(base.regions[base.nations[other].capitalRegionId].name);
    expect(typeof card.mood).toBe('string');
    expect(card.citiesSeen).toBeGreaterThanOrEqual(0);
    expect(card.border).toBeGreaterThanOrEqual(0);
    expect(contactCard(base, 'nobody')).toBeNull();
  });

  it('names the mood in bands', () => {
    expect(moodWord(50)).toBe('Friendly');
    expect(moodWord(25)).toBe('Warm');
    expect(moodWord(0)).toBe('Wary');
    expect(moodWord(-30)).toBe('Cold');
    expect(moodWord(-60)).toBe('Hostile');
  });
});
