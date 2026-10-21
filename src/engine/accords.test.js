// src/engine/accords.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
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
  OPEN_BORDERS_OPINION, demandCbTurns, demandCooldownTurns, demandTruceTurns, tributeQuote, cityIncomeOf, DEMAND_STOP_SETTLING_TURNS, DEMAND_TRIBUTE_MIN, DEMAND_TRIBUTE_BANK_CAP, DEMAND_TRIBUTE_INCOME_SHARE
} from './accords';
import { neighbourWorld, rivalOf, withDecrees } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 3 });
const IN_ID = PEOPLES_WORLD.playerNationId;
const PK_ID = rivalOf(PEOPLES_WORLD, 0);

const base = () => {
  const s = neighbourWorld({ seed: 3, fog: false });
  return withDecrees({ ...s, resources: { ...s.resources, gold: 100000 } });
};
const neighbour = (s) => claimableCities(s, IN_ID)[0].city.owner;

describe('open borders', () => {
  it('the AI accepts at the opinion floor, the pact opens passage both ways, raises opinion, and war closes it', () => {
    const s = base(); const other = neighbour(s);
    const cold = { ...s, nations: { ...s.nations, [other]: { ...s.nations[other], hostility: 100 } } };
    expect(openBordersAcceptance(cold, other).accepted).toBe(false);
    const refused = gameReducer(cold, { type: ActionTypes.OPEN_BORDERS, payload: { nationId: other } });
    expect(hasOpenBorders(refused, IN_ID, other)).toBe(false);
    expect(refused.resources.gold).toBeLessThan(cold.resources.gold);
    const warm = { ...s, nations: { ...s.nations, [other]: { ...s.nations[other], hostility: 0, hasTradeAgreement: true, hasMilitaryPact: true } } };
    expect(opinionOf(warm, other)).toBeGreaterThanOrEqual(OPEN_BORDERS_OPINION);
    const open = gameReducer(warm, { type: ActionTypes.OPEN_BORDERS, payload: { nationId: other } });
    expect(hasOpenBorders(open, IN_ID, other)).toBe(true);
    expect(open.nations[other].openBordersWith[IN_ID]).toBe(true);
    expect(open.nations[IN_ID].openBordersWith[other]).toBe(true);
    expect(opinionOf(open, other)).toBeGreaterThan(opinionOf(warm, other));
    expect(regionAccess(open, getNationCapital(other), IN_ID)).toBe('friend');
    expect(regionAccess(cold, getNationCapital(other), IN_ID)).toBe('closed');
    expect(gameReducer(open, { type: ActionTypes.OPEN_BORDERS, payload: { nationId: other } })).toBe(open);
    const closed = gameReducer(open, { type: ActionTypes.CLOSE_BORDERS, payload: { nationId: other } });
    expect(hasOpenBorders(closed, IN_ID, other)).toBe(false);
    const war = declareWar(open, other, { aggressor: IN_ID });
    expect(hasOpenBorders(war, IN_ID, other)).toBe(false);
    assertGameState(open);
  });

  it('setOpenBorders writes both records and clears both', () => {
    const s = base();
    const on = setOpenBorders(s.nations, IN_ID, PK_ID, true);
    expect(on[IN_ID].openBordersWith[PK_ID] && on[PK_ID].openBordersWith[IN_ID]).toBe(true);
    const off = setOpenBorders(on, IN_ID, PK_ID, false);
    expect(off[IN_ID].openBordersWith[PK_ID]).toBeUndefined();
    expect(off[PK_ID].openBordersWith[IN_ID]).toBeUndefined();
  });
});

describe('demands', () => {
  it('a weak demander is refused and gains a casus belli; a strong one is paid tribute; the same nation is not pressed twice', () => {
    const s = base(); const other = neighbour(s);
    const weak = { ...s, nations: { ...s.nations, [IN_ID]: { ...s.nations[IN_ID], militaryStrength: 100 }, [other]: { ...s.nations[other], militaryStrength: 50000 } }, units: {} };
    const a = demandAcceptance(weak, other, 'tribute');
    expect(a.accepted).toBe(false);
    const refused = gameReducer(weak, { type: ActionTypes.DEMAND, payload: { nationId: other, kind: 'tribute' } });
    expect(hasDemandCasusBelli(refused, IN_ID, other)).toBe(true);
    expect(hasCasusBelli(refused, IN_ID, other)).toBe(true);
    expect(refused.nations[other].hostility).toBeGreaterThan(weak.nations[other].hostility || 0);
    expect(refused.nations[IN_ID].demandCooldowns[other]).toBe(weak.turnNumber + demandCooldownTurns(weak));
    expect(demandAcceptance(refused, other, 'tribute').reason).toMatch(/no demand/);
    expect(hasDemandCasusBelli({ ...refused, turnNumber: refused.turnNumber + demandCbTurns(refused) + 1 }, IN_ID, other)).toBe(false);
    const strong = { ...s, nations: { ...s.nations, [IN_ID]: { ...s.nations[IN_ID], militaryStrength: 50000 }, [other]: { ...s.nations[other], militaryStrength: 100, hostility: 0, economy: { ...s.nations[other].economy, gold: 1000 } } }, units: {} };
    expect(demandAcceptance(strong, other, 'tribute').accepted).toBe(true);
    const paid = gameReducer(strong, { type: ActionTypes.DEMAND, payload: { nationId: other, kind: 'tribute' } });
    // The sum comes from their income and the strength ratio, capped at half of what they hold: never a share of the bank alone.
    const q = tributeQuote(strong, IN_ID, other);
    expect(q.amount).toBe(Math.min(Math.max(DEMAND_TRIBUTE_MIN, Math.round(cityIncomeOf(strong, other) * demandCooldownTurns(strong) * DEMAND_TRIBUTE_INCOME_SHARE * q.ratio)), 1000 * DEMAND_TRIBUTE_BANK_CAP));
    const rich = { ...strong, nations: { ...strong.nations, [other]: { ...strong.nations[other], economy: { ...strong.nations[other].economy, gold: 1000000 } } } };
    expect(tributeQuote(rich, IN_ID, other).amount).toBe(q.byPower); // a full treasury is not taxed
    expect(paid.resources.gold - strong.resources.gold).toBe(q.amount); // the demand costs DIP, not gold
    expect(paid.nations[other].economy.gold).toBe(1000 - q.amount);
    // Meeting a demand buys a truce both ways, and the demander thinks better of the payer meanwhile.
    expect(paid.nations[IN_ID].truces[other]).toBe(strong.turnNumber + demandTruceTurns(strong));
    expect(paid.nations[other].truces[IN_ID]).toBe(strong.turnNumber + demandTruceTurns(strong));
    expect(paid.nations[IN_ID].demandMet[other]).toMatchObject({ kind: 'tribute' });
    expect(demandAcceptance({ ...paid, nations: { ...paid.nations, [IN_ID]: { ...paid.nations[IN_ID], demandCooldowns: {} } } }, other, 'tribute').reason).toMatch(/truce/i);
    expect(paid.logs[paid.logs.length - 1].message).toMatch(/tribute/);
    expect(DEMAND_TRIBUTE_MIN).toBeGreaterThan(0);
    assertGameState(paid);
  });

  it('a claimed city changes hands peacefully and the claim is settled; a capital is never demanded', () => {
    const s = base();
    const site = claimableCities(s, IN_ID)[0].city; const other = site.owner;
    const strong = { ...s, nations: { ...s.nations, [IN_ID]: { ...s.nations[IN_ID], militaryStrength: 50000, claims: [site.id] }, [other]: { ...s.nations[other], militaryStrength: 100, hostility: 0 } }, units: {} };
    if (strong.nations[other].capitalRegionId === site.id) {
      expect(demandAcceptance(strong, other, 'city', site.id).reason).toMatch(/capital/);
      return;
    }
    expect(demandAcceptance(strong, other, 'city', site.id).accepted).toBe(true);
    const r = applyDemand(strong, other, 'city', site.id);
    expect(r.accepted).toBe(true);
    expect(r.state.regions[site.id].owner).toBe(IN_ID);
    expect(r.state.nations[IN_ID].claims).not.toContain(site.id);
    assertGameState(r.state);
    expect(demandAcceptance(strong, other, 'city', getNationCapital(other)).reason).toMatch(/capital|claim/);
  });

  it('stop settling: the promise bars their sites near my cities for a while', () => {
    const s = base(); const other = neighbour(s);
    const strong = { ...s, nations: { ...s.nations, [IN_ID]: { ...s.nations[IN_ID], militaryStrength: 50000 }, [other]: { ...s.nations[other], militaryStrength: 100, hostility: 0 } }, units: {} };
    const r = applyDemand(strong, other, 'stopSettling');
    expect(r.accepted).toBe(true);
    expect(r.state.nations[other].noSettleNear[IN_ID]).toBe(s.turnNumber + DEMAND_STOP_SETTLING_TURNS);
    const myCapital = s.regions[getNationCapital(IN_ID)].tile;
    expect(settlingBarred(r.state, other, myCapital)).toBe(true);
    expect(settlingBarred({ ...r.state, turnNumber: r.state.turnNumber + DEMAND_STOP_SETTLING_TURNS + 1 }, other, myCapital)).toBe(false);
    expect(canSettle(r.state, myCapital, other, 'bronze').ok).toBe(false);
    bestSites(r.state, other, s.regions[getNationCapital(other)].tile, 'bronze').forEach((x) => expect(settlingBarred(r.state, other, x.tile)).toBe(false));
  });
});
