// src/engine/opinion.test.js
import { describe, it, expect } from 'vitest';
import { getNationCapital } from '../data/regions';
import { opinionOf, opinionReasons, warRollOpinionMult, opinionGivesCasusBelli } from './opinion';
import { OPINION_BASELINE, GRUDGE_PER_HOSTILITY, ALLIANCE, RIVAL, SETTLED_NEAR, HOLDS_MY_CULTURE, DIPLOMAT_AT_COURT } from '../data/opinion';
import { hasCasusBelli } from './diplomacy';
import { addCity } from './testWorld';
import { peoplesWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);
const BE_ID = rivalOf(PEOPLES_WORLD, 1);

const S = peoplesWorld({ seed: 3 });
const reason = (list, id) => list.find((r) => r.id === id);

describe('opinion', () => {
  it('starts at the baseline, carries the grudge, and reproduces the old war roll with no map reasons', () => {
    const plain = { playerNationId: FR_ID, nations: { [FR_ID]: { id: FR_ID }, [DE_ID]: { id: DE_ID, hostility: 10 } }, regions: {} };
    expect(opinionOf(plain, DE_ID)).toBe(OPINION_BASELINE - GRUDGE_PER_HOSTILITY * 10);
    expect(warRollOpinionMult(opinionOf(plain, DE_ID))).toBeCloseTo(10 / 100 + 0.2, 6);
    const hot = { ...plain, nations: { ...plain.nations, [DE_ID]: { id: DE_ID, hostility: 100 } } };
    expect(warRollOpinionMult(opinionOf(hot, DE_ID))).toBeCloseTo(1.2, 6);
    expect(opinionGivesCasusBelli(opinionOf(hot, DE_ID))).toBe(true);
    expect(hasCasusBelli(hot, FR_ID, DE_ID)).toBe(true);
    expect(opinionOf(plain, DE_ID)).toBe(opinionOf(plain, DE_ID)); // cached
  });

  it('a diplomat at their court warms them and says so in the reasons (DIP-02)', () => {
    const task = { targetId: BE_ID, task: 'improve_relations', startedTurn: 25 };
    const posted = { ...S, nations: { ...S.nations, [FR_ID]: { ...S.nations[FR_ID], diplomatTasks: [task] } } };
    const r = reason(opinionReasons(posted, BE_ID), 'diplomat');
    expect(r.value).toBe(DIPLOMAT_AT_COURT);
    expect(r.detail).toBe('since turn 25');
    expect(opinionOf(posted, BE_ID)).toBe(opinionOf(S, BE_ID) + DIPLOMAT_AT_COURT);
    expect(reason(opinionReasons(posted, DE_ID), 'diplomat')).toBeUndefined();
  });

  it('a friend never rolls for war; a rival and a claim rub', () => {
    const allied = { ...S, nations: { ...S.nations, [BE_ID]: { ...S.nations[BE_ID], hasMilitaryPact: true } } };
    expect(reason(opinionReasons(allied, BE_ID), 'alliance').value).toBe(ALLIANCE);
    expect(warRollOpinionMult(opinionOf(allied, BE_ID))).toBe(0);
    const beCity = Object.values(S.regions).find((c) => c.owner === BE_ID).id;
    const rival = { ...S, nations: { ...S.nations, [FR_ID]: { ...S.nations[FR_ID], rivals: [BE_ID], claims: [beCity] } } };
    const rs = opinionReasons(rival, BE_ID);
    expect(reason(rs, 'rival').value).toBe(RIVAL);
    expect(reason(rs, 'claim').value).toBeLessThan(0);
    expect(opinionOf(rival, BE_ID)).toBeLessThan(opinionOf(S, BE_ID));
  });

  it('reads the map: shared borders, settling next to a city, holding my people\'s city', () => {
    // Belgium and France touch at Dawn (their capitals' rings meet).
    const be = opinionReasons(S, BE_ID);
    const borders = reason(be, 'borders');
    if (borders) expect(borders.value).toBeLessThan(0);
    // France founds a city beside Brussels: Belgium resents it, fading over the turns.
    const { state: s2, cityId } = addCity({ ...S, turnNumber: 10 }, FR_ID, { near: getNationCapital(BE_ID) });
    const settled = reason(opinionReasons(s2, BE_ID), 'settledNear');
    expect(settled).toBeDefined();
    expect(settled.value).toBe(SETTLED_NEAR);
    const later = { ...s2, turnNumber: 20 };
    expect(reason(opinionReasons(later, BE_ID), 'settledNear').value).toBe(SETTLED_NEAR + 10);
    // That city flips to Belgium: France's people under Belgian rule.
    const taken = { ...s2, regions: { ...s2.regions, [cityId]: { ...s2.regions[cityId], owner: BE_ID } } };
    expect(reason(opinionReasons(taken, FR_ID, BE_ID), 'myPeople').value).toBe(HOLDS_MY_CULTURE);
  });
});
