// .claude/skills/balance-sim/diplomacy.sim.js
// A peaceful player's diplomacy (lane diplomacy-depth): a standard peoples world played by the
// scripted player, which pays AI demands and never declares war, plus a diplomat policy every
// EVERY_ACT turns: for each met major it offers open borders and a border stele when they would
// accept, a trade agreement while slots last, and a gift when their opinion is short of open
// borders. Prints one DIPLO line per seed: what was signed, what was refused, gifts and their
// effect, demands paid, wars on the player, the met majors' opinion, and how many met majors'
// lands are closed to the player's armies (no way to walk up to them).
//   SEEDS=11,12 TURNS=80 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/diplomacy.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { opinionOf } from '../../../src/engine/opinion';
import { metNations } from '../../../src/engine/fog';
import { openBordersAcceptance, hasOpenBorders, steleAcceptance, hasStele } from '../../../src/engine/accords';
import { regionAccess } from '../../../src/engine/armies';
import * as ROUTES from '../../../src/engine/routes';

const SPEED = process.env.SPEED || 'normal';
const TURNS = Number(process.env.TURNS || 80);
const SEEDS = (process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const EVERY_ACT = Number(process.env.EVERY_ACT || 5);

const majorsMet = (s) => metNations(s).filter((id) => s.nations[id] && s.nations[id].kind !== 'independent' && !s.nations[id].isEliminated);
// Of the met majors whose land is closed: how many a peaceful march can still walk up to (routes.js
// approachTile, from the player's capital to their nearest city; 'n/a' on a commit without it).
const approachable = (s, ids) => {
  if (!ROUTES.approachTile) return 'n/a';
  const from = s.regions[s.nations[PLAYER].capitalRegionId]?.tile;
  return ids.filter((id) => { const c = Object.values(s.regions).filter((r) => r.owner === id).sort((a, b) => Math.abs(a.tile - from) - Math.abs(b.tile - from))[0]; return c && ROUTES.approachTile(s, from, c.id) != null; }).length;
};
const closedTo = (s, id) => Object.values(s.regions).filter((c) => c.owner === id).every((c) => regionAccess(s, c.id) === 'closed');

SEEDS.forEach((seed) => {
  it(`diplomacy seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, gameSpeed: SPEED, scenario: { mode: 'peoples', size: 'standard', seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { autoDefend: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'pay', opinionOf });
    const c = { borders: 0, bordersRefused: 0, steles: 0, steleRefused: 0, trade: 0, gifts: 0, giftGain: 0, alliance: 0, allianceSilent: 0 };
    const act = (st, type, nationId) => gameReducer(st, { type, payload: { nationId } });
    const warsOnMe = new Set();
    let firstOpen = null; let closedSeen = 0; let approachSeen = 0;
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.activeEventId || s.activeProceduralEvent) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      s = scripted.answer(s).state;
      if (t % EVERY_ACT === 0) {
        majorsMet(s).forEach((id) => {
          const gold = () => s.resources.gold || 0;
          if (!hasOpenBorders(s, PLAYER, id) && gold() > 150) {
            const ok = openBordersAcceptance(s, id).accepted;
            if (ok) { s = act(s, ActionTypes.OPEN_BORDERS, id); if (hasOpenBorders(s, PLAYER, id)) c.borders += 1; }
            else if (gold() > 400) { const o0 = opinionOf(s, id); s = act(s, ActionTypes.GIFT_BRIBE, id); c.gifts += 1; c.giftGain += opinionOf(s, id) - o0; }
            else c.bordersRefused += 1;
          }
          if (!hasStele(s, PLAYER, id) && gold() > 150) {
            if (steleAcceptance(s, id).accepted) { const before = s; s = act(s, ActionTypes.PROPOSE_STELE, id); if (hasStele(s, PLAYER, id)) c.steles += 1; else if (s === before) c.steleRefused += 0; }
            else c.steleRefused += 1;
          }
          if (!s.nations[id].hasTradeAgreement && gold() > 250) { s = act(s, ActionTypes.TRADE_AGREEMENT, id); if (s.nations[id].hasTradeAgreement) c.trade += 1; }
          if (!s.nations[id].hasMilitaryPact && gold() > 600 && opinionOf(s, id) >= 20) {
            const before = s; s = act(s, ActionTypes.MILITARY_ALLIANCE, id);
            if (s.nations[id].hasMilitaryPact) c.alliance += 1; else if (s.logs.length === before.logs.length) c.allianceSilent += 1;
          }
        });
      }
      if (firstOpen == null && majorsMet(s).some((id) => hasOpenBorders(s, PLAYER, id))) firstOpen = t;
      if (t === 20) { const shut = majorsMet(s).filter((id) => closedTo(s, id)); closedSeen = shut.length; approachSeen = approachable(s, shut); }
      s = resolveTurn(s);
      (s.wars || []).forEach((w) => { if (w.enemy === PLAYER || w.aggressor === PLAYER) warsOnMe.add(w.id); });
    }
    const met = majorsMet(s);
    const ops = met.map((id) => opinionOf(s, id));
    const avg = ops.length ? Math.round(ops.reduce((a, b) => a + b, 0) / ops.length) : null;
    const demands = scripted.log.demands;
    console.log(`DIPLO seed=${seed} turn=${s.turnNumber} status=${s.gameStatus} met=${met.length} opinionAvg=${avg} opinionMin=${Math.min(...ops)} opinionMax=${Math.max(...ops)} wouldOpen=${met.filter((id) => openBordersAcceptance(s, id).accepted).length} openNow=${met.filter((id) => hasOpenBorders(s, PLAYER, id)).length} closedLands=${met.filter((id) => closedTo(s, id)).length} firstOpen=${firstOpen} closedT20=${closedSeen} approachT20=${approachSeen} ${Object.entries(c).map(([k, v]) => `${k}=${Math.round(v)}`).join(' ')} demandsPaid=${demands.filter((d) => d.outcome === 'paid').length} demandGold=${demands.reduce((a, d) => a + Math.max(0, d.paid || 0), 0)} warsWithPlayer=${warsOnMe.size} gold=${Math.round(s.resources.gold)}`);
  });
});
