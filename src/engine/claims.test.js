// src/engine/claims.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { assertGameState } from './stateAudit';
import { hasCasusBelli, declareWar } from './diplomacy';
import { applyAggressiveExpansion } from './expansion';
import {
  claimableCities, canFabricateClaim, claimOn, claimsAgainst, isCore, startClaim, advanceClaims, aeMultFor, nearestCityOf, ringsToBorder,
  CLAIM_RANGE_RINGS, CLAIM_FABRICATE_TURNS, CLAIM_AE_MULT
} from './claims';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 3 });
const IN_ID = PEOPLES_WORLD.playerNationId;
const PK_ID = rivalOf(PEOPLES_WORLD, 0);

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => {
  let x = s;
  if (x.pendingPeaceOffer) x = gameReducer(x, { type: x.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
  x = resolveTurn(x);
  return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x;
};

describe('claims on cities', () => {
  const S = quiet(neighbourWorld({ seed: 3 }));

  it('a claim needs a city of another nation within reach of the border, and the nearest one is offered first', () => {
    const sites = claimableCities(S, IN_ID);
    expect(sites.length).toBeGreaterThan(0);
    sites.forEach((x) => { expect(x.rings).toBeLessThanOrEqual(CLAIM_RANGE_RINGS); expect(x.city.owner).not.toBe(IN_ID); });
    expect(sites[0].rings).toBeLessThanOrEqual(sites[sites.length - 1].rings);
    expect(canFabricateClaim(S, IN_ID, getNationCapital(IN_ID)).ok).toBe(false);
    const far = Object.values(S.regions).find((c) => c.owner && c.owner !== IN_ID && ringsToBorder(S, c, IN_ID) === Infinity);
    expect(canFabricateClaim(S, IN_ID, far.id).reason).toMatch(/Out of reach/);
    expect(nearestCityOf(S, IN_ID, far.owner)?.owner).toBe(far.owner);
  });

  it('fabricating takes CLAIM_FABRICATE_TURNS turns, then the claim justifies a war on that city and survives the declaration', () => {
    const site = claimableCities(S, IN_ID)[0].city;
    let s = gameReducer({ ...S, resources: { ...S.resources, gold: 5000, dip: 100 } }, { type: ActionTypes.FABRICATE_CLAIM, payload: { cityId: site.id } });
    expect(s.nations[IN_ID].claimsInProgress).toEqual([{ cityId: site.id, done: S.turnNumber + CLAIM_FABRICATE_TURNS }]);
    expect(hasCasusBelli(s, IN_ID, site.owner)).toBe(false);
    expect(gameReducer(s, { type: ActionTypes.FABRICATE_CLAIM, payload: { cityId: site.id } })).toBe(s); // already at work
    for (let i = 0; i < CLAIM_FABRICATE_TURNS; i++) s = play(s);
    expect(s.nations[IN_ID].claims).toContain(site.id);
    expect(s.nations[IN_ID].claimsInProgress).toEqual([]);
    expect(s.logs.some((l) => /claim on .* is ready/.test(l.message))).toBe(true);
    expect(claimOn(s, IN_ID, s.regions[site.id])).toBe('claim');
    expect(hasCasusBelli(s, IN_ID, site.owner)).toBe(true);
    const war = declareWar(s, site.owner, { aggressor: IN_ID });
    const w = war.wars[war.wars.length - 1];
    expect(w.cb).toBe('claim');
    expect(w.goal).toEqual({ type: 'capture_region', regionId: site.id });
    expect(war.nations[IN_ID].claims).toContain(site.id); // kept until the city is taken
    assertGameState(war);
  });

  it('a claim drops once the city is owned; a core (founder or culture majority) is a standing claim', () => {
    const site = claimableCities(S, IN_ID)[0].city;
    const nations = { ...S.nations, [IN_ID]: { ...S.nations[IN_ID], claims: [site.id] } };
    const regions = { ...S.regions, [site.id]: { ...site, owner: IN_ID } };
    advanceClaims(nations, regions, S.turnNumber + 1);
    expect(nations[IN_ID].claims).toEqual([]);
    const lost = { ...S.regions[getNationCapital(IN_ID)], owner: PK_ID };
    expect(isCore(lost, IN_ID)).toBe(true);
    expect(claimOn({ ...S, regions: { ...S.regions, [lost.id]: lost } }, IN_ID, lost)).toBe('core');
    expect(isCore({ ...site, founderId: 'xx', culture: { [IN_ID]: 0.7, [site.owner]: 0.3 } }, IN_ID)).toBe(true);
    expect(claimsAgainst({ ...S, regions: { ...S.regions, [lost.id]: lost } }, IN_ID, PK_ID).map((c) => c.id)).toContain(lost.id);
  });

  it('taking a claimed city costs half the aggressive expansion, a core none', () => {
    const site = claimableCities(S, IN_ID)[0].city;
    const withClaim = { ...S, nations: { ...S.nations, [IN_ID]: { ...S.nations[IN_ID], claims: [site.id] } } };
    expect(aeMultFor(withClaim, IN_ID, site)).toBe(CLAIM_AE_MULT);
    expect(aeMultFor(S, IN_ID, site)).toBe(1);
    expect(aeMultFor(S, IN_ID, { ...site, founderId: IN_ID })).toBe(0);
    const regions = { ...S.regions, [site.id]: { ...site, dev: { tax: 10, production: 10, manpower: 10 } } };
    const full = applyAggressiveExpansion(S.nations, regions, site.id, site.owner, IN_ID, 1);
    const half = applyAggressiveExpansion(S.nations, regions, site.id, site.owner, IN_ID, 0.5);
    expect(half[site.owner].ae[IN_ID]).toBeLessThan(full[site.owner].ae[IN_ID]);
    expect(half[site.owner].ae[IN_ID]).toBeGreaterThan(0);
  });

  it('a nation state with a claim in progress is still valid, and startClaim keeps earlier work', () => {
    const n = startClaim(startClaim(S.nations[IN_ID], 'c1', 1), 'c2', 3);
    expect(n.claimsInProgress.map((c) => c.cityId)).toEqual(['c1', 'c2']);
  });
});
