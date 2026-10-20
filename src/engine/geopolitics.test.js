// src/engine/geopolitics.test.js
// Liberty desire read from the overlord's real weakness, AI independence ultimatums, technology
// diffusion along borders, and defensive pacts with a call to arms.
import { describe, it, expect } from 'vitest';
import { libertyDesireTarget, nextLibertyDesire, independenceChance, LD_RISE } from './vassals';
import { getTechDiffusion, withDiffusion, contactsOf, PIONEER_MULT, DIFFUSION_MAX, TRADE_CONTACT_WEIGHT } from './techDiffusion';
import { updateDefensivePacts, pactAllies, PACT_FORM_AE } from './pacts';
import { declareWar } from './diplomacy';
import { processAIWarDecisions } from '../utils/aiLogic';
import { getBorderingNationIds } from '../data/regions';
import { peoplesWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);
const BE_ID = rivalOf(PEOPLES_WORLD, 1);
const NL_ID = rivalOf(PEOPLES_WORLD, 2);
const CH_ID = rivalOf(PEOPLES_WORLD, 3);

describe('liberty desire', () => {
  const calm = { vassalStrength: 200, overlordStrength: 2000, overlordWars: 0, overlordExhaustion: 0, overlordInDebt: false };
  it('stays low under a strong, peaceful, solvent overlord', () => {
    expect(libertyDesireTarget(calm)).toBeLessThan(10);
  });
  it('climbs when the overlord is overstretched, exhausted and broke even without being out-muscled', () => {
    const sizeable = { ...calm, vassalStrength: 800 }; // 40% of its overlord: content while the overlord is fine
    expect(libertyDesireTarget(sizeable)).toBeLessThan(50);
    expect(libertyDesireTarget({ ...sizeable, overlordWars: 3, overlordExhaustion: 80, overlordInDebt: true })).toBeGreaterThanOrEqual(50);
    // a tiny vassal needs more than its overlord's troubles to rise
    expect(libertyDesireTarget({ ...calm, overlordWars: 3, overlordExhaustion: 80, overlordInDebt: true })).toBeLessThan(50);
    expect(libertyDesireTarget({ ...calm, vassalStrength: 2500 })).toBeGreaterThan(libertyDesireTarget(calm));
  });
  it('moves toward its target a few points a turn, not in one jump', () => {
    expect(nextLibertyDesire(10, 80)).toBe(10 + LD_RISE);
    expect(nextLibertyDesire(60, 0)).toBeLessThan(60);
    expect(nextLibertyDesire(40, 40)).toBe(40);
  });
  it('an AI vassal only rolls for independence past the threshold, more so when its overlord is at war', () => {
    expect(independenceChance(49)).toBe(0);
    expect(independenceChance(90, 2)).toBeGreaterThan(independenceChance(90, 0));
    expect(independenceChance(100, 3)).toBeLessThanOrEqual(0.5);
  });
  it('an AI vassal at high liberty desire declares an independence war through processAIWarDecisions', () => {
    const state = peoplesWorld({ seed: 3 });
    const nations = { ...state.nations, [BE_ID]: { ...state.nations[BE_ID], vassalOf: DE_ID, libertyDesire: 100 }, [DE_ID]: { ...state.nations[DE_ID], vassals: [BE_ID] } };
    const always = { next: () => 0 };
    const out = processAIWarDecisions({ ...state, nations }, nations, [], [], always);
    const war = out.wars.find((w) => w.aggressor === BE_ID);
    expect(war?.enemy).toBe(DE_ID);
    expect(war?.cb).toBe('independence');
  });
});

describe('technology diffusion', () => {
  const state = peoplesWorld({ seed: 5, age: 'bronze' });
  const techId = 'Bronze Working';
  it('nobody has it: the pioneer pays more', () => {
    const d = getTechDiffusion(state, FR_ID, techId);
    expect(d.pioneer).toBe(true);
    expect(d.mult).toBe(PIONEER_MULT);
  });
  it('the share of the known world (by economy) that has it sets the discount', () => {
    const known = contactsOf(state, FR_ID);
    const neighbours = getBorderingNationIds(state.regions, FR_ID).slice(0, 2);
    neighbours.forEach((id) => expect(known.has(id)).toBe(true));
    const nations = { ...state.nations };
    neighbours.forEach((id) => { nations[id] = { ...nations[id], tech: { researched: [techId], ageId: 'bronze' } }; });
    const s = { ...state, nations };
    const d = getTechDiffusion(s, FR_ID, techId);
    let total = 0; let withIt = 0;
    contactsOf(s, FR_ID).forEach((w, id) => { total += w; if (neighbours.includes(id)) withIt += w; });
    expect(d.knownWithIt).toBe(neighbours.length);
    expect(d.share).toBeCloseTo(withIt / total, 10);
    expect(d.mult).toBeCloseTo(1 - DIFFUSION_MAX * withIt / total, 10);
    expect(withDiffusion(s, FR_ID, techId, 0)).toBeLessThan(0);
    // everyone known has it: the full discount
    const all = { ...state.nations };
    contactsOf(state, FR_ID).forEach((w, id) => { all[id] = { ...all[id], tech: { researched: [techId], ageId: 'bronze' } }; });
    expect(getTechDiffusion({ ...state, nations: all }, FR_ID, techId).mult).toBeCloseTo(1 - DIFFUSION_MAX, 10);
    // far away holders the nation does not know don't help, but they do end the pioneer penalty
    const far = Object.keys(state.nations).find((id) => id !== FR_ID && !known.has(id));
    const s2 = { ...state, nations: { ...state.nations, [far]: { ...state.nations[far], tech: { researched: [techId], ageId: 'bronze' } } } };
    expect(getTechDiffusion(s2, FR_ID, techId)).toMatchObject({ pioneer: false, mult: 1 });
  });
  it('a trade partner is known wherever it is, and counts double', () => {
    const far = Object.keys(state.nations).find((id) => id !== FR_ID && !contactsOf(state, FR_ID).has(id));
    const s = { ...state, nations: { ...state.nations, [far]: { ...state.nations[far], hasTradeAgreement: true } } };
    const known = contactsOf(s, FR_ID);
    expect(known.has(far)).toBe(true);
    expect(known.get(far) % TRADE_CONTACT_WEIGHT).toBe(0);
    // and the partner knows the player back
    expect(contactsOf(s, far).has(FR_ID)).toBe(true);
  });
  it('the known world widens with the age of the nation (km, not rings)', () => {
    expect(contactsOf({ ...state, techAgeId: 'gunpowder' }, FR_ID).size).toBeGreaterThan(contactsOf(state, FR_ID).size);
  });
});

describe('defensive pacts', () => {
  const base = peoplesWorld({ seed: 9 });
  const withGrudges = (ids, against, ae = PACT_FORM_AE + 5) => {
    const nations = { ...base.nations };
    ids.forEach((id) => { nations[id] = { ...nations[id], ae: { [against]: ae } }; });
    return nations;
  };
  it('two nations fearing the same conqueror form a pact; a lone one does not', () => {
    expect(updateDefensivePacts(withGrudges([BE_ID], DE_ID), { playerNationId: FR_ID, turnNumber: 1 }).nations[BE_ID].defensivePact).toBeFalsy();
    const out = updateDefensivePacts(withGrudges([BE_ID, NL_ID], DE_ID), { playerNationId: FR_ID, turnNumber: 1 });
    expect(out.nations[BE_ID].defensivePact).toEqual({ against: DE_ID, since: 1 });
    expect(out.nations[NL_ID].defensivePact.against).toBe(DE_ID);
    expect(out.logs).toHaveLength(1);
  });
  it('the player is never signed into a pact, but a pact can form against the player', () => {
    const out = updateDefensivePacts(withGrudges([BE_ID, CH_ID, FR_ID], FR_ID), { playerNationId: FR_ID, turnNumber: 1 });
    expect(out.nations[BE_ID].defensivePact.against).toBe(FR_ID);
    expect(out.logs[0].message).toMatch(/against you/);
    const out2 = updateDefensivePacts(withGrudges([FR_ID, BE_ID, NL_ID], DE_ID), { playerNationId: FR_ID, turnNumber: 1 });
    expect(out2.nations[FR_ID].defensivePact).toBeFalsy();
  });
  it('a pact dissolves once the grudges fade', () => {
    const formed = updateDefensivePacts(withGrudges([BE_ID, NL_ID], DE_ID), { playerNationId: FR_ID, turnNumber: 1 }).nations;
    const faded = { ...formed, [BE_ID]: { ...formed[BE_ID], ae: { [DE_ID]: 5 } } };
    const out = updateDefensivePacts(faded, { playerNationId: FR_ID, turnNumber: 9 }).nations;
    expect(out[BE_ID].defensivePact).toBeFalsy();
    expect(out[NL_ID].defensivePact).toBeFalsy(); // alone, the league breaks up
  });
  it('attacking one member calls the others to arms', () => {
    const nations = updateDefensivePacts(withGrudges([BE_ID, NL_ID], FR_ID), { playerNationId: FR_ID, turnNumber: 1 }).nations;
    const state = { ...base, nations, wars: [], logs: [] };
    expect(pactAllies(nations, BE_ID, FR_ID)).toEqual([NL_ID]);
    const after = declareWar(state, BE_ID, { aggressor: FR_ID });
    expect(after.wars.some((w) => w.aggressor === FR_ID && w.enemy === BE_ID)).toBe(true);
    const join = after.wars.find((w) => w.aggressor === NL_ID && w.enemy === FR_ID);
    expect(join?.cb).toBe('defensivePact');
    expect(after.logs.at(-1).message).toMatch(/Called to arms/);
  });
});
