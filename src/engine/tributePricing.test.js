// Tribute prices, empty threats and raid waves (playtest audits CB08: I101, I106, I107, I108).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { tributeGold, TRIBUTE_TURNS, GRUDGE_REFUSED, RAID_WAVE_MAX, isIndependentNation } from '../data/independents';
import { cityIncomeOf, tributePerTurn, TRIBUTE_INCOME_SHARE } from './tributePricing';
import { offerTributeCheck, demandTributeCheck } from './indepPolicy';
import { raidsOutAgainst, raidForecast } from './raids';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
const world = () => {
  const s = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  return { ...s, firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
};
const S = world();
const me = S.playerNationId;
const raiders = Object.values(S.nations).filter((n) => isIndependentNation(n) && n.indep?.personality === 'raiders');
// The player's capital with a given tax and production (what a city adds to the treasury a turn).
const rich = (tax, production) => { const cap = S.nations[me].capitalRegionId; return { ...S, regions: { ...S.regions, [cap]: { ...S.regions[cap], dev: { ...S.regions[cap].dev, tax, production } } } }; };

describe('tribute prices', () => {
  it('city income is the tax and production of the cities held; occupied cities and outposts pay nothing', () => {
    const s = rich(40, 60);
    expect(cityIncomeOf(s, me)).toBe(100);
    const cap = s.nations[me].capitalRegionId;
    expect(cityIncomeOf({ ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], occupiedBy: 'x' } } }, me)).toBe(0);
    expect(cityIncomeOf({ ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], outpost: true } } }, me)).toBe(0);
    expect(cityIncomeOf(s, 'nobody')).toBe(0);
  });

  it('a running tribute is a share of the payer\'s city income, never under the old flat price', () => {
    expect(tributePerTurn(rich(1, 1), me)).toBe(tributeGold(S.age)); // a small people still pays 2 + the age's rank
    expect(tributePerTurn(rich(100, 100), me)).toBe(Math.round(200 * TRIBUTE_INCOME_SHARE));
    expect(tributePerTurn(rich(100, 100), me)).toBeGreaterThan(tributeGold(S.age));
    // The same price whoever starts it: the player's offer quotes it, and a demand of an independent prices its own city.
    const r = raiders[0];
    expect(offerTributeCheck(rich(100, 100), r.id).gold).toBe(Math.round(200 * TRIBUTE_INCOME_SHARE));
    expect(offerTributeCheck(rich(100, 100), r.id).reason).toContain(`${Math.round(200 * TRIBUTE_INCOME_SHARE)} gold a turn for ${TRIBUTE_TURNS} turns`);
    const dt = demandTributeCheck(S, r.id);
    if (dt.ok && dt.would) expect(dt.reason).toContain(`${tributePerTurn(S, r.id)} gold a turn`);
  });
});

describe('threats that are real', () => {
  it('a refusal says what is really at risk: a place in reach, or that nothing is', () => {
    const r = raiders[0];
    const demand = { id: 'trib_x', indepId: r.id, gold: 3, turns: TRIBUTE_TURNS, turn: S.turnNumber, expires: S.turnNumber + 3 };
    const refused = gameReducer({ ...S, tributeDemands: [demand] }, { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: 'trib_x', pay: false } });
    const line = refused.logs[refused.logs.length - 1].message;
    const f = raidForecast(S, r.id, me);
    if (!f) expect(line).toMatch(/Nothing of yours is within their reach now, so no raid follows/);
    else expect(line).toMatch(f.likely ? /Expect raiders at / : /They may raid /);
    expect(line).toContain(`+${GRUDGE_REFUSED}`);
    // Out of reach for certain: an independent on the far side of the world promises no raid.
    const far = raiders.find((n) => !raidForecast(S, n.id, me));
    if (far) {
      const out = gameReducer({ ...S, tributeDemands: [{ ...demand, indepId: far.id }] }, { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: 'trib_x', pay: false } });
      expect(out.logs[out.logs.length - 1].message).not.toMatch(/Expect raiders/);
    }
  });

  it('counts the raid parties out against one nation (the wave cap)', () => {
    expect(RAID_WAVE_MAX).toBeGreaterThanOrEqual(1);
    expect(raidsOutAgainst(S, me)).toBe(0);
    const [a, b, c] = raiders;
    const out = (n, phase) => ({ ...n, indep: { ...n.indep, raid: { kind: 'sack', targetNationId: me, phase } } });
    const nations = { ...S.nations, [a.id]: out(a, 'out'), [b.id]: out(b, 'battle'), ...(c ? { [c.id]: out(c, 'home') } : {}) };
    expect(raidsOutAgainst({ nations }, me)).toBe(2); // a party going home no longer counts
    expect(raidsOutAgainst({ nations }, 'someone')).toBe(0);
  });
});
