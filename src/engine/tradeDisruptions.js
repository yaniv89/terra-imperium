// src/engine/tradeDisruptions.js
// A cut trade route is an event, not a state of the world (playtest audits CB08: I113, I114, I115;
// loophole A21). Before, "Rebels plunder your land trade route" repeated every turn for as long as
// a stack stood on the only road (87 turns in playtest 3), paid the plunderer every turn and gave
// the player nothing to do. Now a cut has a cause, a place, a length and three ways to end:
//
//   cut      plunder.js finds a route cut this turn (an enemy stack on the only caravan road, or
//            a raider fleet off a port). The event starts: one log line saying who, where and why,
//            and what to do. The plunderer takes its gold ONCE, at the start (never rebels, who
//            have no treasury; an independent's raid party took its loot in raids.js). While it is
//            cut the agreement pays nothing (tradeValue.js) and no further line is written.
//   it ends  when the blocker is gone: killed or driven off by an army (the player's, the
//            partner's, the land's owner), or the caravans found another open road (tradeRoutes.js
//            already goes round a stack when it can). One line says so, with the turns lost.
//   guarded  or after plunderCutTurns at the latest: the caravans hire guards and slip past. The
//            route is open again and cannot be cut for plunderGuardTurns, nor by that same stack
//            for as long as it stands there (a stack that never moves cuts the road once).
//
// So one blocker costs at most plunderCutTurns of trade, and a road that is cut again and again
// is closed at most plunderCutTurns out of every plunderCutTurns + plunderGuardTurns. Waits are
// reference turns through the speed helper (ages.js speedTurns).
//
// State: `state.tradeDisruptions[partnerId] = { phase: 'cut' | 'guarded', kind: 'land' | 'sea', by,
// tile, since, until, lost, guardedUntil }` (absent = the route is undisturbed). Player routes only
// (the AI has no trade pacts). Pure; resolveTurn applies `advanceTradeDisruptions` once a turn.
import { getTiles } from '../data/geo/tiles';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { isIndependentNation } from '../data/independents';
import { speedTurns } from '../data/ages';
import { plunderedRoutes, plunderGoldFor, blockerStands } from './plunder';
import { getTradeRoute } from './tradeRoutes';
import { tradeRoutesValue } from './tradeValue';
import { msg, msgText, sub, people, cityRef, place } from './messages';
import { waitAgeOf } from './ageRefs';

// PROVISIONAL numbers (the rule is fixed; the values wait for the tuning pass, conflicts trap T1).
export const PLUNDER_CUT_REF_TURNS = 3;    // a cut lasts at most this long: 5 turns at Normal
export const PLUNDER_GUARD_REF_TURNS = 12; // then the route cannot be cut for this long: 19 to 20 turns at Normal
// A route is a pair's: the player and its partner, at the older age of the two (KTD7).
export const plunderCutTurns = (state, partnerId) => speedTurns(PLUNDER_CUT_REF_TURNS, state?.gameSpeed, waitAgeOf(state, state?.playerNationId, partnerId));
export const plunderGuardTurns = (state, partnerId) => speedTurns(PLUNDER_GUARD_REF_TURNS, state?.gameSpeed, waitAgeOf(state, state?.playerNationId, partnerId));

// Who holds the road, as a message var: "Rebels", the nation, else "Raiders"; `the` gives "the rebels" mid-sentence.
const whoRef = (state, id, the = false) => {
  if (id === REBEL_OWNER_ID) return sub(the ? 'm.diplo.theRebels' : 'm.diplo.rebels');
  const name = state.nations?.[id]?.name;
  if (!name) return sub('m.diplo.raiders');
  return the && name.toLowerCase() === 'rebels' ? sub('m.diplo.theRebels') : people(id, name);
};
const turnsSub = (n) => sub('m.diplo.turns', { count: n });
const kindSub = (kind) => ({ land: sub('m.diplo.kindLand'), sea: sub('m.diplo.kindSea'), direct: sub('m.diplo.kindDirect') }[kind] ?? kind);
const textOf = (m) => msgText(m.key, m.vars);

/** Where a tile is, in words the player can find on the map: "Sinai, in the land of Avaris (Kemet)". */
export const placeMsg = (state, tile) => {
  const name = getTiles().names?.[tile] || null;
  const city = state.regions?.[state.world?.tileOwner?.[tile]];
  const ownerName = city?.owner && city.owner !== state.playerNationId ? state.nations?.[city.owner]?.name : null;
  const owner = city?.owner ? (city.owner === state.playerNationId ? sub('m.diplo.yourLand') : (ownerName ? people(city.owner, ownerName) : null)) : null;
  const land = city ? sub(owner ? 'm.diplo.landOfOwned' : 'm.diplo.landOf', { city: cityRef(city.id, city.name), ...(owner ? { owner } : {}) }) : sub('m.diplo.landUnclaimed');
  return name && name !== city?.name ? sub('m.diplo.placeIn', { name: place(name), land }) : land;
};
export const placeText = (state, tile) => textOf(placeMsg(state, tile));

/** Why a blocker cuts the road: rebels, an enemy at war, or an independent's raid party. */
export const causeMsg = (state, by) => {
  if (by === REBEL_OWNER_ID) return sub('m.diplo.causeRebels');
  if (isIndependentNation(state.nations?.[by])) return sub('m.diplo.causeRaidParty', { nation: whoRef(state, by) });
  return sub('m.diplo.causeArmy', { nation: whoRef(state, by) });
};
export const causeText = (state, by) => textOf(causeMsg(state, by));

/**
 * One turn of the trade route events. `state` is the turn's view (regions, units, nations, wars,
 * world, tradeDisruptions); `turn` the turn being resolved. Returns { disruptions, logs, loot }:
 * the next records, the lines for the player ({ message }) and the gold plunderers take
 * ([{ by, gold }], only when an event starts). The same object comes back when nothing changed.
 */
export const advanceTradeDisruptions = (state, turn = state.turnNumber || 1) => {
  const prev = state.tradeDisruptions || {};
  const me = state.playerNationId;
  const hits = plunderedRoutes(state);
  const partners = new Set(Object.values(state.nations || {}).filter((n) => !n.isPlayer && n.hasTradeAgreement && !n.isEliminated).map((n) => n.id));
  if (!hits.length && !Object.keys(prev).length) return { disruptions: prev, logs: [], loot: [] };
  const next = {};
  const logs = [];
  const loot = [];
  let changed = false;
  const partnerRef = (id) => people(id, state.nations?.[id]?.name || id);
  [...new Set([...Object.keys(prev), ...hits.map((h) => h.partnerId)])].sort().forEach((pid) => {
    const p = prev[pid];
    const hit = hits.find((h) => h.partnerId === pid) || null;
    if (!partners.has(pid)) { if (p) changed = true; return; } // the agreement or the partner is gone
    if (p?.phase === 'guarded') {
      // Open under guard: over once the time is up and the stack that cut it is gone.
      if (turn >= p.guardedUntil && !blockerStands(state, me, p.by, p.tile)) { changed = true; return; }
      next[pid] = p;
      return;
    }
    if (hit && !p) {
      // A new cut: the one line, and the one payment.
      const until = turn + plunderCutTurns(state, pid);
      next[pid] = { phase: 'cut', kind: hit.kind, by: hit.by, tile: hit.tile, since: turn, until, lost: 1 };
      changed = true;
      const raider = state.nations?.[hit.by];
      if (raider && !isIndependentNation(raider)) loot.push({ by: hit.by, gold: plunderGoldFor(state, hit.by) });
      const where = sub(hit.kind === 'sea' ? 'm.diplo.offPlace' : 'm.diplo.atPlace', { place: placeMsg(state, hit.tile) });
      const why = hit.kind === 'sea' ? sub('m.diplo.causeShips', { nation: whoRef(state, hit.by) }) : causeMsg(state, hit.by);
      logs.push({ ...msg(hit.kind === 'sea' ? 'm.diplo.plunderSea' : 'm.diplo.plunderLand', { nation: whoRef(state, hit.by), partner: partnerRef(pid), where, why, turns: plunderCutTurns(state, pid) }) });
      return;
    }
    if (hit && p) {
      if (turn >= p.until) {
        // The caravans go under guard: open again whatever stands on the road.
        const guardedUntil = turn + plunderGuardTurns(state, pid);
        next[pid] = { ...p, phase: 'guarded', by: hit.by, tile: hit.tile, guardedUntil };
        changed = true;
        logs.push({ ...msg('m.diplo.guarded', { partner: partnerRef(pid), who: whoRef(state, hit.by, true), place: placeMsg(state, hit.tile), count: p.lost, turn: guardedUntil }) });
        return;
      }
      next[pid] = { ...p, by: hit.by, tile: hit.tile, lost: (p.lost || 0) + 1 };
      changed = true;
      return;
    }
    if (p && !hit) {
      // The blocker is gone, or another road opened.
      changed = true;
      const route = getTradeRoute(state, pid);
      const how = blockerStands(state, me, p.by, p.tile) ? sub('m.diplo.howOtherRoad') : sub('m.diplo.howGone', { who: whoRef(state, p.by, true), place: placeMsg(state, p.tile) });
      logs.push(route.ok
        ? msg('m.diplo.routeOpen', { partner: partnerRef(pid), how, count: p.lost })
        : msg('m.diplo.raidersGone', { partner: partnerRef(pid), reason: route.reasonMsg || route.reason }));
    }
  });
  if (!changed) return { disruptions: prev, logs, loot };
  return { disruptions: next, logs, loot };
};

/**
 * What a trade agreement is doing now, for every surface that shows it (the nation card, the city
 * sheet, the trade lens): { partnerId, phase: 'open' | 'cut' | 'guarded' | 'closed', pays, percent,
 * kind, km, text, cause, where, tile, by, turnsLeft, advice }. `pays` is false whenever the
 * agreement brings no gold this turn, and `text` then says so and why (I113, I114). Null when
 * there is no agreement with `partnerId`.
 */
export const tradeRouteStatus = (state, partnerId) => {
  const partner = state.nations?.[partnerId];
  if (!partner || !partner.hasTradeAgreement || partner.isEliminated) return null;
  const turn = state.turnNumber || 1;
  const d = state.tradeDisruptions?.[partnerId] || null;
  // A game without a scenario (old saves, tests) trades between capitals whatever the road (tradeValue.js).
  const found = getTradeRoute(state, partnerId);
  const route = found.ok || state.scenario ? found : { ok: true, kind: 'direct' };
  const value = tradeRoutesValue(state).find((r) => r.partnerId === partnerId) || null;
  const percent = value ? Math.round(value.mult * 1000) / 10 : 0;
  const base = { partnerId, kind: route.ok ? route.kind : d?.kind || null, km: value?.km ?? null, percent, tile: d?.tile ?? null, by: d?.by ?? null };
  if (d?.phase === 'cut') {
    const turnsLeft = Math.max(0, d.until - turn);
    const whereMsg = placeMsg(state, d.tile);
    const causeM = d.kind === 'sea' ? sub('m.diplo.causeShips', { nation: whoRef(state, d.by) }) : causeMsg(state, d.by);
    const adviceMsg = sub(d.kind === 'sea' ? 'm.diplo.adviceSea' : 'm.diplo.adviceLand');
    const textMsg = sub('m.diplo.statusCut', { where: whereMsg, cause: causeM, lost: turnsSub(d.lost), left: turnsSub(turnsLeft) });
    return {
      ...base, phase: 'cut', pays: false, percent: 0, cause: textOf(causeM), where: textOf(whereMsg), turnsLeft,
      advice: textOf(adviceMsg), text: textOf(textMsg),
      causeMsg: causeM, whereMsg, adviceMsg, textMsg
    };
  }
  // `text` stays the English sentence; `textMsg` (and `adviceMsg`, `causeMsg`) carry the key and vars for other languages.
  const said = (m) => ({ text: textOf(m), textMsg: m });
  if (!route.ok) return { ...base, phase: 'closed', pays: false, percent: 0, cause: route.reason, causeMsg: route.reasonMsg || null, where: null, turnsLeft: null, advice: textOf(sub('m.diplo.adviceClosed')), adviceMsg: sub('m.diplo.adviceClosed'), ...said(sub('m.diplo.statusClosed', { reason: route.reasonMsg || route.reason })) };
  const guard = d?.phase === 'guarded' ? sub('m.diplo.statusGuard', { turn: d.guardedUntil }) : '';
  if (!(percent > 0)) return { ...base, phase: d?.phase === 'guarded' ? 'guarded' : 'open', pays: false, cause: 'too small or too far to be worth a caravan', where: null, turnsLeft: null, advice: null, ...said(sub('m.diplo.statusNoPay', { kind: kindSub(route.kind), guard })) };
  return { ...base, phase: d?.phase === 'guarded' ? 'guarded' : 'open', pays: true, cause: null, where: null, turnsLeft: null, advice: null, ...said(sub(value?.km ? 'm.diplo.statusPaysKm' : 'm.diplo.statusPays', { kind: kindSub(route.kind), ...(value?.km ? { km: value.km } : {}), percent, guard })) };
};
