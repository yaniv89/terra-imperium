// src/engine/opinion.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { opinionOf, opinionReasons, warRollOpinionMult, opinionGivesCasusBelli } from './opinion';
import { OPINION_BASELINE, GRUDGE_PER_HOSTILITY, ALLIANCE, RIVAL, SETTLED_NEAR, HOLDS_MY_CULTURE } from '../data/opinion';
import { hasCasusBelli } from './diplomacy';
import { addCity } from './testWorld';

const S = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
const reason = (list, id) => list.find((r) => r.id === id);

describe('opinion', () => {
  it('starts at the baseline, carries the grudge, and reproduces the old war roll with no map reasons', () => {
    const plain = { playerNationId: 'fr', nations: { fr: { id: 'fr' }, de: { id: 'de', hostility: 10 } }, regions: {} };
    expect(opinionOf(plain, 'de')).toBe(OPINION_BASELINE - GRUDGE_PER_HOSTILITY * 10);
    expect(warRollOpinionMult(opinionOf(plain, 'de'))).toBeCloseTo(10 / 100 + 0.2, 6);
    const hot = { ...plain, nations: { ...plain.nations, de: { id: 'de', hostility: 100 } } };
    expect(warRollOpinionMult(opinionOf(hot, 'de'))).toBeCloseTo(1.2, 6);
    expect(opinionGivesCasusBelli(opinionOf(hot, 'de'))).toBe(true);
    expect(hasCasusBelli(hot, 'fr', 'de')).toBe(true);
    expect(opinionOf(plain, 'de')).toBe(opinionOf(plain, 'de')); // cached
  });

  it('a friend never rolls for war; a rival and a claim rub', () => {
    const allied = { ...S, nations: { ...S.nations, be: { ...S.nations.be, hasMilitaryPact: true } } };
    expect(reason(opinionReasons(allied, 'be'), 'alliance').value).toBe(ALLIANCE);
    expect(warRollOpinionMult(opinionOf(allied, 'be'))).toBe(0);
    const rival = { ...S, nations: { ...S.nations, fr: { ...S.nations.fr, rivals: ['be'], claims: ['be'] } } };
    const rs = opinionReasons(rival, 'be');
    expect(reason(rs, 'rival').value).toBe(RIVAL);
    expect(reason(rs, 'claim').value).toBeLessThan(0);
    expect(opinionOf(rival, 'be')).toBeLessThan(opinionOf(S, 'be'));
  });

  it('reads the map: shared borders, settling next to a city, holding my people\'s city', () => {
    // Belgium and France touch at Dawn (their capitals' rings meet).
    const be = opinionReasons(S, 'be');
    const borders = reason(be, 'borders');
    if (borders) expect(borders.value).toBeLessThan(0);
    // France founds a city beside Brussels: Belgium resents it, fading over the turns.
    const { state: s2, cityId } = addCity({ ...S, turnNumber: 10 }, 'fr', { near: getNationCapital('be') });
    const settled = reason(opinionReasons(s2, 'be'), 'settledNear');
    expect(settled).toBeDefined();
    expect(settled.value).toBe(SETTLED_NEAR);
    const later = { ...s2, turnNumber: 20 };
    expect(reason(opinionReasons(later, 'be'), 'settledNear').value).toBe(SETTLED_NEAR + 10);
    // That city flips to Belgium: France's people under Belgian rule.
    const taken = { ...s2, regions: { ...s2.regions, [cityId]: { ...s2.regions[cityId], owner: 'be' } } };
    expect(reason(opinionReasons(taken, 'fr', 'be'), 'myPeople').value).toBe(HOLDS_MY_CULTURE);
  });
});
