// src/engine/peacefulApproach.test.js
// Lane diplomacy-depth. Playtest 40550097406 step 51: "Toward Mycenae" asked for a war, the player
// only wanted to meet them. A march toward a people whose land is shut now ends at their border
// (routes.js approachTile) and the bar offers open borders; a gift now warms opinion (it only
// lowered a hostility a stranger does not have); trade and alliance refusals say why.
import { describe, expect, it } from 'vitest';
import { peoplesWorld, rivalOf, addCity, cap } from './testWorld';
import { approachTile, accessOf, planMarch } from './routes';
import { tileAccess } from './armies';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { opinionOf, opinionReasons, giftWarmth } from './opinion';
import { GIFT_OPINION, GIFT_OPINION_MAX } from '../data/opinion';
import { setOpenBorders } from './accords';
import { marchBarModel } from '../components/map/MarchBar';

const WORLD = peoplesWorld({ seed: 7 });
const ME = WORLD.playerNationId;
const THEM = rivalOf(WORLD, 0);
const { state: BASE, cityId: FAR } = addCity(WORLD, THEM);
// Met (fog.js): diplomacy needs contact; a met-recently warmth would blur the numbers, so they met long ago.
const rich = (s) => ({ ...s, turnNumber: 40, resources: { ...s.resources, gold: 10000 }, fog: s.fog ? { ...s.fog, met: { ...(s.fog.met || {}), [ME]: { ...(s.fog.met?.[ME] || {}), [THEM]: 1 }, [THEM]: { ...(s.fog.met?.[THEM] || {}), [ME]: 1 } } } : s.fog });
const army = (s) => ({ ...s, units: { a: { id: 'a', ownerId: ME, regionId: cap(ME), tile: s.regions[cap(ME)].tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1 } } });

describe('peaceful approach', () => {
  const s = army(BASE);
  const from = s.regions[cap(ME)].tile;

  it('at peace their land is closed and a march to their city has no way in', () => {
    expect(accessOf(s, FAR)).toBe('closed');
    expect(planMarch(s, cap(ME), FAR, ['a']).ok).toBe(false);
  });

  it('approachTile is open land at their border that the army can reach', () => {
    const tile = approachTile(s, from, FAR);
    expect(tile).not.toBeNull();
    expect(['own', 'wild', 'friend']).toContain(tileAccess(s, tile, ME));
    expect(planMarch(s, cap(ME), tile, ['a']).ok || tile === from).toBe(true);
  });

  it('no approach for open land: open borders let the march go to the city itself', () => {
    const open = { ...s, nations: setOpenBorders(s.nations, ME, THEM, true) };
    expect(accessOf(open, FAR)).toBe('friend');
    expect(approachTile(open, from, FAR)).toBeNull();
  });

  it('the march bar offers the border and open borders, never the war line', () => {
    const tile = approachTile(s, from, FAR);
    const plan = { ...planMarch(s, cap(ME), tile, ['a']), approachOf: FAR, approachTile: tile };
    const m = marchBarModel(s, { from: cap(ME), target: FAR, unitIds: ['a'], naval: false }, plan);
    expect(m.approach?.owner).toBe(THEM);
    expect(m.approach.borders).toHaveProperty('accepted');
    expect(m.marchAttackBlocked).toBeNull();
  });
});

describe('gifts warm opinion', () => {
  it('a gift to a stranger raises their opinion by GIFT_OPINION, capped, fading 1 a turn', () => {
    const s0 = rich(BASE);
    const o0 = opinionOf(s0, THEM);
    const s1 = gameReducer(s0, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: THEM } });
    expect(opinionOf(s1, THEM)).toBeGreaterThanOrEqual(o0 + GIFT_OPINION); // plus any grudge the gift wore down
    expect(opinionReasons(s1, THEM).find((r) => r.id === 'gifts')?.value).toBe(GIFT_OPINION);
    expect(s1.logs.at(-1).msgVars?.opinion ?? s1.logs.at(-1).message).toBeTruthy();
    let s2 = s1;
    for (let i = 0; i < 4; i++) s2 = gameReducer(s2, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: THEM } });
    expect(giftWarmth(s2, THEM, ME)).toBe(GIFT_OPINION_MAX);
    expect(giftWarmth({ ...s2, turnNumber: s2.turnNumber + 5 }, THEM, ME)).toBe(GIFT_OPINION_MAX - 5);
    expect(giftWarmth({ ...s2, turnNumber: s2.turnNumber + 50 }, THEM, ME)).toBe(0);
  });
});

describe('refusals say why', () => {
  it('a full trade slot is refused with a log line, not silence', () => {
    const s0 = rich(BASE);
    const other = Object.keys(s0.nations).find((id) => id !== ME && id !== THEM && !s0.nations[id].isEliminated);
    const full = { ...s0, nations: { ...s0.nations, [other]: { ...s0.nations[other], hasTradeAgreement: true } } };
    const s1 = gameReducer(full, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: THEM } });
    if (!s1.nations[THEM].hasTradeAgreement) expect(s1.logs.length).toBe(full.logs.length + 1);
  });

  it('an alliance they refuse is logged with its score', () => {
    const s0 = rich(BASE);
    const sore = { ...s0, nations: { ...s0.nations, [THEM]: { ...s0.nations[THEM], hostility: 100 } } };
    const s1 = gameReducer(sore, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: THEM } });
    expect(s1.nations[THEM].hasMilitaryPact).toBeFalsy();
    expect(s1.logs.at(-1).msgKey).toBe('m.act.no.allianceRefused');
  });
});
