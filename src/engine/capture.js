// src/engine/capture.js
// The capture card (decision 40, playtest audits I128, I129, I132; plans/playtest-audits-addendum
// X01). A city battle is won when the city falls (`cityFell`, the one reading of a battle result
// for that: lane CB18 decides what makes a city battle's outcome 'attacker'). Ownership changes at
// once (conquest.js, inside applyBattleOutcome or the siege phase); when the player is the one who
// took it, a capture record waits in `state.pendingCaptures` for one choice:
//
//   conquer    keep it (it starts restless; the occupation grace and garrison rules of conquest.js
//              and loyalty.js apply)
//   raze       burn it, one size a turn (razing.js; the same checks as RAZE_CITY)
//   tributary  it stands as a one-city independent that pays the player tribute for
//              CAPTURE_TRIBUTE_TURNS turns, a truce both ways meanwhile (conflicts Q10). An
//              independent's own city goes back to that independent; anything else is a new one
//              (independents.js breakAwayAsIndependent). Needs a world with independents.
//   free       it goes back to the people who founded it, when that is a major other than the one
//              it was taken from and not at war with the player (a liberation); otherwise it stands
//              as a free independent city, friendly to the player. Needs a world with independents
//              unless there is a liberation recipient.
//
// Each option is shown with what it does and, when it is not on offer, why. The record is a
// mandatory decision (turnBlockers.js 'capture': End Turn and fast forward wait for it), it lives in
// the save, and RESOLVE_CAPTURE commits it exactly once: the record leaves the list as the choice is
// applied, so a second answer finds nothing to do. The battle's own rewards (war score, XP, the
// "city taken" record) were paid by applyBattleOutcome once, by operation id; nothing here pays
// them again. AI winners never get a card: they keep the city, and indepPolicy.js razes a small
// crowding independent's city by its rule (`aiCaptureChoice`). A headless loop that never answers
// keeps the city: resolveTurn drops what is still open at the next turn (`settleOpenCaptures`).
// Anti-loop (I132): the city's own history (conquest.js captureLog) makes a repeated capture by the
// same nation within CAPTURE_REPEAT_TURNS pay no second grace, no second favour for freeing it and
// no second tribute purse. Pure.
import { LogTypes } from '../data/types';
import { msg, people, cityRef, sub, reasonOf } from './messages';
import { getTiles } from '../data/geo/tiles';
import { isIndependentNation, FAVOUR_MAX, tributeGold } from '../data/independents';
import { canRaze, startRazing, aiWantsRaze } from './razing';
import { breakAwayAsIndependent } from './independents';
import { transferRegion } from './regionTransfer';
import { relocateLostCapital } from './conquest';
import { LOYALTY_ON_FLIP } from './loyalty';
import { canFight } from './hostility';
import { tributePerTurn, TRIBUTE_INCOME_SHARE } from './tributePricing';
import { nearestHeldCity, passableTile, unitTile, regionForTile } from './armies';

const EJECT_RINGS = 12; // how far a driven-out army looks for open ground

export const CAPTURE_CHOICES = ['conquer', 'raze', 'tributary', 'free'];
export const CAPTURE_TRIBUTE_TURNS = 40;
export const CAPTURE_TRIBUTE_PURSE_TURNS = 2;   // the new tributary starts with this many turns of tribute in its treasury
export const CAPTURE_FREE_TRUCE_TURNS = 10;     // a freed city does not raid its liberator meanwhile
export const CAPTURE_FREE_FAVOUR = 30;          // favour of a freed independent toward the player (first time only)
export const CAPTURE_LIBERATE_HOSTILITY = 20;   // hostility a liberated major drops toward the player (first time only)
export const CAPTURE_LIBERATE_LOYALTY = 75;

/**
 * Did the city fall in this battle? The one reading of a city battle's result (decision 40): the
 * attacker won and has troops that can hold it (infantry or cavalry: siege.js's melee rule). Lane
 * CB18 owns what makes the outcome 'attacker' inside the battle (the Q3 and Q4 base rule); this
 * only reads it. `fell` (optional) is an earlier rule that already took the city (an empty city, a
 * broken garrison, the keep taken).
 */
export const cityFell = (outcome, { occupier = true, fell = false } = {}) => !!fell || (outcome?.outcome === 'attacker' && !!occupier);

const nameOf = (state, id) => state.nations?.[id]?.name || id || 'nobody';
const openList = (state) => state.pendingCaptures || [];

/** The capture records still waiting for the player (the city is still the player's and not burning). */
export const pendingCapturesOf = (state) => openList(state).filter((c) => {
  const city = state.regions?.[c.cityId];
  return !!city && city.owner === c.by && c.by === state.playerNationId && !city.razing;
});

/**
 * A capture the player must decide: adds the record (once per operation id; a newer capture of the
 * same city replaces an older one). `source`: 'battle' or 'siege'. Returns the next state.
 */
export const openCapture = (state, { opId, cityId, by, from, source = 'battle' }) => {
  const id = `cap:${opId}`;
  const list = openList(state);
  if (list.some((c) => c.id === id)) return state;
  const record = { id, cityId, by, from: from ?? null, turn: state.turnNumber || 0, source };
  return { ...state, pendingCaptures: [...list.filter((c) => c.cityId !== cityId), record] };
};

/** What an AI winner does with a city it took (no card): keep it, or raze a small crowding independent's city. */
export const aiCaptureChoice = (state, nationId, cityId) => (aiWantsRaze(state, nationId, cityId) ? 'raze' : 'conquer');

// The major a freed city goes back to: the people who founded it, when that is a major other than
// the loser and the player, and not at war with the player. Else null.
export const liberationRecipient = (state, cap) => {
  const city = state.regions?.[cap.cityId];
  const id = city?.founderId;
  const n = id ? state.nations?.[id] : null;
  if (!n || id === cap.by || id === cap.from || isIndependentNation(n)) return null;
  if (canFight(state, cap.by, id)) return null;
  return id;
};

const hasIndependents = (state) => !!state.scenario?.independentTemplate;

// The player's troops in the city: where they go if it leaves the player's hands (the nearest city
// the player holds, or null when there is none).
const troopsIn = (state, cityId, nationId) => {
  const city = state.regions[cityId];
  return Object.values(state.units || {}).filter((u) => u.ownerId === nationId && (u.regionId === cityId || u.homeRegionId === cityId || (u.domain !== 'naval' && !u.embarkedOn && unitTile(state, u) === city.tile)));
};

// An option's effect sentence: the English `effect` and its message `effectMsg` for other languages.
const effectOf = (key, vars) => { const m = msg(key, vars); return { effect: m.message, effectMsg: sub(key, vars) }; };

/** The four options for a capture record: [{ id, label, effect, effectMsg, disabled, reason, reasonMsg }]. */
export const captureOptions = (state, cap) => {
  const city = state.regions?.[cap.cityId];
  if (!city) return [];
  const me = cap.by;
  const turn = state.turnNumber || 0;
  const repeat = !!city.conquest?.repeat;
  const graceUntil = city.conquest?.graceUntil;
  const troops = troopsIn(state, cap.cityId, me);
  const fallback = nearestHeldCity(state, cap.cityId, me);
  const leaveBlock = troops.length && !fallback ? reasonOf('m.why.capLeave') : null;
  const out = [];
  out.push({
    id: 'conquer', label: 'Conquer',
    ...effectOf('m.cap.conquer', { city: cityRef(cap.cityId, city.name), control: city.control ?? 25, loyalty: city.loyalty ?? 50, grace: graceUntil != null ? sub('m.cap.grace', { turns: Math.max(0, graceUntil - turn) }) : sub('m.cap.noGrace') }),
    disabled: false, reason: null
  });
  const raze = canRaze(state, me, cap.cityId);
  out.push({
    id: 'raze', label: 'Raze',
    ...effectOf('m.cap.raze', { count: city.size || 1 }),
    disabled: !raze.ok, reason: raze.ok ? null : raze.reason, reasonMsg: raze.ok ? null : raze.reasonMsg || null
  });
  const gold = Math.max(tributeGold(state.age), Math.round((Math.max(0, city.dev?.tax || 0) + Math.max(0, city.dev?.production || 0)) * TRIBUTE_INCOME_SHARE));
  const tribReason = !hasIndependents(state) ? reasonOf('m.why.capNoIndep') : leaveBlock;
  out.push({
    id: 'tributary', label: 'Make tributary',
    ...effectOf('m.cap.tributary', { gold, turns: CAPTURE_TRIBUTE_TURNS }),
    disabled: !!tribReason, reason: tribReason?.reason ?? null, reasonMsg: tribReason?.reasonMsg ?? null
  });
  const recipient = liberationRecipient(state, cap);
  const freeReason = !recipient && !hasIndependents(state) ? reasonOf('m.why.capNoOne') : leaveBlock;
  out.push({
    id: 'free', label: 'Free',
    ...(recipient
      ? effectOf('m.cap.freeBack', { nation: people(recipient, nameOf(state, recipient)), kindly: repeat ? '' : sub('m.cap.kindly') })
      : effectOf('m.cap.freeCity', { grateful: repeat ? '' : sub('m.cap.grateful') })),
    disabled: !!freeReason, reason: freeReason?.reason ?? null, reasonMsg: freeReason?.reasonMsg ?? null
  });
  return out;
};

// Moves the player's troops out of a city that leaves the player's hands, and every other land army
// of the player standing on that city's land (a siege camp): each goes to the nearest tile that is
// wild or the player's own, found ring by ring over land the army can cross, so none is left on
// land the new owner keeps shut (H-07). Their base becomes the nearest city the player holds.
const stepOut = (state, units, cityId, nationId) => {
  const tiles = getTiles();
  const city = state.regions[cityId];
  const home = nearestHeldCity(state, cityId, nationId);
  const tileOwner = state.world?.tileOwner || {};
  const isCentre = (t) => state.regions[tileOwner[t]]?.tile === t;
  const foreign = new Set(Object.values(state.units || {}).filter((u) => u.ownerId !== nationId).map((u) => unitTile(state, u)));
  const onLand = (u) => u.domain !== 'naval' && !u.embarkedOn;
  const here = new Set(troopsIn(state, cityId, nationId).map((u) => u.id));
  Object.values(state.units || {}).forEach((u) => { if (u.ownerId === nationId && onLand(u) && tileOwner[unitTile(state, u)] === cityId) here.add(u.id); });
  // The nearest tile, ring by ring from the city, that is free land or the player's own and holds no foreign army.
  const free = (t) => passableTile(tiles, t) && !isCentre(t) && !foreign.has(t) && (tileOwner[t] == null || (tileOwner[t] !== cityId && state.regions[tileOwner[t]]?.owner === nationId));
  let to = null;
  if (city.tile != null) {
    const seen = new Set([city.tile]);
    let frontier = [city.tile];
    for (let d = 0; d < EJECT_RINGS && to == null; d++) {
      const next = [];
      frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } }));
      next.sort((x, y) => x - y);
      to = next.find(free) ?? null;
      frontier = next.filter((t) => passableTile(tiles, t));
    }
  }
  [...here].forEach((id) => {
    const u = state.units[id];
    if (!home) { delete units[u.id]; return; }
    const moves = onLand(u) && tileOwner[unitTile(state, u)] === cityId;
    const tile = moves ? (to ?? state.regions[home]?.tile ?? u.tile) : u.tile;
    units[u.id] = {
      ...u,
      regionId: moves ? regionForTile(state, tile, nationId, home) : (u.regionId === cityId ? home : u.regionId),
      ...(u.homeRegionId === cityId ? { homeRegionId: home } : {}),
      ...(moves ? { tile, route: null } : {})
    };
  });
};

// The city stands as a one-city independent: its old independent if it was one, else a new one.
// Writes into `nations` and `regions`; returns the independent's id or null.
const standIndependent = (state, nations, regions, cap, turn) => {
  const city = regions[cap.cityId];
  let id = null;
  const old = cap.from ? nations[cap.from] : null;
  if (isIndependentNation(old) && !Object.values(regions).some((r) => r.owner === cap.from)) {
    id = cap.from;
    nations[id] = { ...old, isEliminated: false, capitalRegionId: cap.cityId, indep: { ...old.indep, raid: null, joined: undefined } };
  } else id = breakAwayAsIndependent(state, nations, regions, cap.cityId, turn);
  if (!id) return null;
  const rest = { ...city }; delete rest.razing;
  regions[cap.cityId] = { ...rest, owner: id, occupiedBy: undefined, conquest: undefined, formerOwner: undefined, siege: null, control: 100, unrest: 0, loyalty: LOYALTY_ON_FLIP, freeCity: undefined, lastFlipTurn: turn };
  nations[id] = { ...nations[id], capitalRegionId: cap.cityId };
  return id;
};

const setIndep = (nations, id, patch) => { nations[id] = { ...nations[id], indep: { ...(nations[id].indep || {}), ...patch } }; };

/**
 * RESOLVE_CAPTURE: commit the player's choice for capture `captureId`. Returns the next state, or
 * { reason } when the choice is not on offer. A record that is gone (already answered) or no
 * longer the player's city is a no-op (the record is dropped).
 */
export const resolveCapture = (state, captureId, choice) => {
  const cap = openList(state).find((c) => c.id === captureId);
  if (!cap) return state;
  const rest = openList(state).filter((c) => c.id !== captureId);
  const city = state.regions?.[cap.cityId];
  if (!city || city.owner !== cap.by || cap.by !== state.playerNationId) return { ...state, pendingCaptures: rest };
  const opt = captureOptions(state, cap).find((o) => o.id === choice);
  if (!opt) return reasonOf('m.why.capNotChoice');
  if (opt.disabled) return { reason: opt.reason, reasonMsg: opt.reasonMsg };
  const turn = state.turnNumber || 0;
  const log = (line) => ({ year: state.year, ...line, type: LogTypes.ACTION });
  const cityName = cityRef(cap.cityId, city.name);
  const base = { ...state, pendingCaptures: rest };
  if (choice === 'conquer') return { ...base, logs: [...state.logs, log(msg('m.battle.captureKeep', { city: cityName }))] };
  if (choice === 'raze') {
    const r = startRazing(state, cap.by, cap.cityId);
    if (!r) return reasonOf('m.why.capNoRaze');
    const stats = { ...(state.indepStats || {}), razeStarted: (state.indepStats?.razeStarted || 0) + 1 };
    return { ...base, regions: r.regions, nations: r.nations, indepStats: stats, logs: [...state.logs, ...r.logs.map(({ nationId, ...l }) => l)] }; // eslint-disable-line no-unused-vars
  }
  const repeat = !!city.conquest?.repeat;
  const regions = { ...state.regions };
  let nations = { ...state.nations };
  const units = { ...state.units };
  let line;
  const recipient = choice === 'free' ? liberationRecipient(state, cap) : null;
  if (recipient) {
    const { region, revivedNation } = transferRegion(city, recipient, nations, { formerOwner: undefined, conquest: undefined, siege: null, control: 100, unrest: 0, loyalty: CAPTURE_LIBERATE_LOYALTY, lastFlipTurn: turn });
    delete region.razing;
    regions[cap.cityId] = region;
    if (revivedNation) nations[recipient] = revivedNation;
    if (!repeat) nations[recipient] = { ...nations[recipient], hostility: Math.max(nations[recipient].hostilityFloor || 0, (nations[recipient].hostility || 0) - CAPTURE_LIBERATE_HOSTILITY) };
    line = msg('m.battle.captureHandBack', { city: cityName, nation: people(recipient, nameOf({ nations }, recipient)) });
  } else {
    const id = standIndependent(state, nations, regions, cap, turn);
    if (!id) return reasonOf('m.why.capNoStand');
    if (choice === 'tributary') {
      const gold = tributePerTurn({ ...state, regions }, id);
      const until = turn + CAPTURE_TRIBUTE_TURNS;
      const n = nations[id];
      setIndep(nations, id, {
        tributeTo: { ...(n.indep?.tributeTo || {}), [cap.by]: { until, gold } },
        truceWith: { ...(n.indep?.truceWith || {}), [cap.by]: until },
        gold: Math.max(n.indep?.gold || 0, repeat ? 0 : gold * CAPTURE_TRIBUTE_PURSE_TURNS)
      });
      line = msg('m.battle.captureTributary', { city: cityName, nation: people(id, nations[id].name), gold, turns: CAPTURE_TRIBUTE_TURNS });
    } else {
      const n = nations[id];
      setIndep(nations, id, {
        truceWith: { ...(n.indep?.truceWith || {}), [cap.by]: turn + CAPTURE_FREE_TRUCE_TURNS },
        ...(repeat ? {} : { favour: { ...(n.indep?.favour || {}), [cap.by]: Math.min(FAVOUR_MAX, (n.indep?.favour?.[cap.by] || 0) + CAPTURE_FREE_FAVOUR) } })
      });
      line = msg('m.battle.captureFree', { city: cityName, nation: people(id, nations[id].name) });
    }
  }
  stepOut({ ...state, regions }, units, cap.cityId, cap.by); // after the hand-over, so the city no longer counts as the player's
  nations = relocateLostCapital(nations, regions, cap.by);
  return { ...base, regions, nations, units, logs: [...state.logs, log(line)] };
};

/** resolveTurn: a capture still open when the turn ends (a headless loop) keeps the city. */
export const settleOpenCaptures = (state) => (openList(state).length ? { ...state, pendingCaptures: [] } : state);
