// A cut trade route is an event with a cause, a length and an end (playtest audits CB08: I113 to I115).
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { getTradeRoute } from './tradeRoutes';
import { plunderedRoutes, PLUNDER_GOLD } from './plunder';
import { tradeRoutesValue } from './tradeValue';
import { advanceTradeDisruptions, tradeRouteStatus, plunderCutTurns, plunderGuardTurns } from './tradeDisruptions';
import { summarizeLogs } from './logSummary';
import { nationSheetModel } from '../components/map/nationSheetModel';

const unit = (id, ownerId, tile, regionId, extra = {}) => ({ id, ownerId, tile, regionId, homeRegionId: regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, ...extra });
const base = () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  return { ...s, scenario: s.scenario || { mode: 'test' }, nations: { ...s.nations, de: { ...s.nations.de, hasTradeAgreement: true } }, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
};
// Every land tile round Paris held by `owner`: the only roads out are cut.
const ringed = (s, owner, regionId = null) => {
  const tiles = getTiles(); const paris = s.regions[getNationCapital('fr')];
  const units = { ...s.units };
  tiles.neighbors[paris.tile].filter((t) => tiles.land[t] === 1).forEach((t, i) => { units[`x${i}`] = unit(`x${i}`, owner, t, regionId); });
  return { ...s, units };
};
// The turns of the event alone (no other system moves the stacks): [{ turn, logs, loot, state }].
const run = (start, turns, change = () => null) => {
  const out = []; let s = start;
  for (let i = 0; i < turns; i++) {
    const turn = s.turnNumber + 1;
    s = { ...s, turnNumber: turn, ...(change(turn, s) || {}) };
    const r = advanceTradeDisruptions(s, turn);
    s = { ...s, tradeDisruptions: r.disruptions };
    out.push({ turn, logs: r.logs, loot: r.loot, state: s });
  }
  return out;
};

describe('a cut trade route is an event', () => {
  it('rebels on the only road: one line at the start, no line a turn, open again under guard after the cut time', () => {
    const s = base();
    expect(tradeRouteStatus(s, 'de')).toMatchObject({ phase: 'open', pays: true });
    const cut = ringed(s, 'rebels');
    expect(getTradeRoute(cut, 'de').ok).toBe(false); // no sea route stands in for this pair
    expect(plunderedRoutes(cut)).toHaveLength(1);
    const cutTurns = plunderCutTurns(cut); const guardTurns = plunderGuardTurns(cut);
    const turns = run(cut, cutTurns + guardTurns + 6);
    // Turn 1: the event starts, with the place, the cause and what to do. Rebels take no gold.
    expect(turns[0].logs).toHaveLength(1);
    expect(turns[0].logs[0].message).toMatch(/Rebels plunder your land trade route to .*rebels hold the road.*until they are driven off or the caravans find a way past/);
    expect(turns[0].loot).toEqual([]);
    const first = turns[0].state;
    expect(first.tradeDisruptions.de).toMatchObject({ phase: 'cut', by: 'rebels', kind: 'land', lost: 1 });
    // While it is cut: nothing is paid, the card says so, where and why, and no line is written.
    expect(tradeRoutesValue(first).find((r) => r.partnerId === 'de')).toBeUndefined();
    const status = tradeRouteStatus(first, 'de');
    expect(status).toMatchObject({ phase: 'cut', pays: false, by: 'rebels', turnsLeft: cutTurns });
    expect(status.text).toMatch(/Pays nothing now: cut at .*rebels hold the road/);
    expect(status.advice).toMatch(/Drive them off/);
    expect(nationSheetModel(first, 'de').relations.find((r) => r.id === 'trade')).toMatchObject({ tone: 'bad' });
    for (let i = 1; i < cutTurns; i++) expect(turns[i].logs).toEqual([]);
    // After the cut time the caravans go under guard: one line, the route pays again though the rebels still stand there.
    const guarded = turns[cutTurns];
    expect(guarded.logs).toHaveLength(1);
    expect(guarded.logs[0].message).toMatch(/travel under guard past the rebels .*open again after \d+ turns/);
    expect(guarded.state.tradeDisruptions.de.phase).toBe('guarded');
    expect(getTradeRoute(guarded.state, 'de')).toMatchObject({ ok: true, kind: 'land' });
    expect(tradeRoutesValue(guarded.state).find((r) => r.partnerId === 'de')).toBeTruthy();
    expect(tradeRouteStatus(guarded.state, 'de')).toMatchObject({ phase: 'guarded', pays: true });
    expect(plunderedRoutes(guarded.state)).toEqual([]);
    // The same stack never cuts the road again while it stands there: two lines in all, however long it stays.
    const lines = turns.flatMap((t) => t.logs);
    expect(lines).toHaveLength(2);
    expect(turns[turns.length - 1].state.tradeDisruptions.de.phase).toBe('guarded');
    expect(summarizeLogs(lines.map((l) => ({ ...l, year: 1 })))).toHaveLength(2);
  });

  it('driving the raiders off ends it at once, with the turns lost; a plunderer at war is paid once', () => {
    const s = base();
    const war = { ...ringed(s, 'be', getNationCapital('be')), wars: [{ id: 'w1', aggressor: 'be', enemy: 'fr', active: true, startTurn: 1 }] };
    expect(getTradeRoute(war, 'de').ok).toBe(false);
    const turns = run(war, 4, (turn, cur) => (turn === war.turnNumber + 3 ? { units: Object.fromEntries(Object.entries(cur.units).filter(([, u]) => u.ownerId !== 'be')) } : null));
    expect(turns[0].loot).toEqual([{ by: 'be', gold: PLUNDER_GOLD }]);
    expect(turns[0].logs[0].message).toMatch(/at war with you, holds the road/);
    expect(turns[1].loot).toEqual([]); expect(turns[1].logs).toEqual([]);
    expect(turns[2].logs).toHaveLength(1);
    expect(turns[2].logs[0].message).toMatch(/is open again: .* are gone \(2 turns of trade lost\)/);
    expect(turns[2].state.tradeDisruptions.de).toBeUndefined();
    expect(tradeRouteStatus(turns[2].state, 'de')).toMatchObject({ phase: 'open', pays: true });
    expect(turns[3].logs).toEqual([]);
    // Through the whole turn: the plunderer's gold moves once, and the state carries the event.
    const next = resolveTurn(war);
    const quiet = resolveTurn({ ...war, nations: { ...war.nations, de: { ...war.nations.de, hasTradeAgreement: false } } });
    expect(next.nations.be.economy.gold - quiet.nations.be.economy.gold).toBe(PLUNDER_GOLD);
    expect(next.tradeDisruptions.de).toMatchObject({ phase: 'cut', by: 'be' });
    expect(quiet.tradeDisruptions).toEqual({});
  });

  it('an agreement that pays nothing says so; an ended agreement drops its event', () => {
    const s = base();
    expect(tradeRouteStatus(s, 'be')).toBeNull();
    expect(tradeRouteStatus(s, 'de').text).toMatch(/^Open by land.*% gold/);
    const cut = ringed(s, 'rebels');
    if (getTradeRoute(cut, 'de').ok) return;
    const [t1] = run(cut, 1);
    const ended = { ...t1.state, nations: { ...t1.state.nations, de: { ...t1.state.nations.de, hasTradeAgreement: false } } };
    const r = advanceTradeDisruptions({ ...ended, turnNumber: ended.turnNumber + 1 });
    expect(r.disruptions).toEqual({});
    expect(r.logs).toEqual([]);
    // Nothing to do: the same object comes back.
    const held = { ...s, tradeDisruptions: {} };
    expect(advanceTradeDisruptions(held).disruptions).toBe(held.tradeDisruptions);
  });
});
