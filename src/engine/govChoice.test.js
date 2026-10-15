import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { GOVERNMENT_TYPES, canChangeGovernmentType } from '../data/government';
import { previewGovernmentChange } from './governmentPreview';
import { generateAdvisorCandidates, successionLine, courtNames } from './rulers';
import { createRng } from '../utils/rng';

const rich = () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 11 });
  return { ...s, resources: { ...s.resources, adm: 5000, gold: 5000 } };
};

describe('government change with chosen reforms (I140)', () => {
  it('lists the tiers and applies the player pick; nothing applies in the preview', () => {
    const s = rich();
    const nation = s.nations[s.playerNationId];
    const target = Object.keys(GOVERNMENT_TYPES).find((id) => canChangeGovernmentType(nation, id, s.age) && previewGovernmentChange(s, id).reformSlots?.some((x) => x.options.length > 1));
    if (!target) return;
    const pv = previewGovernmentChange(s, target);
    const slot = pv.reformSlots.find((x) => x.options.length > 1);
    const second = slot.options[1].id;
    const pv2 = previewGovernmentChange(s, target, { [slot.ageId]: second });
    expect(pv2.reformSlots.find((x) => x.ageId === slot.ageId).chosen).toBe(second);
    expect(s.nations[s.playerNationId].government.type).not.toBe(target);
    const next = gameReducer(s, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: target, reforms: { [slot.ageId]: second } } });
    expect(next.nations[s.playerNationId].government.reforms[slot.ageId]).toBe(second);
    const bogus = gameReducer(s, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: target, reforms: { [slot.ageId]: 'nope' } } });
    expect(bogus.nations[s.playerNationId].government.reforms[slot.ageId]).toBe(slot.options[0].id);
  }, 120000);
});

describe('court names and successions (I145, I147)', () => {
  it('advisor candidates never share a name with each other or the ruler', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateAdvisorCandidates('fr', createRng(seed), ['Zed']);
      const names = Object.values(c).flat().map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names).not.toContain('Zed');
    }
    expect(courtNames({ ruler: { name: 'A' }, advisors: { adm: { name: 'B' } } }, { adm: [{ name: 'C' }] })).toEqual(['A', 'B', 'C']);
  });

  it('one succession line names the old and the new ruler', () => {
    const line = successionLine({ name: 'Old', dynasty: 'X', reignStartTurn: 1 }, { name: 'New', dynasty: 'X', adm: 3, dip: 2, mil: 1, traits: [], reignStartTurn: 9 }).message;
    expect(line).toContain('Old of House X reigned 8 turns');
    expect(line).toContain('New of House X now rules');
  });
});
