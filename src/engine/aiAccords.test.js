import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { neighbourWorld, withBorder, rivalOf } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getSortedByMilitary, processAIWarDecisions } from '../utils/aiLogic';
import { processAIAccords, touchingNations, tributeOf, answerDemand, demandWaiting, demandTerms, demandBlock, forceNear, demandGapTurns, AI_ACCORD_PERIOD, AI_DEMAND_RATIO, AI_OPEN_BORDERS_OPINION, DEMAND_ANSWER_TURNS } from './aiAccords';
import { hasOpenBorders, hasDemandCasusBelli, demandCbTurns, demandTruceTurns, demandCooldownTurns } from './accords';
import { opinionOf, opinionReasons } from './opinion';
import { isInTruce, declareWar } from './diplomacy';
import { nextPrompts } from '../components/ui/nextPromptModel';
import { assertGameState } from './stateAudit';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const W = neighbourWorld({ seed: 7, rivals: 2, fog: false });
const P = W.playerNationId;
// Two AI nations whose lands touch (a city of the second founded beside the first), as in Europe.
const S = quiet(withBorder(W, rivalOf(W, 0), rivalOf(W, 1)));
const sorted = getSortedByMilitary(S);

const fr = rivalOf(S, 0); const other = touchingNations(S, fr).find((id) => id !== P);
const onSlot = (state, id) => { const ids = Object.keys(state.nations).filter((x) => x !== state.playerNationId && !state.nations[x].isEliminated && !state.nations[x].isPlayer).sort(); const slot = ids.indexOf(id) % AI_ACCORD_PERIOD; let t = state.turnNumber; while (t % AI_ACCORD_PERIOD !== slot) t++; return t; };
// An army of `owner` standing on `target`'s capital tile: the force that makes a demand credible.
const armyNear = (state, owner, target) => ({ near1: { id: 'near1', ownerId: owner, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, tile: state.regions[state.nations[target].capitalRegionId].tile, regionId: state.nations[owner].capitalRegionId } });
// The player (500 gold, no army) pressed by a far stronger `bully` on the bully's accord turn.
const pressedBy = (bully) => ({ ...S, turnNumber: onSlot(S, bully), units: armyNear(S, bully, P), resources: { ...S.resources, gold: 500 }, nations: { ...S.nations, [bully]: { ...S.nations[bully], militaryStrength: 50000 }, [P]: { ...S.nations[P], militaryStrength: 100 } } });

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
    const giant = { ...S, turnNumber: turn, units: armyNear(S, fr, other), nations: { ...S.nations, [fr]: { ...S.nations[fr], militaryStrength: 50000, economy: { ...S.nations[fr].economy, gold: 100 } }, [other]: { ...S.nations[other], militaryStrength: 100, hostility: 0, economy: { ...S.nations[other].economy, gold: 1000 } } } };
    const bigSorted = getSortedByMilitary(giant);
    const r = processAIAccords(giant, giant.nations, { turn, sortedByMilitary: bigSorted });
    const paid = r.nations[other].economy.gold < 1000;
    const refused = hasDemandCasusBelli({ ...giant, nations: r.nations }, fr, other);
    expect(paid || refused).toBe(true);
    if (paid) { expect(r.nations[fr].economy.gold).toBe(100 + (1000 - r.nations[other].economy.gold)); expect(r.logs.some((l) => /tribute/.test(l.message))).toBe(true); }
    expect(r.nations[fr].demandCooldowns[other]).toBeGreaterThan(turn);
    expect(AI_DEMAND_RATIO).toBe(2);
    // The player as the prey: use a touching AI of the player.
    const auTouch = touchingNations(S, P);
    if (auTouch.length) {
      const bully = auTouch[0];
      const t2 = onSlot(S, bully);
      const pressed = pressedBy(bully);
      const r2 = processAIAccords(pressed, pressed.nations, { turn: t2, sortedByMilitary: getSortedByMilitary(pressed) });
      expect(r2.pendingDemand).toMatchObject({ from: bully, kind: 'tribute', amount: tributeOf(pressed, P, bully), until: t2 + DEMAND_ANSWER_TURNS });
      expect(r2.pendingDemand.amount).toBeGreaterThanOrEqual(50);
      expect(r2.pendingDemand.amount).toBeLessThanOrEqual(250); // never more than half of the 500 held
      expect(r2.nations[P].lastDemandedTurn).toBe(t2);
      const withDemand = { ...pressed, nations: r2.nations, pendingDemand: r2.pendingDemand };
      expect(demandWaiting(withDemand)).toBe(true);
      expect(nextPrompts(withDemand).find((p) => p.kind === 'demand')).toMatchObject({ tab: 'diplomacy' });
      const paidUp = gameReducer(withDemand, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } });
      expect(paidUp.pendingDemand).toBeNull();
      expect(paidUp.resources.gold).toBe(500 - r2.pendingDemand.amount);
      expect(paidUp.nations[bully].economy.gold).toBe((pressed.nations[bully].economy.gold || 0) + r2.pendingDemand.amount);
      const said = gameReducer(withDemand, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: false } });
      expect(hasDemandCasusBelli(said, bully, P)).toBe(true);
      expect(said.resources.gold).toBe(500);
      // Silence past the deadline is a refusal.
      const late = { ...withDemand, turnNumber: t2 + DEMAND_ANSWER_TURNS + 1 };
      const r3 = processAIAccords(late, late.nations, { turn: late.turnNumber, sortedByMilitary: getSortedByMilitary(late) });
      expect(r3.pendingDemand).toBeNull();
      expect(r3.nations[bully].demandCasusBelli[P]).toBe(late.turnNumber + demandCbTurns(late));
      expect(answerDemand({ ...withDemand, pendingDemand: null }, true).message).toBeNull();
    }
  });

  // Playtest audits CB08 (I100 to I105, I109, addendum X21).
  it('paying buys a truce, an opinion reason and a log line; the quoted sum is the sum paid', () => {
    const bully = touchingNations(S, P)[0]; if (!bully) return;
    const pressed = pressedBy(bully); const t2 = pressed.turnNumber;
    const r = processAIAccords(pressed, pressed.nations, { turn: t2, sortedByMilitary: getSortedByMilitary(pressed) });
    const withDemand = { ...pressed, nations: r.nations, pendingDemand: r.pendingDemand };
    const terms = demandTerms(withDemand);
    expect(terms).toMatchObject({ from: bully, kind: 'tribute', amount: r.pendingDemand.amount, deadline: t2 + DEMAND_ANSWER_TURNS });
    expect(terms.pay).toMatchObject({ ok: true, truceTurns: demandTruceTurns(pressed), truceUntil: t2 + demandTruceTurns(pressed) });
    expect(terms.refuse).toMatchObject({ cbTurns: demandCbTurns(pressed) });
    expect(terms.pay.text).toMatch(/truce/i); expect(terms.refuse.text).toMatch(/cause for war/);
    // The player grows richer before answering: the sum does not move with the bank.
    const richer = { ...withDemand, resources: { ...withDemand.resources, gold: 5000 } };
    const before = opinionOf(richer, bully);
    const paid = gameReducer(richer, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } });
    expect(paid.resources.gold).toBe(5000 - r.pendingDemand.amount);
    expect(isInTruce(paid, bully, P)).toBe(true);
    expect(paid.nations[P].truces[bully]).toBe(t2 + demandTruceTurns(pressed));
    expect(opinionReasons(paid, bully).find((x) => x.id === 'metDemand')).toMatchObject({ value: 10 });
    expect(opinionOf(paid, bully)).toBeGreaterThanOrEqual(before + 10);
    expect(paid.logs[paid.logs.length - 1].message).toMatch(/truce holds between you until turn/i);
    // While the truce holds they ask nothing more, and the war roll leaves the payer alone (pickWarTarget reads isInTruce).
    const later = { ...paid, turnNumber: t2 + AI_ACCORD_PERIOD };
    expect(demandBlock(later, bully, P)).toMatchObject({ id: 'truce' });
    // Too little gold: the answer is rejected, nothing changes, the demand stays open.
    const poor = { ...withDemand, resources: { ...withDemand.resources, gold: 1 } };
    expect(demandTerms(poor).pay.ok).toBe(false);
    expect(answerDemand(poor, true)).toMatchObject({ rejected: true });
    expect(answerDemand(poor, true).state).toBe(poor);
  });

  it('no war roll picks a people with an open demand, and a demand between enemies is void', () => {
    const bully = touchingNations(S, P)[0]; if (!bully) return;
    const pressed = pressedBy(bully); const t2 = pressed.turnNumber;
    const r = processAIAccords(pressed, pressed.nations, { turn: t2, sortedByMilitary: getSortedByMilitary(pressed) });
    // Certain war: the bully's roll always passes (rng 0), it hates the player and has a cause.
    const angry = { ...pressed, nations: { ...r.nations, [bully]: { ...r.nations[bully], hostility: 100, doctrine: 'expansionist' } } };
    const rng = { next: () => 0 };
    const sortedNow = getSortedByMilitary(angry);
    const only = { [bully]: angry.nations[bully], [P]: angry.nations[P] };
    const free = processAIWarDecisions({ ...angry, pendingDemand: null }, only, [], sortedNow, rng);
    const held = processAIWarDecisions({ ...angry, pendingDemand: r.pendingDemand }, only, [], sortedNow, rng);
    // A war decided on the player: declared, or being armed for first (warPlans.js armedFor, lane ai-armies).
    const onPlayer = (res) => res.wars.some((w) => w.aggressor === bully && w.enemy === P) || res.nations[bully]?.warPrep?.target === P;
    expect(onPlayer(free)).toBe(true);
    expect(onPlayer(held)).toBe(false);
    // The player went to war with them anyway: the demand is void, nothing is paid, no casus belli.
    const atWar = { ...pressed, nations: r.nations, pendingDemand: r.pendingDemand, wars: [{ id: 'w', aggressor: P, enemy: bully, active: true, startTurn: t2 }] };
    const ans = answerDemand(atWar, true);
    expect(ans.state.pendingDemand).toBeNull();
    expect(ans.state.resources.gold).toBe(atWar.resources.gold);
    expect(ans.message).toMatch(/void/);
    expect(demandTerms(atWar).pay.ok).toBe(false);
    const r4 = processAIAccords(atWar, atWar.nations, { turn: t2 + 1, sortedByMilitary: sortedNow });
    expect(r4.pendingDemand).toBeNull();
    expect(hasDemandCasusBelli({ ...atWar, nations: r4.nations }, bully, P)).toBe(false);
  });

  it('demands are gated: partners and friends are not pressed, the threat must be near, and nobody is pressed twice in a row', () => {
    const bully = touchingNations(S, P)[0]; if (!bully) return;
    const pressed = pressedBy(bully);
    expect(demandBlock(pressed, bully, P)).toBeNull();
    const withBully = (patch) => ({ ...pressed, nations: { ...pressed.nations, [bully]: { ...pressed.nations[bully], ...patch } } });
    expect(demandBlock(withBully({ hasTradeAgreement: true }), bully, P)).toMatchObject({ id: 'agreement' });
    expect(demandBlock(withBully({ hasMilitaryPact: true }), bully, P)).toMatchObject({ id: 'agreement' });
    expect(demandBlock(withBully({ openBordersWith: { [P]: true } }), bully, P)).toMatchObject({ id: 'agreement' });
    expect(demandBlock(withBully({ marriageWith: [P] }), bully, P)).toMatchObject({ id: 'agreement' });
    expect(demandBlock(withBully({ truces: { [P]: pressed.turnNumber + 5 } }), bully, P)).toMatchObject({ id: 'truce' });
    expect(demandBlock(withBully({ demandCooldowns: { [P]: pressed.turnNumber + 1 } }), bully, P)).toMatchObject({ id: 'cooldown' });
    expect(demandBlock(withBully({ demandMet: { [P]: { until: pressed.turnNumber + 99, kind: 'tribute' } } }), bully, P)).toMatchObject({ id: 'friendly' }); // 8 + 10 = 18
    expect(demandBlock({ ...withBully({ militaryStrength: 100 }), units: { near1: { ...pressed.units.near1, strength: 5 } } }, bully, P)).toMatchObject({ id: 'weak' });
    // No army of theirs near the player's cities: an empty threat is not made (I109).
    expect(forceNear({ ...pressed, units: {} }, bully, P)).toBe(0);
    expect(demandBlock({ ...pressed, units: {} }, bully, P)).toMatchObject({ id: 'far' });
    // Another people pressed the player lately (A11: many neighbours cannot take turns).
    const gap = demandGapTurns(pressed);
    const justPressed = { ...pressed, nations: { ...pressed.nations, [P]: { ...pressed.nations[P], lastDemandedTurn: pressed.turnNumber - 1 } } };
    expect(demandBlock(justPressed, bully, P)).toMatchObject({ id: 'recent' });
    expect(demandBlock({ ...justPressed, turnNumber: pressed.turnNumber + gap }, bully, P, pressed.turnNumber + gap)).toBeNull();
    expect(processAIAccords(justPressed, justPressed.nations, { turn: justPressed.turnNumber, sortedByMilitary: getSortedByMilitary(justPressed) }).pendingDemand).toBeNull();
    // Waits follow the game speed (trap T11): longer in turns at Marathon, the same span of history.
    expect(demandCooldownTurns({ ...pressed, gameSpeed: 'marathon' })).toBeGreaterThan(demandCooldownTurns(pressed));
    expect(demandCooldownTurns(pressed)).toBe(24);
    // A payer who holds too little is asked for nothing: no demand of 0 gold.
    const broke = { ...pressed, resources: { ...pressed.resources, gold: 40 } };
    expect(processAIAccords(broke, broke.nations, { turn: broke.turnNumber, sortedByMilitary: getSortedByMilitary(broke) }).pendingDemand).toBeNull();
  });

  it('a war ends the truce and the peace treaty between the two (I105)', () => {
    const bully = touchingNations(S, P)[0]; if (!bully) return;
    const peace = { ...S, nations: { ...S.nations, [bully]: { ...S.nations[bully], hasPeaceTreaty: true, truces: { [P]: 99 } }, [P]: { ...S.nations[P], truces: { [bully]: 99 } } } };
    const war = declareWar(peace, bully, { aggressor: P });
    expect(war.nations[bully].hasPeaceTreaty).toBe(false);
    expect(war.nations[bully].truces[P]).toBeUndefined();
    expect(war.nations[P].truces[bully]).toBeUndefined();
    expect(war.nations[bully].hostilityFloor).toBeGreaterThanOrEqual(40); // the broken treaty is still remembered
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
    const bully = touchingNations(S, P)[0];
    if (!bully) return;
    // A second city of the player the bully claims (never the capital).
    const added = addCity(S, P, { near: S.nations[P].capitalRegionId });
    let s = added.state;
    s = { ...s, nations: { ...s.nations, [bully]: { ...s.nations[bully], claims: [added.cityId], militaryStrength: 50000 }, [P]: { ...s.nations[P], militaryStrength: 100 } }, units: armyNear(S, bully, P) };
    expect(demandKind(s, bully, P)).toEqual({ kind: 'city', cityId: added.cityId });
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
    expect(refused.regions[added.cityId].owner).toBe(P);
    expect(hasDemandCasusBelli(refused, bully, P)).toBe(true);
    // Without a claim, a nation settled next to is asked to stop; the promise bars its sites.
    const noClaim = { ...withDemand, pendingDemand: null, nations: { ...withDemand.nations, [bully]: { ...withDemand.nations[bully], claims: [] } } };
    const kind = demandKind(noClaim, bully, P);
    expect(['stopSettling', 'tribute']).toContain(kind.kind);
    const stop = { ...noClaim, pendingDemand: { from: bully, kind: 'stopSettling', cityId: null, amount: 0, turn: t2, until: t2 + 3 } };
    const promised = gameReducer(stop, { type: ActionTypes.ANSWER_DEMAND, payload: { accept: true } });
    expect(promised.nations[P].noSettleNear[bully]).toBe(t2 + 50);
    expect(promised.logs[promised.logs.length - 1].message).toMatch(/promise/);
  });
});
