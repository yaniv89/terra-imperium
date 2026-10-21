// src/engine/cityLossNotices.test.js
// Follow-up 22: every way the player can lose a city tells the player why, in a log line that
// names the city (the turn report's lost-city item quotes it). Battles also leave a battle report
// (defense.test.js: lost on Auto, the garrison's withdrawal, the old dice roll).
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD, REVOLT_SUCCESS_TURNS } from '../data/rebellion';
import { applyLoyalty } from './loyalty';
import { conquerRegion } from './conquest';
import { grantDemand } from './accords';
import { addCity, neighbourWorld, peoplesWorld, rivalOf } from './testWorld';
import { syncWorldRegistry } from './world/registry';
import { turnReportModel } from '../components/ui/turnReportModel';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const W = quiet(peoplesWorld({ seed: 11 }));
const P = W.playerNationId; const R = rivalOf(W, 0);
const named = (logs, city) => logs.filter((l) => String(l.message || '').includes(city.name));

describe('the player is told of every city lost', () => {
  it('handed over in the peace: a line per ceded city, and the turn report quotes it', () => {
    const { state: s0, cityId } = addCity(W, P);
    const war = { id: 'war_x', aggressor: R, enemy: P, active: true, goalAchieved: false, startTurn: 1, cb: 'none', battleScore: 0, tickScore: 0, score: -60, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: cityId } };
    const s = { ...s0, wars: [...(s0.wars || []), war], pendingPeaceOffer: { warId: war.id, from: R, terms: [{ type: 'cede', regionId: cityId }] } };
    const next = gameReducer(s, { type: ActionTypes.ACCEPT_PENDING_PEACE });
    expect(next.regions[cityId].owner).toBe(R);
    const lines = named(next.logs.slice(s.logs.length), s.regions[cityId]);
    expect(lines.map((l) => l.msgKey)).toContain('m.diplo.cededInPeace');
    const lost = turnReportModel(s, { ...next, turnNumber: s.turnNumber + 1 }, 'en').items.find((i) => i.group === 'cities' && i.tone === 'danger');
    expect(lost.sub).toMatch(/handed over .* in the peace/);
  });

  it('yielded to a demand: the answer names the city', () => {
    const { state: s, cityId } = addCity(W, P);
    const out = grantDemand(s, s.nations, R, P, 'city', cityId);
    expect(out.regions[cityId].owner).toBe(R);
    expect(out.message).toContain(s.regions[cityId].name);
  });

  it('a revolt hands it back to its former owner, with a line', () => {
    const { state: s0, cityId } = addCity(W, P);
    syncWorldRegistry(s0);
    const rebel = { id: `rebel_${cityId}_1`, regionId: cityId, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', strength: 500, maxStrength: 500, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, spawnedTurn: 1 };
    const s = { ...s0, turnNumber: 1 + REVOLT_SUCCESS_TURNS, units: { [rebel.id]: rebel }, regions: { ...s0.regions, [cityId]: { ...s0.regions[cityId], formerOwner: R, unrest: REBELLION_UNREST_THRESHOLD + 5, control: 20 } } };
    const next = resolveTurn(s);
    expect(next.regions[cityId].owner).toBe(R);
    expect(named(next.logs.slice(s.logs.length), s.regions[cityId]).map((l) => l.msgKey)).toContain('m.turn.uprisingWon');
  });

  it('loyalty: a conquest that never settles goes over or stands free, and the player hears of it', () => {
    const S = { ...quiet(neighbourWorld({ seed: 3, fog: false, capitals: true })), units: {} };
    const FR = S.playerNationId; const AU = S.nations[rivalOf(S, 1)].capitalRegionId;
    const r = conquerRegion({ regions: S.regions, nations: S.nations, turnNumber: S.turnNumber }, AU, FR, null);
    const regions = { ...r.regions }; const nations = { ...r.nations };
    let logs = [];
    for (let turn = S.turnNumber + 1; turn <= S.turnNumber + 40 && regions[AU].owner === FR; turn++) logs = applyLoyalty({ ...S, regions, nations }, regions, {}, nations, turn).logs;
    expect(regions[AU].owner).not.toBe(FR);
    expect(logs.filter((l) => l.nationId === FR && l.message.includes(S.regions[AU].name)).map((l) => l.msgKey)).toEqual([expect.stringMatching(/^m\.city\.flip(Lost|Free|Independent)$/)]);
  });
});
