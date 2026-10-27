// .claude/skills/balance-sim/playerWar.sim.js
// "Player at war" trace (lane campaign-ai-wars): a scripted player (answers every blocker, builds
// like an AI, never moves an army) plays a standard peoples world; at turn DECLARE_AT a war starts
// between the player and the nearest living major (by capital distance). WHO=player: the player
// declares; WHO=ai: the major declares on the player. The trace records, per seed:
//   contactTurns   turns from the declaration until an enemy land unit first stands on the player's
//                  land (a tile owned by a player city) or beside a player city (-1 = never)
//   firstBattle    turns until the first battle against the player (a queued defense, -1 = never)
//   battles        battles against the player during the war (queued defenses the player answered)
//   citiesLost     player cities the enemy took during the war
//   warTurns       how long the war lasted (-1 = still on at the end)
//   rings          capital to capital distance in rings; met: whether they had met before
//   enemyUnits     the enemy's land units at the declaration and at its peak
//   planCity / planStaging  the enemy's war plan target and muster city on the first war turn
//   closestRings   how close (rings) any enemy land unit came to a player city
//   reports        battles the player fought in the war (battle reports); starvedUnitTurns: enemy
//                  land units at 0 supply, summed over the war's turns
//   PEACE=refuse   the player turns down every peace offer (a warmonger); DBG=1 prints the queue
//   TURNS=60 DECLARE_AT=40 SEEDS=11,12,13,14 WHO=player PLAYER=akkad \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/playerWar.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { getTiles } from '../../../src/data/geo/tiles';
import { ringsApart } from '../../../src/data/geo/gridScale';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { metNations } from '../../../src/engine/fog';
import { opinionOf } from '../../../src/engine/opinion';
import { isIndependentNation } from '../../../src/data/independents';
import { declareWar } from '../../../src/engine/diplomacy';
import { getCapital } from '../../../src/data/regions';

const TURNS = Number(process.env.TURNS || 60);
const DECLARE_AT = Number(process.env.DECLARE_AT);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const WHO = process.env.WHO || 'player';
const SPEED = process.env.SPEED || null;
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});

const capTile = (s, id) => s.regions[getCapital(s, id)]?.tile;
const nearestMajor = (s) => {
  const me = s.playerNationId; const t0 = capTile(s, me);
  let best = null;
  for (const n of Object.values(s.nations)) {
    if (n.id === me || n.isEliminated || isIndependentNation(n)) continue;
    const t = capTile(s, n.id); if (t == null) continue;
    const d = ringsApart(t0, t);
    if (!best || d < best.d) best = { id: n.id, d };
  }
  return best;
};

// Runs only when DECLARE_AT is set, so compare.sh (which runs every sim in this folder) skips it.
SEEDS.forEach((seed) => {
  it.skipIf(!process.env.DECLARE_AT)(`player war seed ${seed}`, () => {
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed }, ...(SPEED ? { gameSpeed: SPEED } : {}) }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse', opinionOf });
    const tiles = getTiles();
    const me = s.playerNationId;
    let war = null; const out = { seed, who: WHO, declareAt: DECLARE_AT, contactTurns: -1, firstBattle: -1, battles: 0, citiesLost: 0, warTurns: -1, closestRings: null };
    let ms = 0;
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (t === DECLARE_AT) {
        const foe = nearestMajor(s);
        out.enemy = foe.id; out.rings = +foe.d.toFixed(1); out.met = metNations(s).includes(foe.id);
        const open = s.wars.find((w) => w.active && [w.aggressor, w.enemy].includes(me) && [w.aggressor, w.enemy].includes(foe.id));
        out.preWar = !!open;
        if (!open) s = WHO === 'ai' ? declareWar(s, me, { aggressor: foe.id }) : declareWar(s, foe.id, { aggressor: me });
        war = open || s.wars[s.wars.length - 1];
        out.enemyUnits0 = Object.values(s.units).filter((u) => u.ownerId === foe.id && u.domain === 'land' && u.classId !== 'settler').length;
        out.enemyUnitsPeak = out.enemyUnits0;
        out.seq0 = s.battleReportSeq || 0;
        out.myCities0 = Object.values(s.regions).filter((c) => c.owner === me).length;
      }
      const d0 = scripted.log.defenses;
      // PEACE=refuse: a warmonger turns down every peace the enemy offers (the war goes on).
      if (process.env.PEACE === 'refuse' && war && s.pendingPeaceOffer?.warId === war.id) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE });
      s = scripted.answer(s).state;
      if (war && scripted.log.defenses > d0) { out.battles += scripted.log.defenses - d0; if (out.firstBattle < 0) out.firstBattle = t - DECLARE_AT; }
      const pre = s;
      const a = performance.now();
      s = resolveTurn(s);
      ms += performance.now() - a;
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      if (s.activeEventId) s = { ...s, activeEventId: null };
      if (!war) continue;
      const w = s.wars.find((x) => x.id === war.id);
      if (out.warTurns < 0) {
        for (const c of Object.values(s.regions)) if (c.owner === out.enemy && pre.regions[c.id]?.owner === me) out.citiesLost += 1;
        out.reports = (s.battleReportSeq || 0) - out.seq0;
      }
      if (out.warTurns < 0 && (!w || !w.active)) { out.warTurns = t - DECLARE_AT; out.warEnd = w?.endReason || w?.outcome || 'ended'; }
      if (out.warTurns >= 0) continue;
      if (t === DECLARE_AT) { const p = s.nations[out.enemy]?.warPlan; out.planCity = p?.cityId || null; out.planStaging = p?.staging || null; out.planStrike = p?.strike ?? null; }
      if ((s.pendingDefenses || []).length && out.firstBattle < 0) out.firstBattle = t - DECLARE_AT + 1;
      const myCities = Object.values(s.regions).filter((c) => c.owner === me && c.tile != null);
      const foeUnits = Object.values(s.units).filter((u) => u.ownerId === out.enemy && u.domain === 'land' && u.classId !== 'settler' && u.strength > 0);
      out.enemyUnitsPeak = Math.max(out.enemyUnitsPeak, foeUnits.length);
      out.starvedUnitTurns = (out.starvedUnitTurns || 0) + foeUnits.filter((u) => u.supply != null && u.supply <= 0).length;
      if (process.env.TRACE === '1') {
        const groups = {};
        foeUnits.forEach((u) => { let d = Infinity; for (const c of myCities) d = Math.min(d, ringsApart(u.tile, c.tile, tiles)); const k = `${u.tile}@${d.toFixed(1)}${u.route?.length ? `>${u.route.length}` : ''}${u.routeHalt ? `!${u.routeHalt}` : ''}${process.env.SUPPLY ? `s${Math.round(u.supply ?? 100)}m${Math.round(u.morale ?? 100)}h${Math.round(u.strength)}` : ''}`; groups[k] = (groups[k] || 0) + 1; });
        const p = s.nations[out.enemy]?.warPlan;
        const sieges = myCities.filter((c) => c.siege).map((c) => `${c.id}:${Math.round(c.siege.hp)}`);
        if (process.env.DBG) console.log('PD', JSON.stringify((s.pendingDefenses || []).map((d) => ({ id: d.id, kind: d.kind, region: d.regionId, agg: d.aggressorId, att: d.attackerUnitIds?.length, def: d.defenderUnitIds?.length }))), 'owner', s.regions.c81237?.owner, 'units in cap', Object.values(s.units).filter((u) => u.regionId === 'c81237').map((u) => `${u.ownerId}:${u.tile}:${u.strength}`).join(' '));
        console.log(`T+${t - DECLARE_AT + 1} score=${w?.warScore ?? w?.score ?? '?'} plan=${p ? `${p.cityId}/${p.staging}/s${p.strike}/w${p.waves}` : '-'} obj=${s.aiOperations?.[out.enemy]?.objective || '-'} units=${JSON.stringify(groups)} sieges=${sieges.join(',')} gar=${Object.values(s.units).filter((u) => u.ownerId === me && u.domain === 'land' && u.strength > 0).length}`);
      }
      for (const u of foeUnits) {
        if (u.tile == null || u.embarkedOn) continue;
        let d = Infinity; for (const c of myCities) { const r = ringsApart(u.tile, c.tile, tiles); if (r < d) d = r; }
        if (out.closestRings == null || d < out.closestRings) out.closestRings = +d.toFixed(1);
        const owner = s.regions[s.world?.tileOwner?.[u.tile]]?.owner;
        if (out.contactTurns < 0 && (owner === me || d <= 1.01)) out.contactTurns = t - DECLARE_AT + 1;
      }
    }
    out.msPerTurn = +(ms / TURNS).toFixed(1);
    console.log(`PWAR ${JSON.stringify(out)}`);
  });
});
