// .claude/skills/balance-sim/mapsResources.sim.js
// Lane pa-w5-maps-resources (I098 resource density, I116 map trading): a peoples world with the
// scripted player, printing city yields and growth, contacts and map offers every EVERY turns.
// The player accepts every AI offer to swap maps (ANSWER_MAP_OFFER), so the offers' effect shows.
//   TURNS=150 SEEDS=11,12,13 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/mapsResources.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { opinionOf } from '../../../src/engine/opinion';
import { getTiles } from '../../../src/data/geo/tiles';

const TURNS = Number(process.env.TURNS || 150);
const EVERY = Number(process.env.EVERY || 50);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r2 = (v) => Math.round(v * 100) / 100;

const snap = (s, t, counters) => {
  const majors = Object.values(s.nations).filter((n) => !n.isEliminated && n.kind !== 'independent');
  const majorIds = new Set(majors.map((n) => n.id));
  const cities = Object.values(s.regions).filter((c) => c.owner && majorIds.has(c.owner) && c.tile != null && !c.outpost);
  const y = (k) => cities.map((c) => c.lastYields?.[k] || 0);
  const tiles = getTiles();
  // Worked resource tiles (land or sea) of major cities: how often a city works a resource.
  const met = majors.map((n) => Object.keys(s.fog?.met?.[n.id] || {}).filter((id) => majorIds.has(id)).length);
  const me = s.playerNationId;
  return {
    turn: t, status: s.gameStatus, majors: majors.length, cities: cities.length,
    citiesPerMajor: r2(cities.length / Math.max(1, majors.length)),
    meanSize: r2(mean(cities.map((c) => c.size || 1))), totalSize: cities.reduce((a, c) => a + (c.size || 1), 0),
    meanFood: r2(mean(y('food'))), meanProd: r2(mean(y('production'))), meanGold: r2(mean(y('gold'))),
    meanLux: r2(mean(cities.map((c) => (c.lastYields?.luxuries || []).length))),
    strategicCityShare: r2(cities.filter((c) => Object.keys(c.lastYields?.strategic || {}).length).length / Math.max(1, cities.length)),
    resourceTilesOwned: r2(mean(cities.map((c) => (c.tiles || []).filter((x) => tiles.resourceOf(x)).length))),
    majorsMetMean: r2(mean(met)), playerMet: Object.keys(s.fog?.met?.[me] || {}).filter((id) => majorIds.has(id)).length,
    playerCities: cities.filter((c) => c.owner === me).length, playerSize: cities.filter((c) => c.owner === me).reduce((a, c) => a + (c.size || 1), 0),
    mapOffers: s.mapTradeStats?.offers || 0, mapAccepted: s.mapTradeStats?.accepted || 0, offersSeen: counters.offers
  };
};

SEEDS.forEach((seed) => {
  it(`maps and resources seed ${seed}`, () => {
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse', opinionOf });
    const counters = { offers: 0 };
    const t0 = performance.now();
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      s = scripted.answer(s).state;
      if (s.pendingMapOffer && ActionTypes.ANSWER_MAP_OFFER) { counters.offers += 1; s = gameReducer(s, { type: ActionTypes.ANSWER_MAP_OFFER, payload: { accept: true } }); }
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      if (t % EVERY === 0 || t === TURNS || s.gameStatus !== GameStatus.ACTIVE) {
        const row = snap(s, t, counters);
        console.log(`MR seed=${seed} ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(' ')} msPerTurn=${Math.round((performance.now() - t0) / t)}`);
      }
    }
  });
});
