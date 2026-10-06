import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getSortedByMilitary } from '../utils/aiLogic';
import { processAIAccords, touchingNations, tributeOf, answerDemand, demandWaiting, AI_ACCORD_PERIOD, AI_DEMAND_RATIO, AI_OPEN_BORDERS_OPINION, DEMAND_ANSWER_TURNS } from './aiAccords';
import { hasOpenBorders, hasDemandCasusBelli, DEMAND_CB_TURNS } from './accords';
import { opinionOf } from './opinion';
import { nextPrompts } from '../components/ui/nextPromptModel';
import { assertGameState } from './stateAudit';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = quiet(createInitialState({ playerNationId: 'au', rngSeed: 7 }));
const sorted = getSortedByMilitary(S);
// Two touching AI nations in Europe (France and one neighbour whose cities touch).
const fr = 'fr'; const other = touchingNations(S, fr).find((id) => id !== 'au');
const onSlot = (state, id) => { const ids = Object.keys(state.nations).filter((x) => x !== state.playerNationId && !state.nations[x].isEliminated && !state.nations[x].isPlayer).sort(); const slot = ids.indexOf(id) % AI_ACCORD_PERIOD; let t = state.turnNumber; while (t % AI_ACCORD_PERIOD !== slot) t++; return t; };

describe('AI accords (plan C6)', () => {
  it('two friendly touching AI nations open their borders on the slot turn, and close them when opinion sours', () => {
    expect(other).toBeDefined();
    const turn = onSlot(S, fr);
    const cold = { ...S, turnNumber: turn };
    const r0 = processAIAccords(cold, cold.nations, { turn, sortedByMilitary: sorted });
    const ab = opinionOf(cold, fr, other); const ba = opinionOf(cold, other, fr);
    expect(hasOpenBorders({ ...cold, nations: r0.nations }, fr, other)).toBe(ab >= AI_OPEN_BORDERS_OPINION && ba >= AI_OPEN_BORDERS_OPINION);
    // Friends: a treaty of opinion both ways.
    const friends = { ...cold, nations: { ...cold.nations, [fr]: { ...cold.nations[fr], hasTradeAgreement: false }, [other]: { ...cold.nations[other] } }, wars: [] };
    const warmed = { ...friends, nations: { ...friends.nations, [fr]: { ...friends.nations[fr], treaties: { ...(friends.nations[fr].treaties || {}), [other]: { tradeAgreement: true, alliance: true } } }, [other]: { ...friends.nations[other], treaties: { ...(friends.nations[other].treaties || {}), [fr]: { tradeAgreement: true, alliance: true } } } } };
    const high = opinionOf(warmed, fr, other) >= AI_OPEN_BORDERS_OPINION && opinionOf(warmed, other, fr) >= AI_OPEN_BORDERS_OPINION;
    const r1 = processAIAccords(warmed, warmed.nations, { turn, sortedByMilitary: sorted });
    expect(hasOpenBorders({ ...warmed, nations: r1.nations }, fr, other)).toBe(high || hasOpenBorders(warmed, fr, other));
    // Sour: a pair with open borders and a bad opinion closes them.
    const opened = { ...cold, nations: { ...cold.nations, [fr]: { ...cold.nations[fr], openBordersWith: { [other]: true }, hostility: 100 }, [other]: { ...cold.nations[other], openBordersWith: { [fr]: true }, hostility: 100 } } };
    const r2 = processAIAccords(opened, opened.nations, { turn, sortedByMilitary: sorted });
    const sour = opinionOf(opened, fr, other) < 0 || opinionOf(opened, other, fr) < 0;
    expect(hasOpenBorders({ ...opened, nations: r2.nations }, fr, other)).toBe(!sour);
  });

  it('a strong Tier-1 nation demands tribute from a weak touching AI, and from the player as a pending demand', () => {
    const turn = onSlot(S, fr);
    const giant = { ...S, turnNumber: turn, units: {}, nations: { ...S.nations, [fr]: { ...S.nations[fr], militaryStrength: 50000, economy: { ...S.nations[fr].economy, gold: 100 } }, [other]: { ...S.nations[other], militaryStrength: 100, hostility: 0, economy: { ...S.nations[other].economy, gold: 1000 } } } };
    const bigSorted = getSortedByMilitary(giant);
    const r = processAIAccords(giant, giant.nations, { turn, sortedByMilitary: bigSorted });
    const paid = r.nations[other].economy.gold < 1000;
    const refused = hasDemandCasusBelli({ ...giant, nations: r.nations }, fr, other);
    expect(paid || refused).toBe(true);
    if (paid) { expect(r.nations[fr].economy.gold).toBe(100 + (1000 - r.nations[other].economy.gold)); expect(r.logs.some((l) => /tribute/.test(l.message))).toBe(true); }
    expect(r.nations[fr].demandCooldowns[other]).toBeGreaterThan(turn);
    expect(AI_DEMAND_RATIO).toBe(2);
    // The player as the prey: France's cities touch no Australian city, so touch is faked by the test world: use a touching AI of the player instead.
    const auTouch = touchingNations(S, 'au');
    if (auTouch.length) {
      const bully = auTouch[0];
      const t2 = onSlot(S, bully);
      const pressed = { ...S, turnNumber: t2, units: {}, resources: { ...S.resources, gold: 500 }, nations: { ...S.nations, [bully]: { ...S.nations[bully], militaryStrength: 50000 }, au: { ...S.nations.au, militaryStrength: 100 } } };
      const r2 = processAIAccords(pressed, pressed.nations, { turn: t2, sortedByMilitary: getSortedByMilitary(pressed) });
      expect(r2.pendingDemand).toMatchObject({ from: bully, kind: 'tribute', amount: tributeOf(pressed, 'au'), until: t2 + DEMAND_ANSWER_TURNS });
      const withDemand = { ...pressed, nations: r2.nations, pendingDemand: r2.pendingDemand };
      expect(demandWaiting(withDemand)).toBe(true);
      expect(nextPrompts(withDemand).find((p) => p.kind === 'demand')).toMatchObject({ tab: 'diplomacy' });
      const paidUp = gameReducer(withDemand, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } });
      expect(paidUp.pendingDemand).toBeNull();
      expect(paidUp.resources.gold).toBe(500 - r2.pendingDemand.amount);
      expect(paidUp.nations[bully].economy.gold).toBe((pressed.nations[bully].economy.gold || 0) + r2.pendingDemand.amount);
      const said = gameReducer(withDemand, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: false } });
      expect(hasDemandCasusBelli(said, bully, 'au')).toBe(true);
      expect(said.resources.gold).toBe(500);
      // Silence past the deadline is a refusal.
      const late = { ...withDemand, turnNumber: t2 + DEMAND_ANSWER_TURNS + 1 };
      const r3 = processAIAccords(late, late.nations, { turn: late.turnNumber, sortedByMilitary: getSortedByMilitary(late) });
      expect(r3.pendingDemand).toBeNull();
      expect(r3.nations[bully].demandCasusBelli.au).toBe(late.turnNumber + DEMAND_CB_TURNS);
      expect(answerDemand({ ...withDemand, pendingDemand: null }, true).message).toBeNull();
    }
  });

  it('runs inside the turn and keeps the state sound', () => {
    let s = S;
    for (let i = 0; i < AI_ACCORD_PERIOD + 1; i++) { s = resolveTurn(s); if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE }); }
    expect(s.turnNumber).toBe(AI_ACCORD_PERIOD + 2);
    expect('pendingDemand' in s).toBe(true);
    assertGameState(s);
  });
});

describe('AI demands for a city and a stop to settling (plan C6)', () => {
  it('a claim turns the demand into one for the city; the player can yield it, refuse it, or promise to stop settling', async () => {
    const { demandKind } = await import('./aiAccords');
    const { addCity } = await import('./testWorld');
    const bully = touchingNations(S, 'au')[0];
    if (!bully) return;
    // A second Australian city the bully claims (never the capital).
    const added = addCity(S, 'au', { near: S.nations.au.capitalRegionId });
    let s = added.state;
    s = { ...s, nations: { ...s.nations, [bully]: { ...s.nations[bully], claims: [added.cityId], militaryStrength: 50000 }, au: { ...s.nations.au, militaryStrength: 100 } }, units: {} };
    expect(demandKind(s, bully, 'au')).toEqual({ kind: 'city', cityId: added.cityId });
    const t2 = onSlot(s, bully);
    const pressed = { ...s, turnNumber: t2 };
    const r = processAIAccords(pressed, pressed.nations, { turn: t2, sortedByMilitary: getSortedByMilitary(pressed) });
    expect(r.pendingDemand).toMatchObject({ from: bully, kind: 'city', cityId: added.cityId });
    const withDemand = { ...pressed, nations: r.nations, pendingDemand: r.pendingDemand };
    expect(nextPrompts(withDemand).find((p) => p.kind === 'demand').label).toContain(s.regions[added.cityId].name);
    const yielded = gameReducer(withDemand, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } });
    expect(yielded.regions[added.cityId].owner).toBe(bully);
    expect(yielded.pendingDemand).toBeNull();
    expect(yielded.nations[bully].claims).not.toContain(added.cityId);
    assertGameState(yielded);
    const refused = gameReducer(withDemand, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: false } });
    expect(refused.regions[added.cityId].owner).toBe('au');
    expect(hasDemandCasusBelli(refused, bully, 'au')).toBe(true);
    // Without a claim, a nation settled next to is asked to stop; the promise bars its sites.
    const noClaim = { ...withDemand, pendingDemand: null, nations: { ...withDemand.nations, [bully]: { ...withDemand.nations[bully], claims: [] } } };
    const kind = demandKind(noClaim, bully, 'au');
    expect(['stopSettling', 'tribute']).toContain(kind.kind);
    const stop = { ...noClaim, pendingDemand: { from: bully, kind: 'stopSettling', cityId: null, amount: 0, turn: t2, until: t2 + 3 } };
    const promised = gameReducer(stop, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } });
    expect(promised.nations.au.noSettleNear[bully]).toBe(t2 + 50);
    expect(promised.logs[promised.logs.length - 1].message).toMatch(/promise/);
  });
});
