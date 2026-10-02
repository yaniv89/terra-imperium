// src/engine/accords.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { assertGameState } from './stateAudit';
import { hasCasusBelli, declareWar } from './diplomacy';
import { regionAccess } from './armies';
import { canSettle, bestSites } from './settlers';
import { opinionOf } from './opinion';
import { claimableCities } from './claims';
import {
  hasOpenBorders, openBordersAcceptance, setOpenBorders, demandAcceptance, applyDemand, settlingBarred, hasDemandCasusBelli,
  OPEN_BORDERS_OPINION, DEMAND_CB_TURNS, DEMAND_COOLDOWN_TURNS, DEMAND_STOP_SETTLING_TURNS, DEMAND_TRIBUTE_MIN
} from './accords';

const base = () => {
  const s = createInitialState({ playerNationId: 'in', rngSeed: 3 });
  return { ...s, resources: { ...s.resources, gold: 100000, dip: 500 } };
};
const neighbour = (s) => claimableCities(s, 'in')[0].city.owner;

describe('open borders', () => {
  it('the AI accepts at the opinion floor, the pact opens passage both ways, raises opinion, and war closes it', () => {
    const s = base(); const other = neighbour(s);
    const cold = { ...s, nations: { ...s.nations, [other]: { ...s.nations[other], hostility: 100 } } };
    expect(openBordersAcceptance(cold, other).accepted).toBe(false);
    const refused = gameReducer(cold, { type: ActionTypes.OPEN_BORDERS, payload: { nationId: other } });
    expect(hasOpenBorders(refused, 'in', other)).toBe(false);
    expect(refused.resources.gold).toBeLessThan(cold.resources.gold);
    const warm = { ...s, nations: { ...s.nations, [other]: { ...s.nations[other], hostility: 0, hasTradeAgreement: true, hasMilitaryPact: true } } };
    expect(opinionOf(warm, other)).toBeGreaterThanOrEqual(OPEN_BORDERS_OPINION);
    const open = gameReducer(warm, { type: ActionTypes.OPEN_BORDERS, payload: { nationId: other } });
    expect(hasOpenBorders(open, 'in', other)).toBe(true);
    expect(open.nations[other].openBordersWith.in).toBe(true);
    expect(open.nations.in.openBordersWith[other]).toBe(true);
    expect(opinionOf(open, other)).toBeGreaterThan(opinionOf(warm, other));
    expect(regionAccess(open, getNationCapital(other), 'in')).toBe('friend');
    expect(regionAccess(cold, getNationCapital(other), 'in')).toBe('closed');
    expect(gameReducer(open, { type: ActionTypes.OPEN_BORDERS, payload: { nationId: other } })).toBe(open);
    const closed = gameReducer(open, { type: ActionTypes.CLOSE_BORDERS, payload: { nationId: other } });
    expect(hasOpenBorders(closed, 'in', other)).toBe(false);
    const war = declareWar(open, other, { aggressor: 'in' });
    expect(hasOpenBorders(war, 'in', other)).toBe(false);
    assertGameState(open);
  });

  it('setOpenBorders writes both records and clears both', () => {
    const s = base();
    const on = setOpenBorders(s.nations, 'in', 'pk', true);
    expect(on.in.openBordersWith.pk && on.pk.openBordersWith.in).toBe(true);
    const off = setOpenBorders(on, 'in', 'pk', false);
    expect(off.in.openBordersWith.pk).toBeUndefined();
    expect(off.pk.openBordersWith.in).toBeUndefined();
  });
});

describe('demands', () => {
  it('a weak demander is refused and gains a casus belli; a strong one is paid tribute; the same nation is not pressed twice', () => {
    const s = base(); const other = neighbour(s);
    const weak = { ...s, nations: { ...s.nations, in: { ...s.nations.in, militaryStrength: 100 }, [other]: { ...s.nations[other], militaryStrength: 50000 } }, units: {} };
    const a = demandAcceptance(weak, other, 'tribute');
    expect(a.accepted).toBe(false);
    const refused = gameReducer(weak, { type: ActionTypes.DEMAND, payload: { nationId: other, kind: 'tribute' } });
    expect(hasDemandCasusBelli(refused, 'in', other)).toBe(true);
    expect(hasCasusBelli(refused, 'in', other)).toBe(true);
    expect(refused.nations[other].hostility).toBeGreaterThan(weak.nations[other].hostility || 0);
    expect(refused.nations.in.demandCooldowns[other]).toBe(weak.turnNumber + DEMAND_COOLDOWN_TURNS);
    expect(demandAcceptance(refused, other, 'tribute').reason).toMatch(/no demand/);
    expect(hasDemandCasusBelli({ ...refused, turnNumber: refused.turnNumber + DEMAND_CB_TURNS + 1 }, 'in', other)).toBe(false);
    const strong = { ...s, nations: { ...s.nations, in: { ...s.nations.in, militaryStrength: 50000 }, [other]: { ...s.nations[other], militaryStrength: 100, hostility: 0, economy: { ...s.nations[other].economy, gold: 1000 } } }, units: {} };
    expect(demandAcceptance(strong, other, 'tribute').accepted).toBe(true);
    const paid = gameReducer(strong, { type: ActionTypes.DEMAND, payload: { nationId: other, kind: 'tribute' } });
    expect(paid.resources.gold - strong.resources.gold).toBe(200); // 20% of 1,000; the demand costs DIP, not gold
    expect(paid.nations[other].economy.gold).toBe(800);
    expect(paid.logs[paid.logs.length - 1].message).toMatch(/tribute/);
    expect(DEMAND_TRIBUTE_MIN).toBeGreaterThan(0);
    assertGameState(paid);
  });

  it('a claimed city changes hands peacefully and the claim is settled; a capital is never demanded', () => {
    const s = base();
    const site = claimableCities(s, 'in')[0].city; const other = site.owner;
    const strong = { ...s, nations: { ...s.nations, in: { ...s.nations.in, militaryStrength: 50000, claims: [site.id] }, [other]: { ...s.nations[other], militaryStrength: 100, hostility: 0 } }, units: {} };
    if (strong.nations[other].capitalRegionId === site.id) {
      expect(demandAcceptance(strong, other, 'city', site.id).reason).toMatch(/capital/);
      return;
    }
    expect(demandAcceptance(strong, other, 'city', site.id).accepted).toBe(true);
    const r = applyDemand(strong, other, 'city', site.id);
    expect(r.accepted).toBe(true);
    expect(r.state.regions[site.id].owner).toBe('in');
    expect(r.state.nations.in.claims).not.toContain(site.id);
    assertGameState(r.state);
    expect(demandAcceptance(strong, other, 'city', getNationCapital(other)).reason).toMatch(/capital|claim/);
  });

  it('stop settling: the promise bars their sites near my cities for a while', () => {
    const s = base(); const other = neighbour(s);
    const strong = { ...s, nations: { ...s.nations, in: { ...s.nations.in, militaryStrength: 50000 }, [other]: { ...s.nations[other], militaryStrength: 100, hostility: 0 } }, units: {} };
    const r = applyDemand(strong, other, 'stopSettling');
    expect(r.accepted).toBe(true);
    expect(r.state.nations[other].noSettleNear.in).toBe(s.turnNumber + DEMAND_STOP_SETTLING_TURNS);
    const myCapital = s.regions[getNationCapital('in')].tile;
    expect(settlingBarred(r.state, other, myCapital)).toBe(true);
    expect(settlingBarred({ ...r.state, turnNumber: r.state.turnNumber + DEMAND_STOP_SETTLING_TURNS + 1 }, other, myCapital)).toBe(false);
    expect(canSettle(r.state, myCapital, other, 'bronze').ok).toBe(false);
    bestSites(r.state, other, s.regions[getNationCapital(other)].tile, 'bronze').forEach((x) => expect(settlingBarred(r.state, other, x.tile)).toBe(false));
  });
});
