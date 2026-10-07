// Phase W4: the independents' view models (the sheet, the list, the map marks, the tribute and join
// sheets) and the engine views behind them (grudge causes, raid forecast and ETA, the checks).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { ringsForKm } from '../../data/geo/gridScale';
import { ringsAround } from '../../engine/world/cities';
import { RAID_KM, GRUDGE_ATTACKED, GRUDGE_REFUSED, GIFT_GOLD, TRIBUTE_TURNS, garrisonTarget, isIndependentNation, tributeGold } from '../../data/independents';
import { withGrudge, decayGrudges, grudgeCausesOf, addGrudge } from '../../engine/grudges';
import { startTribute, raidForecast, raidEta, answerTributeDemand } from '../../engine/raids';
import { demandTributeCheck, offerTributeCheck, tradeCheck } from '../../engine/indepPolicy';
import { independentSheetModel, independentSummary, attitudeWord, grudgeWord } from './independentSheetModel';
import { independentsListModel, LIST_FILTERS } from './independentsListModel';
import { raidMapModel, raidMapEmpty } from './raidMapModel';
import { tributeDemandModel, joinOfferModel } from './tributeSheetModel';
import { shieldUrl, actionIconUrl, dressingUrl, tribalCampUrl, burningTownFxUrl } from './independentArt';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const me = base.playerNationId;
const T = base.turnNumber;
const unit = (id, owner, regionId, tile, classId = 'infantry') => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });
const indeps = (p) => Object.values(base.nations).filter((n) => isIndependentNation(n) && !n.isEliminated && (!p || n.indep?.personality === p));

// The raiders independent nearest the player's capital, alone with the player, the player's land
// left without soldiers and the raider given a party of three above its garrison.
const duel = () => {
  const tiles = getTiles();
  const capital = base.regions[base.nations[me].capitalRegionId];
  const near = ringsAround(tiles, capital.tile, ringsForKm(RAID_KM.raiders));
  const raider = indeps('raiders').filter((n) => near.has(base.regions[n.capitalRegionId]?.tile))
    .sort((a, b) => near.get(base.regions[a.capitalRegionId].tile) - near.get(base.regions[b.capitalRegionId].tile))[0];
  const home = base.regions[raider.capitalRegionId];
  const units = {};
  Object.values(base.units).forEach((u) => { if (u.ownerId !== me && u.ownerId !== raider.id) units[u.id] = u; });
  const n = garrisonTarget(home.size, 'raiders') + 3;
  for (let i = 0; i < n; i++) units[`r${i}`] = unit(`r${i}`, raider.id, home.id, home.tile, 'cavalry');
  return { s: { ...base, units }, raider, home, capital };
};

describe('W4 engine views', () => {
  it('a grudge remembers its causes, newest first, and forgets them when it fades to nothing', () => {
    const r = indeps('raiders')[0];
    let n = withGrudge(r, me, GRUDGE_ATTACKED, { id: 'killed', turn: 4 });
    n = withGrudge(n, me, GRUDGE_REFUSED, { id: 'refused', turn: 9 });
    expect(grudgeCausesOf(n, me)).toEqual([{ id: 'refused', turn: 9, amount: GRUDGE_REFUSED }, { id: 'killed', turn: 4, amount: GRUDGE_ATTACKED }]);
    // No cause given: the number rises, the log stays as it was.
    expect(grudgeCausesOf(withGrudge(n, me, 5), me)).toHaveLength(2);
    let faded = n;
    for (let i = 0; i < 40; i++) faded = decayGrudges(faded);
    expect(faded.indep.grudges[me]).toBeUndefined();
    expect(grudgeCausesOf(faded, me)).toEqual([]);
    // addGrudge passes the cause through.
    expect(grudgeCausesOf(addGrudge(base.nations, r.id, me, 10, { id: 'pillaged', turn: 2 })[r.id], me)[0].id).toBe('pillaged');
  });

  it('refusing a demand logs the refusal as the cause', () => {
    const r = indeps('raiders')[0];
    const s = { ...base, tributeDemands: [{ id: 'd1', indepId: r.id, gold: 3, turns: TRIBUTE_TURNS, turn: T, expires: T + 3 }] };
    const out = answerTributeDemand(s, 'd1', false);
    expect(grudgeCausesOf(out.nations[r.id], me)[0]).toMatchObject({ id: 'refused', amount: GRUDGE_REFUSED });
  });

  it('forecasts the raid a refusal would bring, and the ETA of a party on its way', () => {
    const { s, raider } = duel();
    const f = raidForecast(s, raider.id, me);
    expect(f).not.toBeNull();
    expect(['pillage', 'route', 'settler', 'outpost', 'sack']).toContain(f.kind);
    expect(f.partyStrength).toBeGreaterThan(0);
    // A truce does not hide the forecast (the question is "if we refuse").
    const paying = { ...s, nations: startTribute(s.nations, raider.id, me, 3, 0) };
    expect(raidForecast(paying, raider.id, me)?.kind).toBe(f.kind);
    // A mercantile city never raids.
    expect(raidForecast(s, indeps('mercantile')[0].id, me)).toBeNull();
    // A party three steps out on flat cost arrives in at least one turn.
    const route = getTiles().neighbors[s.regions[raider.capitalRegionId].tile].slice(0, 1);
    const units = { ...s.units, r0: { ...s.units.r0, raidOf: raider.id } };
    const nations = { ...s.nations, [raider.id]: { ...raider, indep: { ...raider.indep, raid: { kind: f.kind, targetTile: f.tile, targetNationId: me, phase: 'out', route, startedTurn: 0, startStrength: 1000 } } } };
    const eta = raidEta({ ...s, units, nations }, raider.id);
    expect(eta.steps).toBe(1);
    expect(eta.turns).toBe(1);
    expect(raidEta(s, raider.id)).toBeNull();
  });

  it('the checks give reasons before the tap; offering tribute is a truce both ways', () => {
    const fort = indeps('fortress')[0];
    expect(demandTributeCheck(base, fort.id)).toMatchObject({ ok: true, would: false });
    expect(demandTributeCheck(base, fort.id).reason).toMatch(/fortress/i);
    const merc = indeps('mercantile')[0];
    expect(offerTributeCheck(base, merc.id)).toMatchObject({ ok: false });
    expect(tradeCheck(base, indeps('tribal')[0].id)).toMatchObject({ ok: false, reason: 'Only a mercantile city trades.' });
    const r = indeps('raiders')[0];
    const out = gameReducer(base, { type: ActionTypes.OFFER_INDEPENDENT_TRIBUTE, payload: { independentId: r.id } });
    expect(out.nations[r.id].indep.tributeFrom[me]).toMatchObject({ gold: tributeGold(base.age), until: base.turnNumber + TRIBUTE_TURNS });
    expect(offerTributeCheck(out, r.id).ok).toBe(false);
    expect(demandTributeCheck(out, r.id).reason).toMatch(/you pay them tribute/i);
  });
});

describe('W4 independent sheet model', () => {
  it('shows personality, attitude with reasons, grudge with causes and decay, and honest actions', () => {
    const { s, raider } = duel();
    const nations = addGrudge(s.nations, raider.id, me, 30, { id: 'killed', turn: 1 });
    const m = independentSheetModel({ ...s, nations, resources: { ...s.resources, gold: 1000 } }, raider.id);
    expect(m.personality).toMatchObject({ id: 'raiders', name: 'Raiders' });
    expect(m.alive).toBe(true);
    expect(m.facts).toContain(`garrison ${garrisonTarget(s.regions[raider.capitalRegionId].size, 'raiders') + 3}`);
    expect(m.grudge).toMatchObject({ value: 30, fadesIn: 15, word: grudgeWord(30) });
    expect(m.grudge.causes[0]).toMatchObject({ label: 'Killed their soldiers', turn: 1, amount: 30 });
    expect(m.grudge.effects.join(' ')).toMatch(/raids on you 30% likelier/);
    expect(m.attitude.word).toBe(attitudeWord(m.attitude.value));
    expect(m.attitude.joinable).toBe(false);
    const ids = m.actions.map((a) => a.id);
    expect(ids).toEqual(['attack', 'payTribute', 'join', 'gift', 'demandTribute', 'hire']);
    const byId = Object.fromEntries(m.actions.map((a) => [a.id, a]));
    expect(byId.attack).toMatchObject({ label: 'Attack without war', ok: true });
    expect(byId.join).toMatchObject({ label: 'Ask to join', ok: false, sub: 'raiders never join' });
    expect(byId.join.reason).toMatch(/Raiders/);
    expect(byId.gift.ok).toBe(true);
    expect(m.actions.filter((a) => a.tone === 'primary')).toHaveLength(0);
  });

  it('a pending demand makes Pay the one primary action; tribute you pay blocks the attack with a reason', () => {
    const { s, raider } = duel();
    const withDemand = { ...s, tributeDemands: [{ id: 'd1', indepId: raider.id, gold: 3, turns: 20, turn: T, expires: T + 3 }] };
    const m = independentSheetModel(withDemand, raider.id);
    expect(m.deals.demand).toMatchObject({ gold: 3, turnsLeft: 3, afterRefuse: GRUDGE_REFUSED });
    expect(m.actions.filter((a) => a.tone === 'primary').map((a) => a.id)).toEqual(['payTribute']);
    expect(m.actions.find((a) => a.id === 'payTribute').run.action).toEqual({ type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: 'd1', pay: true } });
    const paying = { ...s, nations: startTribute(s.nations, raider.id, me, 3, 0) };
    const p = independentSheetModel(paying, raider.id);
    expect(p.deals.youPay).toEqual({ gold: 3, until: TRIBUTE_TURNS });
    expect(p.actions.find((a) => a.id === 'attack')).toMatchObject({ ok: false });
    expect(p.actions.find((a) => a.id === 'attack').reason).toMatch(`turn ${TRIBUTE_TURNS}`);
  });

  it('mercantile cities offer trade and mercenaries priced by the engine; a poor player gets the reason', () => {
    expect(independentSheetModel(base, indeps('mercantile')[0].id).actions.map((a) => a.id)).toContain('trade');
    const merc = indeps().find((n) => independentSheetModel(base, n.id).mercs?.offer);
    const m = independentSheetModel({ ...base, resources: { ...base.resources, gold: 0 } }, merc.id);
    expect(m.mercs.offer).toMatchObject({ turns: 20 });
    expect(m.mercs.offer.unit).toBeTruthy();
    const hire = m.actions.find((a) => a.id === 'hire');
    expect(hire.ok).toBe(false);
    expect(hire.reason).toMatch(/You need \d+ gold/);
    const gift = m.actions.find((a) => a.id === 'gift');
    expect(gift).toMatchObject({ ok: false, reason: `You need ${GIFT_GOLD} gold (you have 0).` });
  });

  it('the city card summary names the raid, the demand and the deals', () => {
    const { s, raider } = duel();
    const f = raidForecast(s, raider.id, me);
    const units = { ...s.units, r0: { ...s.units.r0, raidOf: raider.id } };
    const nations = { ...s.nations, [raider.id]: { ...raider, indep: { ...raider.indep, raid: { kind: f.kind, targetTile: f.tile, targetCityId: f.cityId, targetNationId: me, phase: 'out', route: [f.tile], startedTurn: 0, startStrength: 1000 } } } };
    const sum = independentSummary({ ...s, units, nations, tributeDemands: [{ id: 'd1', indepId: raider.id, gold: 3, turns: 20, turn: T, expires: T + 2 }] }, raider.id);
    expect(sum.lines.map((l) => l.tone)).toEqual(['bad', 'warn']);
    expect(sum.lines[0].text).toMatch(/Their raiders are heading for/);
    expect(sum.lines[1].text).toMatch(/answer within 2 turns/);
  });
});

describe('W4 raid outcome', () => {
  it('a raid that reaches the player records its outcome for the sheet and the city card', async () => {
    const { processIndependents } = await import('../../engine/raids');
    const { s, raider } = duel();
    const f = raidForecast(s, raider.id, me);
    // The party stands next to its target: one turn of the independents' phase resolves it.
    const units = { ...s.units, r0: { ...s.units.r0, raidOf: raider.id, tile: f.tile }, r1: { ...s.units.r1, raidOf: raider.id, tile: f.tile } };
    const nations = { ...s.nations, [raider.id]: { ...raider, indep: { ...raider.indep, raid: { kind: f.kind, targetTile: f.tile, targetCityId: f.cityId, targetNationId: me, phase: 'out', route: [], startedTurn: T, startStrength: 2000, warned: true } } } };
    const st = { ...s, units, nations, turnNumber: T + 1 };
    const out = processIndependents(st);
    // A battle against the player (a sack, or troops on the target) waits in the battle queue for
    // Command or Auto (phase R3); fought on Auto here.
    const { resolveAllQueuedAuto } = await import('../../engine/battleQueue');
    const after = resolveAllQueuedAuto({ ...st, nations: out.nations, units: out.units, regions: out.regions, resources: out.resources, world: out.world, pendingDefenses: out.queued });
    const rec = after.nations[raider.id].indep.lastRaidOnPlayer;
    expect(rec).toMatchObject({ turn: T + 1, kind: f.kind });
    expect(after.nations[raider.id].indep.raid?.phase ?? 'home').not.toBe('battle');
    expect(rec.text).toMatch(rec.won ? /^They / : /drove off/);
    expect(independentSheetModel(after, raider.id).deals.lastRaid).toMatchObject({ won: rec.won, ago: 0 });
    if (rec.won) expect(independentSummary(after, raider.id).lines[0].text).toMatch(`Turn ${T + 1}: They `);
  });
});

describe('W4 independents list model', () => {
  it('lists the met independents with distance, attitude, grudge and deal; sorts and filters', () => {
    const r = indeps('raiders')[0];
    const s = { ...base, fog: { ...(base.fog || {}), on: false }, nations: addGrudge(base.nations, r.id, me, 60), tributeDemands: [{ id: 'd1', indepId: r.id, gold: 3, turns: 20, turn: T, expires: T + 3 }] };
    const all = independentsListModel(s);
    expect(all.total).toBe(indeps().length);
    for (let i = 1; i < all.rows.length; i++) expect(all.rows[i].km).toBeGreaterThanOrEqual(all.rows[i - 1].km);
    const byGrudge = independentsListModel(s, { sort: 'grudge' });
    expect(byGrudge.rows[0]).toMatchObject({ id: r.id, grudge: 60, deal: { kind: 'demand' } });
    const threats = independentsListModel(s, { filter: 'threats' });
    expect(threats.rows.map((x) => x.id)).toEqual([r.id]);
    expect(threats.counts.threats).toBe(1);
    const fort = independentsListModel(s, { filter: 'fortress' });
    expect(fort.rows.every((x) => x.personality === 'fortress')).toBe(true);
    expect(fort.rows.length).toBe(fort.counts.fortress);
    expect(LIST_FILTERS.map((f) => f.id)).toEqual(['all', 'deals', 'threats', 'raiders', 'mercantile', 'fortress', 'tribal']);
    // Unmet independents stay off the list (the fog hook).
    const fogged = { ...s, fog: { ...base.fog, on: true, met: { [me]: { [r.id]: 1 } } } };
    expect(independentsListModel(fogged).rows.map((x) => x.id)).toEqual([r.id]);
  });
});

describe('W4 raid marks on the map', () => {
  it('shows a party in sight with its route, ETA and the warning ring on its target; nothing in the fog', () => {
    const { s, raider, home } = duel();
    const f = raidForecast(s, raider.id, me);
    const route = getTiles().neighbors[home.tile].slice(0, 1).concat([f.tile]);
    const units = { ...s.units, r0: { ...s.units.r0, raidOf: raider.id } };
    const nations = { ...s.nations, [raider.id]: { ...raider, indep: { ...raider.indep, raid: { kind: f.kind, targetTile: f.tile, targetCityId: f.cityId, targetNationId: me, phase: 'out', route, startedTurn: 0, startStrength: 1000, warned: false } } } };
    const st = { ...s, units, nations };
    const seen = raidMapModel(st, new Set([home.tile]));
    expect(seen.parties).toHaveLength(1);
    expect(seen.parties[0]).toMatchObject({ id: raider.id, tile: home.tile, targetTile: f.tile, againstYou: true, route });
    expect(seen.parties[0].eta).toBeGreaterThanOrEqual(1);
    expect(seen.warnings).toEqual([expect.objectContaining({ tile: f.tile, id: raider.id })]);
    const fog = raidMapModel(st, new Set());
    expect(raidMapEmpty(fog)).toBe(true);
    // Once warned, the ring shows even with the party in the fog.
    const warned = { ...st, nations: { ...nations, [raider.id]: { ...nations[raider.id], indep: { ...nations[raider.id].indep, raid: { ...nations[raider.id].indep.raid, warned: true } } } } };
    expect(raidMapModel(warned, new Set()).warnings).toHaveLength(1);
  });

  it('the WebGL map turns the lists into dashed routes, rings, labels and tappable hits', async () => {
    const { geoEquirectangular } = await import('d3-geo');
    const { raidShapes } = await import('../map/gl/raidShapes');
    const projection = geoEquirectangular().fitSize([844, 390], { type: 'Sphere' });
    const { s, raider, home } = duel();
    const f = raidForecast(s, raider.id, me);
    const route = getTiles().neighbors[home.tile].slice(0, 2);
    const model = {
      parties: [{ id: raider.id, tile: home.tile, route, targetTile: f.tile, kind: f.kind, kindWord: 'sack', target: 'Kish', eta: 2, againstYou: true, phase: 'out' }],
      warnings: [{ tile: f.tile, id: raider.id, kind: f.kind, target: 'Kish', eta: 2 }],
      sieges: [{ cityId: 'c1', tile: home.tile, name: 'X', by: 'elam', byName: 'Elam', owner: raider.id, ownerName: 'Y', hp: 0.5, encircled: false }],
      burning: []
    };
    const out = raidShapes({ model, projection, k: 40, dpr: 1 });
    expect(out.lines.some((l) => l.dash > 0)).toBe(true);
    expect(out.hits.every((h) => h.kind === 'indep')).toBe(true);
    expect(out.hits.map((h) => h.id)).toContain(raider.id);
    expect(out.sprites.length).toBeGreaterThanOrEqual(3);
    expect(raidShapes({ model: { parties: [], warnings: [], sieges: [], burning: [] }, projection, k: 4, dpr: 1 })).toEqual({ lines: [], sprites: [], hits: [] });
  });

  it('shows sieges of independents by others and burning cities, in sight only', () => {
    const t = indeps('tribal')[0];
    const city = base.regions[t.capitalRegionId];
    const other = Object.keys(base.nations).find((id) => id !== me && !isIndependentNation(base.nations[id]));
    const s = { ...base, regions: { ...base.regions, [city.id]: { ...city, siege: { by: other, hp: 50, maxHp: 200, encircled: true } } } };
    const m = raidMapModel(s, new Set([city.tile]));
    expect(m.sieges).toEqual([expect.objectContaining({ cityId: city.id, by: other, hp: 0.25, encircled: true })]);
    expect(raidMapModel(s, new Set()).sieges).toEqual([]);
    const burning = { ...base, regions: { ...base.regions, [city.id]: { ...city, owner: other, razing: { by: other, startedTurn: 1 } } } };
    expect(raidMapModel(burning, new Set([city.tile])).burning).toEqual([expect.objectContaining({ cityId: city.id, by: other })]);
  });
});

describe('W4 tribute and join sheets', () => {
  it('the tribute sheet offers Pay, Refuse with the expected loss, and Refuse and hire', () => {
    const { s, raider } = duel();
    const st = { ...s, resources: { ...s.resources, gold: 500 }, tributeDemands: [{ id: 'd1', indepId: raider.id, gold: 3, turns: 20, turn: T, expires: T + 3 }] };
    const m = tributeDemandModel(st, 'd1');
    expect(m).toMatchObject({ gold: 3, turns: 20, turnsLeft: 3, grudge: { value: 0, after: GRUDGE_REFUSED } });
    expect(m.loss).not.toBeNull();
    const ids = m.choices.map((c) => c.id);
    expect(ids.slice(0, 2)).toEqual(['pay', 'refuse']);
    expect(m.choices[1].text).toMatch(/^If they come: /);
    const hire = m.choices.find((c) => c.id === 'hire');
    if (hire) {
      expect(hire.actions.map((a) => a.type)).toEqual([ActionTypes.HIRE_MERCENARY, ActionTypes.ANSWER_TRIBUTE_DEMAND]);
      expect(hire.actions[0].payload.independentId).not.toBe(raider.id);
    }
    expect(['pay', 'refuse']).toContain(m.preferred);
    expect(tributeDemandModel(st, 'nope')).toBeNull();
  });

  it('a join offer lists what the player gains and the two answers', () => {
    const t = indeps('tribal')[0];
    const s = { ...base, joinOffers: [{ id: 'j1', indepId: t.id, turn: 0, expires: 5 }] };
    const m = joinOfferModel(s, 'j1');
    expect(m.city.id).toBe(t.capitalRegionId);
    expect(m.gains[0]).toMatch(m.city.name);
    expect(m.accept).toEqual({ type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: 'j1', accept: true } });
    const out = gameReducer(s, m.accept);
    expect(out.regions[t.capitalRegionId].owner).toBe(me);
  });
});

describe('W4 art hooks', () => {
  it('resolves delivered art or null (placeholders) for shields, icons, dressings, camps and the burning town', () => {
    ['raiders', 'mercantile', 'fortress', 'tribal'].forEach((p) => { const u = shieldUrl(p); expect(u === null || typeof u === 'string').toBe(true); });
    ['raid', 'raze', 'tribute', 'grudge', 'join', 'trade', 'hire', 'contract'].forEach((k) => { const u = actionIconUrl(k); expect(u === null || typeof u === 'string').toBe(true); });
    const d = dressingUrl('raiders', 'bronze'); expect(d === null || typeof d === 'string').toBe(true);
    const c = tribalCampUrl('steppe'); expect(c === null || typeof c === 'string').toBe(true);
    const b = burningTownFxUrl(); expect(b === null || typeof b === 'string').toBe(true);
    expect(shieldUrl('nope')).toBeNull();
  });
});
