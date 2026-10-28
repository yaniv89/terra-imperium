// .claude/skills/balance-sim/raids.sim.js
// Raids and sacks by independents over a long game (lane raids-march): TURNS turns of a peoples
// world with the scripted player (every blocker answered, raids on the player fought on Auto). Every
// raid start is recorded from state alone (indep.raid appearing), so it runs on a base commit too:
// its kind, the victim's age, the party against the target's defence (army on the city tile, the
// militia, the walls), and whether the city was sacked before the raid ended. One RAIDS line per seed:
//   per age: starts (raids a turn per 100 majors' cities), sacks tried, sacks that took the city,
//   median party / defence of a sack, sacks against a defended city (garrison or walls) and how many fell.
//   TURNS=300 SEEDS=11,12 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/raids.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import { cityMilitia } from '../../../src/engine/battleInputs';
import { isIndependentNation } from '../../../src/data/independents';
import * as AGES from '../../../src/data/ages';
import { opinionOf } from '../../../src/engine/opinion';

const TURNS = Number(process.env.TURNS || 300);
const SEEDS = (process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const sum = (us) => us.reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
const median = (a) => { if (!a.length) return null; const v = [...a].sort((x, y) => x - y); return Math.round(v[Math.floor(v.length / 2)] * 10) / 10; };

SEEDS.forEach((seed) => {
  it(`raids seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { autoDefend: true }, proceduralEventCooldown: 999999 };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse', opinionOf });
    const open = new Map(); // indepId -> the raid record
    const done = [];
    const turnsByAge = {}; const citiesByAge = {};
    const close = (rec, st) => {
      const c = rec.cityId != null ? st.regions[rec.cityId] : null;
      rec.fell = rec.kind === 'sack' && !!c && (c.sackedTurn ?? -1) >= rec.turn;
      done.push(rec);
    };
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.activeEventId || s.activeProceduralEvent) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
      s = scripted.answer(s).state;
      s = resolveTurn(s);
      // Majors' cities by the owner's age (the exposure a raid rate is read against).
      Object.values(s.regions).forEach((c) => {
        const o = s.nations[c.owner];
        if (!o || isIndependentNation(o) || c.outpost) return;
        const age = getTechAgeId(s, c.owner);
        citiesByAge[age] = (citiesByAge[age] || 0) + 1;
      });
      turnsByAge[getTechAgeId(s, s.playerNationId)] = (turnsByAge[getTechAgeId(s, s.playerNationId)] || 0) + 1;
      Object.entries(s.nations).forEach(([id, n]) => {
        const raid = n?.indep?.raid;
        const rec = open.get(id);
        if (rec && (!raid || raid.startedTurn !== rec.turn)) { close(rec, s); open.delete(id); }
        if (!raid || open.has(id) || raid.startedTurn !== s.turnNumber) return;
        const c = raid.targetCityId != null ? s.regions[raid.targetCityId] : null;
        const victim = raid.targetNationId;
        const garrison = c ? sum(Object.values(s.units).filter((u) => u.ownerId === victim && u.tile === c.tile && u.domain !== 'naval' && !u.embarkedOn)) : 0;
        const militia = c && raid.kind === 'sack' ? sum(cityMilitia(s, c.id)) : 0;
        const walls = c?.defenseLevel || 0;
        // Held: the defence as the sack battle fights it (siege.js walls: 5% a level, at most 50%).
        const held = (garrison + militia) / (1 - Math.min(0.5, walls * 0.05));
        open.set(id, { id, turn: s.turnNumber, kind: raid.kind, cityId: raid.targetCityId, player: victim === s.playerNationId, age: getTechAgeId(s, victim), party: raid.startStrength, garrison, militia, walls, held });
      });
    }
    open.forEach((rec) => close(rec, s));
    const ages = AGES.AGE_ORDER.filter((a) => turnsByAge[a] || done.some((r) => r.age === a));
    const perAge = {};
    ages.forEach((a) => {
      const rs = done.filter((r) => r.age === a);
      const sacks = rs.filter((r) => r.kind === 'sack');
      const defended = sacks.filter((r) => r.garrison > 0 || r.walls > 0);
      perAge[a] = {
        cityTurns: citiesByAge[a] || 0,
        starts: rs.length,
        per100CityTurns: citiesByAge[a] ? Math.round(rs.length / citiesByAge[a] * 10000) / 100 : null,
        sacks: sacks.length, fell: sacks.filter((r) => r.fell).length,
        partyToDefence: median(sacks.map((r) => r.party / Math.max(1, r.garrison + r.militia))),
        defended: defended.length, defendedFell: defended.filter((r) => r.fell).length,
        atPlayer: rs.filter((r) => r.player).length, playerSacked: sacks.filter((r) => r.player && r.fell).length,
        // A city that held at least half the party when it set out (the deterrence line).
        wellDefended: sacks.filter((r) => r.held >= r.party / 2).length, wellDefendedFell: sacks.filter((r) => r.held >= r.party / 2 && r.fell).length
      };
    });
    const sacks = done.filter((r) => r.kind === 'sack');
    const defended = sacks.filter((r) => r.garrison > 0 || r.walls > 0);
    const well = sacks.filter((r) => r.held >= r.party / 2);
    console.log(`RAIDS seed=${seed} wellDefended=${well.length} wellDefendedFell=${well.filter((r) => r.fell).length} deterred=${s.indepStats?.raidsDeterred || 0} turn=${s.turnNumber} status=${s.gameStatus} starts=${done.length} sacks=${sacks.length} fell=${sacks.filter((r) => r.fell).length} defended=${defended.length} defendedFell=${defended.filter((r) => r.fell).length} partyToDefence=${median(sacks.map((r) => r.party / Math.max(1, r.garrison + r.militia)))} atPlayer=${done.filter((r) => r.player).length} playerSacked=${sacks.filter((r) => r.player && r.fell).length} perAge=${JSON.stringify(perAge)}`);
  });
});
