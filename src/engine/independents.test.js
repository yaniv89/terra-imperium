// Phase W1: passive independents and canFight (plans/independent-cities.md, src/engine/independents.js).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { getNationCapital } from '../data/regions';
import { PEOPLES, PEOPLES_LIST } from '../data/peoples';
import { WORLD_SIZES, EQUAL_START_SIZE } from '../data/worldSizes';
import {
  INDEPENDENT_KIND, PERSONALITY_IDS, PERSONALITY_MIX_TARGET, isIndependentNation, independentSizeCap, garrisonTarget, personalityFor, independentTitle, INDEPENDENT_ART
} from '../data/independents';
import { pickIndependents, finalizeIndependents, processLateArrivals, breakAwayAsIndependent, independentCityCtx, independentIdsOf } from './independents';
import { canFight, canAttack, hasMet, metOnlyBySight } from './hostility';
import { declareWar } from './diplomacy';
import { validateInvasion } from './invasion';
import { besiegersOf } from './sieges';
import { regionAccess } from './armies';
import { conquerRegion } from './conquest';
import { getNationTier, getSortedByMilitary } from '../utils/aiLogic';
import { chooseProduction } from './aiProduction';
import { assertGameState } from './stateAudit';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
const quiet = (s) => ({ ...s, firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const advance = (state) => {
  const answered = state.pendingPeaceOffer
    ? gameReducer(state, { type: state.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE })
    : state;
  const next = resolveTurn(answered);
  return next.activeProceduralEvent ? { ...next, activeProceduralEvent: null } : next;
};

// A legacy world where Pakistan is an independent beside the player's India (a small fixture for the rules).
const legacy = () => {
  const s = createInitialState({ playerNationId: 'in', rngSeed: 7 });
  return finalizeIndependents({ ...s, nations: { ...s.nations, pk: { ...s.nations.pk, kind: INDEPENDENT_KIND } } });
};
const P = getNationCapital('in');
const PK = getNationCapital('pk');
const unit = (id, owner, regionId, tile) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });

describe('independents data', () => {
  it('caps size by age, sets a garrison target and names by personality and age', () => {
    expect(independentSizeCap('bronze')).toBe(4);
    expect(independentSizeCap('modern')).toBe(8);
    expect(garrisonTarget(4, 'tribal')).toBe(3);
    expect(garrisonTarget(4, 'fortress')).toBe(4);
    expect(independentTitle({ adjective: 'Colchian', cityName: 'Phasis', personality: 'tribal', ageId: 'bronze' })).toBe('The Colchian tribes');
    expect(independentTitle({ adjective: 'Dilmunite', cityName: "Qal'at al-Bahrain", personality: 'mercantile', ageId: 'gunpowder' })).toBe("The merchant republic of Qal'at al-Bahrain");
    expect(independentTitle({ cityName: 'Ur', ageId: 'modern', freeCity: true })).toBe('The free state of Ur');
    expect(INDEPENDENT_ART.shieldIcon('raiders')).toBe('src/assets/icons/independents/raiders.svg');
  });

  it('gives the pool a mix of personalities near the plan ', () => {
    const tiles = getTiles();
    const counts = Object.fromEntries(PERSONALITY_IDS.map((p) => [p, 0]));
    PEOPLES_LIST.forEach((p) => { counts[personalityFor(tiles, p.tile, p.id)] += 1; });
    // Within 6 points of PERSONALITY_MIX_TARGET for each kind.
    PERSONALITY_IDS.forEach((p) => expect(Math.abs(counts[p] / PEOPLES_LIST.length - PERSONALITY_MIX_TARGET[p])).toBeLessThanOrEqual(0.06));
  });
});

describe('who is an independent in a peoples world', () => {
  it('Standard and Large keep every other people; Small keeps its count; late peoples arrive later', () => {
    const majors = ['akkad', 'israel', 'kemet'];
    const std = pickIndependents(majors, 'standard', 4);
    const late = PEOPLES_LIST.filter((p) => p.arrives != null).map((p) => p.id);
    expect(std.late.sort()).toEqual(late.sort());
    expect(std.ids).toHaveLength(PEOPLES_LIST.length - majors.length - late.length);
    expect(std.ids.some((id) => majors.includes(id))).toBe(false);
    const small = pickIndependents(majors, 'small', 4);
    expect(small.ids).toHaveLength(WORLD_SIZES.small.independents);
    expect(pickIndependents(majors, 'small', 4)).toEqual(small);
  });

  const state = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  const indeps = independentIdsOf(state);
  const majors = Object.keys(state.nations).filter((id) => !isIndependentNation(state.nations[id]));

  it('a new Standard world: 36 majors, the rest independents with one equal city and a garrison', () => {
    expect(majors).toHaveLength(WORLD_SIZES.standard.majors);
    expect(majors).toContain('akkad');
    expect(indeps.length).toBe(PEOPLES_LIST.filter((p) => p.arrives == null).length - majors.length);
    indeps.forEach((id) => {
      const n = state.nations[id];
      const city = state.regions[n.capitalRegionId];
      expect(city.owner).toBe(id);
      expect(city.size).toBe(EQUAL_START_SIZE);
      expect(city.tile).toBe(PEOPLES[id].tile);
      expect(n.economy).toBeUndefined();
      expect(n.ruler).toBeNull();
      expect(PERSONALITY_IDS).toContain(n.indep.personality);
      expect(n.name).not.toMatch(/Kingdom/);
      expect(Object.values(state.units).filter((u) => u.ownerId === id)).toHaveLength(1);
    });
    expect(Object.keys(state.scenario.lateArrivals).length).toBe(PEOPLES_LIST.filter((p) => p.arrives != null).length);
    assertGameState(state);
  });

  it('every major is Tier 1; independents have no tier and are not ranked', () => {
    const sorted = getSortedByMilitary(state);
    majors.filter((id) => id !== 'akkad').forEach((id) => expect(getNationTier(state, id, sorted)).toBe(1));
    indeps.forEach((id) => { expect(getNationTier(state, id, sorted)).toBeNull(); expect(sorted).not.toContain(id); });
  });

  it('plays: independents never settle, never declare wars, stay one city within their size cap', () => {
    let s = quiet(state);
    for (let i = 0; i < 25; i++) s = advance(s);
    expect(s.gameStatus).toBe('ACTIVE');
    const live = independentIdsOf(s);
    expect(live.length).toBeGreaterThan(indeps.length - 5);
    live.forEach((id) => {
      const cities = Object.values(s.regions).filter((c) => c.owner === id);
      expect(cities.length).toBe(1);
      expect(cities[0].size).toBeLessThanOrEqual(independentSizeCap(s.age));
      expect(Object.values(s.units).some((u) => u.ownerId === id && u.classId === 'settler')).toBe(false);
    });
    expect((s.wars || []).some((w) => live.includes(w.aggressor) || live.includes(w.enemy))).toBe(false);
    // The majors still settle.
    expect(Object.values(s.regions).filter((c) => c.owner && !isIndependentNation(s.nations[c.owner])).length).toBeGreaterThan(majors.length);
    assertGameState(s);
  }, 120000);

  it('a late people arrives in its year as an independent when its land is free', () => {
    const lateId = Object.keys(state.scenario.lateArrivals).sort((a, b) => state.scenario.lateArrivals[a] - state.scenario.lateArrivals[b])[0];
    const s = processLateArrivals({ ...state, year: state.scenario.lateArrivals[lateId] });
    const n = s.nations[lateId];
    expect(n?.kind).toBe(INDEPENDENT_KIND);
    expect(s.regions[n.capitalRegionId].owner).toBe(lateId);
    expect(s.scenario.lateArrivals[lateId]).toBeUndefined();
    expect(processLateArrivals(s).nations).toBe(s.nations);
  });

  it('can be switched off (majors only, as W0 built it)', () => {
    const off = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11, independents: false } });
    expect(Object.keys(off.nations)).toHaveLength(WORLD_SIZES.standard.majors);
  });
});

describe('canFight: attacking an independent needs no war', () => {
  const s = legacy();

  it('anyone may fight an independent; a passive independent attacks no one', () => {
    expect(canFight(s, 'in', 'pk')).toBe(true);
    expect(canFight(s, 'pk', 'in')).toBe(true);
    expect(canAttack(s, 'in', 'pk')).toBe(true);
    expect(canAttack(s, 'pk', 'in')).toBe(false);
    expect(canFight(s, 'in', 'cn')).toBe(false);
    expect(canFight(s, 'in', 'in')).toBe(false);
    const truce = { ...s, nations: { ...s.nations, pk: { ...s.nations.pk, indep: { ...s.nations.pk.indep, truceWith: { in: 999 } } } } };
    expect(canFight(truce, 'in', 'pk')).toBe(false);
    expect(regionAccess(s, PK, 'in')).toBe('enemy');
  });

  it('no war can be declared on or by an independent, and diplomacy with one is refused', () => {
    expect(declareWar(s, 'pk', { aggressor: 'in' })).toBe(s);
    expect(declareWar(s, 'in', { aggressor: 'pk' })).toBe(s);
    const r = gameReducer(s, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'pk' } });
    expect(r.nations).toBe(s.nations);
  });

  it('an army beside the city may attack it without a war; taking it costs half the AE', () => {
    const gate = getTiles().neighbors[s.regions[PK].tile].find((n) => getTiles().land[n] === 1);
    const st = { ...s, units: { ...s.units, a: unit('a', 'in', P, gate) } };
    const v = validateInvasion(st, P, PK, { ignoreCost: true });
    expect(v.ok).toBe(true);
    expect(v.war).toBeNull();
    const asMajor = { ...st, nations: { ...st.nations, pk: { ...st.nations.pk, kind: undefined } } };
    expect(validateInvasion(asMajor, P, PK, { ignoreCost: true }).reason).toBe('no_war');
    const taken = conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: 2 }, PK, 'in', null);
    const full = conquerRegion({ regions: asMajor.regions, nations: asMajor.nations, turnNumber: 2 }, PK, 'in', null);
    const aeOf = (r) => Object.values(r.nations).reduce((sum, n) => sum + (n.ae?.in || 0), 0);
    expect(aeOf(taken)).toBeLessThan(aeOf(full));
    expect(taken.regions[PK].owner).toBe('in');
  });

  it('the player besieges an independent; an independent besieges nobody', () => {
    const tiles = getTiles();
    const gate = tiles.neighbors[s.regions[PK].tile].find((n) => tiles.land[n] === 1);
    const mine = { ...s, units: { ...s.units, a: unit('a', 'in', P, gate) } };
    expect([...besiegersOf(mine, mine.regions[PK]).keys()]).toEqual(['in']);
    const gateP = tiles.neighbors[s.regions[P].tile].find((n) => tiles.land[n] === 1);
    const theirs = { ...s, units: { ...s.units, b: unit('b', 'pk', PK, gateP) } };
    expect(besiegersOf(theirs, theirs.regions[P]).size).toBe(0);
  });

  it('an independent city trains its garrison and never settlers or wonders', () => {
    const ctx = { ...independentCityCtx(s, 'pk', 'bronze'), ageId: 'bronze', turnNumber: 3, citiesOwned: 1, units: {}, counts: { settlers: 0, outposts: 0, landUnits: 0 } };
    const city = { ...s.regions[PK], size: 4, production: { current: null, queue: [], progress: 0 } };
    expect(chooseProduction(s, city, ctx)).toEqual({ kind: 'unit', classId: 'infantry' });
    const full = chooseProduction(s, city, { ...ctx, counts: { settlers: 0, outposts: 0, landUnits: 9 } });
    expect(full?.kind).not.toBe('settler');
    expect(full?.kind).not.toBe('wonder');
  });

  it('a breakaway city becomes a new independent where independents exist', () => {
    const nations = { ...s.nations };
    const id = breakAwayAsIndependent(s, nations, s.regions, P, 5);
    expect(id).toBe(`free_${P}`);
    expect(nations[id].kind).toBe(INDEPENDENT_KIND);
    expect(nations[id].indep.freeCity).toBe(true);
    const noIndeps = createInitialState({ playerNationId: 'in', rngSeed: 7 });
    expect(breakAwayAsIndependent(noIndeps, { ...noIndeps.nations }, noIndeps.regions, P, 5)).toBeNull();
  });

  it('fog hook: independents are met only by sight; no fog means everyone is known', () => {
    expect(metOnlyBySight(s, 'pk')).toBe(true);
    expect(metOnlyBySight(s, 'cn')).toBe(false);
    expect(hasMet(s, 'in', 'pk')).toBe(true);
    expect(hasMet({ ...s, fog: { on: true, met: { in: {} } } }, 'in', 'pk')).toBe(false);
    expect(hasMet({ ...s, fog: { on: true, met: { in: { pk: 3 } } } }, 'in', 'pk')).toBe(true);
  });
});
