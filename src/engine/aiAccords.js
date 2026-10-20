// src/engine/aiAccords.js
// The AI's accords (plans/civ-map-rework.md C6; the player's side is accords.js). Every
// AI_ACCORD_PERIOD turns, on its own slot, an AI nation looks at the nations whose cities touch
// its own:
//   open borders  two AI nations at peace that each hold the other at AI_OPEN_BORDERS_OPINION or
//                 more (the plain standing of 8: no grievance between them; the player's bar is
//                 OPEN_BORDERS_OPINION, 20, since AI opinions of each other cluster at the
//                 baseline) open their borders to each other (setOpenBorders, both records); a
//                 pair whose opinion fell under AI_CLOSE_BORDERS_OPINION closes them again (a war
//                 closes them at once, declareWar).
//   demands       a Tier-1 nation at least AI_DEMAND_RATIO times as strong as a touching nation
//                 demands the city it holds a claim on (never a capital), else a stop to settling
//                 when the other settled next to its cities, else tribute: from an AI by the same
//                 score the player's demand uses
//                 (applyDemand with a demander); from the player as `state.pendingDemand`, a
//                 card on the Diplomacy tab (ANSWER_DEMAND) and a next prompt, counted as refused
//                 after DEMAND_ANSWER_TURNS. A refusal gives the casus belli of accords.js.
//
// When a major may demand (playtest audits CB08: I100, I102, I103, I109, addendum X21). `demandBlock`
// is the one gate, with the reason; a demand is made only when it returns null:
//   war, vassal     never between enemies or overlord and vassal
//   truce           never while a truce holds (a met demand buys one, accords.js)
//   agreement       never of a partner: trade, alliance, royal marriage, a shared defensive pact,
//                   and open borders with the player (between two AI nations open borders are
//                   passage, not friendship: opinion.js)
//   friendly        never when it thinks DEMAND_MAX_OPINION or better of them
//   cooldown        once per pair per demandCooldownTurns
//   recent          and nobody is pressed twice within demandGapTurns, whoever asks (many
//                   neighbours cannot take turns: `nation.lastDemandedTurn`)
//   weak            its power must be AI_DEMAND_RATIO times theirs
//   far             and the threat must be real: land units of its own within DEMAND_REACH_KM of
//                   one of their cities, worth at least DEMAND_LOCAL_SHARE of their whole army
// The AI's war roll never picks a people it holds an open demand on (accords.js hasOpenDemand,
// aiLogic.js pickWarTarget), so the answer is always given in peace; a demand whose two sides are
// at war anyway (the player declared) is void and nothing is paid.
// Pure: returns the next nations, the logs and the pending demand.
import { getTouchingIds } from '../data/regions';
import { getNationTier } from '../utils/aiLogic';
import { isIndependentNation } from '../data/independents';
import { DEMAND_STOP_SETTLING_TURNS, DEMANDS, hasOpenBorders, setOpenBorders, applyDemand, demandAcceptance, grantDemand, tributeQuote, demandRatio, demandTruce, demandCbTurns, demandCooldownTurns, demandTruceTurns } from './accords';
import { claimsAgainst } from './claims';
import { opinionReasons } from './opinion';
import { opinionOf } from './opinion';
import { getEffectiveMilitaryPower } from './aiEconomy';
import { isWarBetween } from './diplomacy';
import { getFieldedStrength } from '../utils/helpers';
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { ringsAround } from './world/cities';
import { speedTurns } from '../data/ages';
import { DEMAND_MAX_OPINION, MET_OUR_DEMAND, GRUDGE_PER_HOSTILITY } from '../data/opinion';
import { msg, msgText, sub, carry, people, cityRef } from './messages';
import { waitAgeOf } from './ageRefs';

export const AI_ACCORD_PERIOD = 10;
export const AI_OPEN_BORDERS_OPINION = 8;
export const AI_CLOSE_BORDERS_OPINION = 0;
export const AI_DEMAND_RATIO = 2;
export const DEMAND_ANSWER_TURNS = 3;          // the player's time to answer, in turns of play (a deadline on screen, not a span of history)
// PROVISIONAL numbers (the rules above are fixed; the values wait for the tuning pass, trap T1).
export const DEMAND_GAP_REF_TURNS = 8;         // reference turns between two demands on the same people, whoever asks (13 at Normal)
export const DEMAND_REACH_KM = 612;            // a demander's army must stand this near one of the target's cities
export const DEMAND_LOCAL_SHARE = 0.5;         // and be worth this share of the target's whole fielded army
// The pressed people waits: its own age (KTD7).
export const demandGapTurns = (state, targetId) => speedTurns(DEMAND_GAP_REF_TURNS, state?.gameSpeed, waitAgeOf(state, targetId));

const atWar = (state, a, b) => (state.wars || []).some((w) => w.active && isWarBetween(w, a, b));
const related = (nations, a, b) => nations[a]?.vassalOf === b || nations[b]?.vassalOf === a;

/** The nations whose cities touch one of `nationId`'s cities, sorted. The cities-by-nation
 * index is kept per regions map, so a turn's slot nations share one scan. */
const byOwnerCache = new WeakMap(); // regions -> Map nationId -> [city]
const citiesByOwner = (regions) => {
  let m = byOwnerCache.get(regions);
  if (!m) { m = new Map(); Object.values(regions).forEach((c) => { if (!c.owner) return; const l = m.get(c.owner); if (l) l.push(c); else m.set(c.owner, [c]); }); byOwnerCache.set(regions, m); }
  return m;
};
export const touchingNations = (state, nationId) => {
  const out = new Set();
  (citiesByOwner(state.regions || {}).get(nationId) || []).forEach((c) => {
    getTouchingIds(c.id).forEach((id) => { const o = state.regions[id]?.owner; if (o && o !== nationId && state.nations?.[o] && !state.nations[o].isEliminated) out.add(o); });
  });
  return [...out].sort();
};

/** The tribute `demanderId` would ask of `targetId` today (accords.js tributeQuote). */
export const tributeOf = (state, targetId, demanderId) => tributeQuote(state, demanderId, targetId).amount;

/** The strength of `a`'s land units standing within DEMAND_REACH_KM of one of `b`'s cities: the
 * force that makes a demand credible (I109). */
export const forceNear = (state, a, b) => {
  const cities = (citiesByOwner(state.regions || {}).get(b) || []).filter((c) => c.tile != null);
  if (!cities.length) return 0;
  const tiles = getTiles();
  const rings = ringsForKm(DEMAND_REACH_KM);
  const near = cities.map((c) => ringsAround(tiles, c.tile, rings));
  let sum = 0;
  Object.values(state.units || {}).forEach((u) => {
    if (u.ownerId !== a || u.domain === 'naval' || u.embarkedOn || u.classId === 'settler' || !(u.strength > 0)) return;
    const t = u.tile != null && u.tile >= 0 ? u.tile : state.regions?.[u.regionId]?.tile;
    if (t != null && near.some((m) => m.has(t))) sum += u.strength;
  });
  return sum;
};

// Each gate's reason as a message (`textMsg`); `text` is its English sentence.
const DEMAND_BLOCK_MSG = {
  war: sub('m.diplo.blockWar'), vassal: sub('m.diplo.blockVassal'), truce: sub('m.diplo.blockTruce'),
  agreement: sub('m.diplo.blockAgreement'), friendly: sub('m.diplo.blockFriendly', { n: DEMAND_MAX_OPINION }),
  cooldown: sub('m.diplo.blockCooldown'), recent: sub('m.diplo.blockRecent'), weak: sub('m.diplo.blockWeak', { n: AI_DEMAND_RATIO }), far: sub('m.diplo.blockFar')
};
const DEMAND_BLOCK_TEXT = Object.fromEntries(Object.entries(DEMAND_BLOCK_MSG).map(([id, m]) => [id, msgText(m.key, m.vars)]));

/**
 * Why major `a` may NOT demand anything of `b` now: { id, text } or null when it may (the header's
 * gates, cheapest first). `turn` is the turn the demand would be made on.
 */
export const demandBlock = (state, a, b, turn = state.turnNumber || 1) => {
  const A = state.nations?.[a]; const B = state.nations?.[b];
  const no = (id) => ({ id, text: DEMAND_BLOCK_TEXT[id], textMsg: DEMAND_BLOCK_MSG[id] });
  if (!A || !B) return no('war');
  if (atWar(state, a, b)) return no('war');
  if (related(state.nations, a, b)) return no('vassal');
  if (demandTruce({ ...state, turnNumber: turn }, a, b)) return no('truce');
  const withPlayer = a === state.playerNationId || b === state.playerNationId;
  const other = a === state.playerNationId ? B : A; // the player's pacts are flags on the other nation's record
  if (withPlayer && (other.hasTradeAgreement || other.hasMilitaryPact || hasOpenBorders(state, a, b))) return no('agreement');
  if ((A.marriageWith || []).includes(b) || (B.marriageWith || []).includes(a)) return no('agreement');
  if (A.defensivePact && B.defensivePact && A.defensivePact.against === B.defensivePact.against) return no('agreement');
  const cooldown = A.demandCooldowns?.[b];
  if (cooldown != null && turn < cooldown) return no('cooldown');
  if (B.lastDemandedTurn != null && turn - B.lastDemandedTurn < demandGapTurns(state, b)) return no('recent');
  if (getEffectiveMilitaryPower(state, a) / Math.max(1, getEffectiveMilitaryPower(state, b)) < AI_DEMAND_RATIO) return no('weak');
  if (opinionOf(state, a, b) >= DEMAND_MAX_OPINION) return no('friendly');
  const near = forceNear(state, a, b);
  if (!(near > 0) || near < DEMAND_LOCAL_SHARE * getFieldedStrength(state, b)) return no('far');
  return null;
};

const textOf = (m) => msgText(m.key, m.vars);

const slotOf = (ids, id) => ids.indexOf(id) % AI_ACCORD_PERIOD;

/** The AI accords of this turn. `nations` is the turn's working copy (read, not mutated). */
export const processAIAccords = (state, nations, { turn, sortedByMilitary }) => {
  const me = state.playerNationId;
  const logs = [];
  let next = nations;
  let pendingDemand = state.pendingDemand || null;
  const view = () => ({ ...state, nations: next });
  // A demand whose two sides went to war is void: nothing is owed and nothing is held against the player.
  if (pendingDemand && next[pendingDemand.from] && atWar(state, pendingDemand.from, me)) {
    logs.push({ year: state.year, ...msg('m.diplo.demandVoid', { nation: people(pendingDemand.from, next[pendingDemand.from].name) }), type: 'diplomacy' });
    pendingDemand = null;
  }
  // A demand on the player left unanswered counts as refused.
  if (pendingDemand && turn > pendingDemand.until) {
    const from = next[pendingDemand.from];
    if (from && !from.isEliminated) {
      const cb = demandCbTurns(state, pendingDemand.from, me);
      next = { ...next, [pendingDemand.from]: { ...from, demandCasusBelli: { ...(from.demandCasusBelli || {}), [me]: turn + cb }, hostility: Math.min(100, (from.hostility || 0) + DEMANDS[pendingDemand.kind].hostility) } };
      logs.push({ year: state.year, ...msg('m.diplo.silenceRefusal', { nation: people(pendingDemand.from, from.name), turns: cb }), type: 'diplomacy' });
    }
    pendingDemand = null;
  }
  // Independents make no accords and are asked for nothing (plans/independent-cities.md 3.2; W3 adds tribute).
  const ids = Object.keys(nations).filter((id) => id !== me && !nations[id].isEliminated && !nations[id].isPlayer && !isIndependentNation(nations[id])).sort();
  const active = ids.filter((id) => slotOf(ids, id) === turn % AI_ACCORD_PERIOD);
  active.forEach((a) => {
    const around = touchingNations(view(), a).filter((b) => !isIndependentNation(next[b]));
    around.forEach((b) => {
      if (b === me || atWar(state, a, b) || related(next, a, b)) return;
      const ab = opinionOf(view(), a, b); const ba = opinionOf(view(), b, a);
      const open = hasOpenBorders(view(), a, b);
      if (!open && ab >= AI_OPEN_BORDERS_OPINION && ba >= AI_OPEN_BORDERS_OPINION) next = setOpenBorders(next, a, b, true);
      else if (open && (ab < AI_CLOSE_BORDERS_OPINION || ba < AI_CLOSE_BORDERS_OPINION)) next = setOpenBorders(next, a, b, false);
    });
    if (getNationTier(view(), a, sortedByMilitary) !== 1) return;
    const cooldowns = next[a].demandCooldowns || {};
    const v = view();
    const prey = around
      .filter((b) => !(b === me && pendingDemand) && !demandBlock(v, a, b, turn))
      .sort((x, y) => getEffectiveMilitaryPower(v, x) - getEffectiveMilitaryPower(v, y))[0];
    if (!prey) return;
    const { kind, cityId } = demandKind(v, a, prey);
    const quote = kind === 'tribute' ? tributeQuote(v, a, prey) : null;
    if (quote && !quote.viable) return; // they hold too little to be worth asking (no demand of 0 gold)
    if (prey === me) {
      const cityName = cityId ? state.regions[cityId]?.name : null;
      // `amount` is null for a demand that asks no gold (a city, a stop to settling).
      pendingDemand = { from: a, kind, cityId, cityName, amount: quote ? quote.amount : null, ratio: Math.round(demandRatio(v, a, me) * 100) / 100, turn, until: turn + DEMAND_ANSWER_TURNS };
      next = { ...next, [a]: { ...next[a], demandCooldowns: { ...cooldowns, [me]: turn + demandCooldownTurns(state, a, me) } }, [me]: { ...next[me], lastDemandedTurn: turn } };
      const ask = kind === 'city' ? sub('m.diplo.askCity', { city: cityRef(cityId, cityName) }) : kind === 'stopSettling' ? sub('m.diplo.askStop') : sub('m.diplo.askTribute', { gold: pendingDemand.amount });
      logs.push({ year: state.year, ...msg('m.diplo.demandMade', { nation: people(a, next[a].name), ask, truce: demandTruceTurns(state, a, me), cb: demandCbTurns(state, a, me), answer: DEMAND_ANSWER_TURNS }), type: 'diplomacy' });
      return;
    }
    const r = applyDemand(v, prey, kind, cityId, a);
    if (r.state === v) return;
    next = { ...r.state.nations, [prey]: { ...r.state.nations[prey], lastDemandedTurn: turn } };
    if (r.accepted) logs.push({ nationId: a, year: state.year, ...carry(r), type: 'diplomacy' });
  });
  return { nations: next, logs, pendingDemand };
};

/** What `a` asks of `prey`: a claimed city (never the capital), a stop to settling next to its
 * cities, or tribute. */
export const demandKind = (state, a, prey) => {
  const claimed = claimsAgainst(state, a, prey).find((c) => c.id !== state.nations[prey]?.capitalRegionId);
  if (claimed) return { kind: 'city', cityId: claimed.id };
  if (opinionReasons(state, a, prey).some((r) => r.id === 'settledNear')) return { kind: 'stopSettling', cityId: null };
  return { kind: 'tribute', cityId: null };
};

export const DEMAND_MET_HOSTILITY = 5; // hostility a met demand takes off (0.6 opinion a point)

/**
 * The terms of the demand that waits for the player, for the card and for the answer itself (one
 * truth): what is asked, the deadline, what meeting it buys and what refusing risks. Null when no
 * demand waits. `pay.ok` is false with `pay.reason` when it cannot be met now.
 */
export const demandTerms = (state) => {
  const d = state.pendingDemand;
  const from = d ? state.nations?.[d.from] : null;
  if (!d || !from || from.isEliminated) return null;
  const me = state.playerNationId;
  const turn = state.turnNumber || 1;
  const gold = Math.floor(state.resources?.gold || 0);
  const amount = d.kind === 'tribute' ? d.amount || 0 : null;
  const war = atWar(state, d.from, me);
  const truceTurns = demandTruceTurns(state, d.from, me);
  const cbTurns = demandCbTurns(state, d.from, me);
  const hostility = DEMANDS[d.kind].hostility;
  const opinionGain = MET_OUR_DEMAND + Math.round(GRUDGE_PER_HOSTILITY * Math.min(DEMAND_MET_HOSTILITY, from.hostility || 0));
  // Every English line has its message beside it (`<field>Msg`, a sub: { key, vars }) for the card in other languages.
  const payReasonMsg = war ? sub('m.diplo.payVoid')
    : d.kind === 'city' && state.regions?.[d.cityId]?.owner !== me ? sub('m.diplo.cityGone', { city: d.cityName ? cityRef(d.cityId, d.cityName) : sub('m.diplo.theCity') })
      : amount != null && gold < amount ? sub('m.diplo.goldShort', { gold, amount }) : null;
  const payReason = payReasonMsg ? textOf(payReasonMsg) : null;
  const askMsg = d.kind === 'city' ? (d.cityName ? sub('m.diplo.termCity', { city: cityRef(d.cityId, d.cityName) }) : sub('m.diplo.aCity')) : d.kind === 'stopSettling' ? sub('m.diplo.termStop', { turns: DEMAND_STOP_SETTLING_TURNS }) : sub('m.diplo.termGold', { gold: amount });
  const ask = textOf(askMsg);
  const labelMsg = sub(d.kind === 'tribute' ? 'm.diplo.labelPay' : d.kind === 'city' ? 'm.diplo.labelYield' : 'm.diplo.labelPromise');
  const payTextMsg = sub('m.diplo.payText', { turns: truceTurns, until: turn + truceTurns, opinion: opinionGain });
  const refuseTextMsg = sub('m.diplo.refuseText', { turns: cbTurns, opinion: -Math.round(GRUDGE_PER_HOSTILITY * hostility), ratio: d.ratio ?? '2' });
  const silenceMsg = sub('m.diplo.silence', { turn: d.until });
  return {
    from: d.from, name: from.name, kind: d.kind, amount, ask, askMsg, void: war,
    deadline: d.until, turnsLeft: Math.max(0, d.until - turn),
    ratio: d.ratio ?? Math.round(demandRatio(state, d.from, me) * 100) / 100,
    pay: {
      ok: !payReason, reason: payReason, reasonMsg: payReasonMsg, label: textOf(labelMsg), labelMsg,
      truceTurns, truceUntil: turn + truceTurns, opinion: opinionGain, nextDemandTurn: Math.max(turn + truceTurns, from.demandCooldowns?.[me] || 0),
      text: textOf(payTextMsg), textMsg: payTextMsg
    },
    refuse: {
      cbTurns, cbUntil: turn + cbTurns, hostility, opinion: -Math.round(GRUDGE_PER_HOSTILITY * hostility),
      text: textOf(refuseTextMsg), textMsg: refuseTextMsg
    },
    silence: textOf(silenceMsg), silenceMsg
  };
};


/** The player's answer to a pending demand: { state, message, rejected? }. `rejected` is true when
 * the demand cannot be met now (too little gold): it stays open and nothing changes. */
export const answerDemand = (state, accept) => {
  const d = state.pendingDemand;
  if (!d) return { state, message: null };
  const from = state.nations[d.from];
  const me = state.playerNationId;
  const turn = state.turnNumber || 1;
  if (!from || from.isEliminated) return { state: { ...state, pendingDemand: null }, message: null };
  // At war with them (the war roll never starts one over an open demand; the player may have): void, nothing is paid.
  if (atWar(state, d.from, me)) return { state: { ...state, pendingDemand: null }, ...msg('m.diplo.answerVoid', { nation: people(d.from, from.name) }) };
  if (accept) {
    if (d.kind === 'city' && state.regions[d.cityId]?.owner !== me) return { state: { ...state, pendingDemand: null }, ...msg('m.diplo.cityGone', { city: d.cityName ? cityRef(d.cityId, d.cityName) : sub('m.diplo.theCity') }) };
    if (d.kind === 'tribute' && Math.floor(state.resources?.gold || 0) < (d.amount || 0)) { const why = sub('m.diplo.goldShort', { gold: Math.floor(state.resources?.gold || 0), amount: d.amount }); return { state, message: null, rejected: true, reason: textOf(why), reasonMsg: why }; }
    const g = grantDemand(state, state.nations, d.from, me, d.kind, d.cityId, state.resources, { amount: d.kind === 'tribute' ? d.amount : null });
    const nations = { ...g.nations, [d.from]: { ...g.nations[d.from], hostility: Math.max(g.nations[d.from].hostilityFloor || 0, (g.nations[d.from].hostility || 0) - DEMAND_MET_HOSTILITY) } };
    return { state: { ...state, nations, regions: g.regions, resources: g.resources, pendingDemand: null }, ...msg('m.diplo.answerMet', { text: g.msgKey ? sub(g.msgKey, g.msgVars) : g.message, n: MET_OUR_DEMAND }) };
  }
  const cb = demandCbTurns(state, d.from, me);
  const hostility = DEMANDS[d.kind].hostility;
  const nations = { ...state.nations, [d.from]: { ...from, demandCasusBelli: { ...(from.demandCasusBelli || {}), [me]: turn + cb }, hostility: Math.min(100, (from.hostility || 0) + hostility) } };
  return { state: { ...state, nations, pendingDemand: null }, ...msg('m.diplo.answerRefused', { nation: people(d.from, from.name), turns: cb, opinion: -Math.round(GRUDGE_PER_HOSTILITY * hostility) }) };
};

// For the unit tests and the prompt: is a demand waiting for the player?
// (Not while the two are at war: such a demand is void and the next turn drops it.)
export const demandWaiting = (state) => !!state.pendingDemand && !!state.nations?.[state.pendingDemand.from] && !state.nations[state.pendingDemand.from].isEliminated && !atWar(state, state.pendingDemand.from, state.playerNationId);
export { demandAcceptance };
