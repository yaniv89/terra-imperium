// src/components/battle/peaceDealModel.js
// W13 Peace deal (plans/UI-DESIGN.md): what the peace table shows, from the same ledger the engine
// decides with (peace.js getPeaceAcceptance, getTermCost). The war score from your side and its
// parts (battles, land held, the war goal), both sides' war exhaustion, every demand you could make
// with its cost and, live, whether they accept it or how much you are short, the most they would
// give (their counter-offer) and a white peace. Pure.
import { REGIONS_DATA } from '../../data/regions';
import { TRUCE_DURATION_TURNS } from '../../data/actionCosts';
import { getPeaceAcceptance, getTermCost } from '../../engine/peace';
import { computeWarScore, getOccupationScore } from '../../engine/diplomacy';
import { getPool } from '../../engine/nationState';
import { msgText, sub, people, cityRef } from '../../engine/messages';
import { t, isolateLtr } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { agreed } from './battleText';

export const GOLD_OPTIONS = [500, 1500, 3000];

const sideOf = (war, me) => (war.aggressor === me ? 1 : -1);
const regionName = (state, id) => nameNow('city', null, REGIONS_DATA[id]?.name || state.regions?.[id]?.name || id);
const nationNow = (state, id) => (state.nations?.[id]?.name ? nameNow('people', id, state.nations[id].name) : id);
// A ledger line's label in the current language (peace.js breakdown rows carry an id).
export const ledgerLabel = (l) => (l.id ? t(`bt.peace.ledger.${l.id}`) : l.label);

/** Every demand you could make in this war, cheapest land first; `cost` Infinity = not possible. */
export const peaceCandidates = (state, war) => {
  const me = state.playerNationId;
  const them = war.aggressor === me ? war.enemy : war.aggressor;
  const capital = state.nations?.[them]?.capitalRegionId;
  const lands = Object.values(state.regions || {})
    .filter((r) => r.owner === them && (r.occupiedBy === me || (r.conquest?.warId === war.id && r.conquest.from === me) || (war.goal?.type === 'capture_region' && war.goal.regionId === r.id)))
    .map((r) => ({
      key: `cede:${r.id}`, term: { type: 'cede', regionId: r.id }, group: 'land',
      label: t('bt.peace.cede', { city: regionName(state, r.id) }),
      detail: [r.id === capital ? t('bt.peace.theirCapital') : null, t('bt.peace.size', { n: r.size || 1 }), r.occupiedBy === me ? t('bt.peace.youOccupy') : r.conquest?.from === me ? t('bt.peace.tookFromYou') : t('bt.peace.warGoal')].filter(Boolean).join(', ')
    }));
  const treasury = getPool(state, them).gold || 0;
  const gold = GOLD_OPTIONS.filter((g) => g <= treasury).map((g) => ({ key: `gold:${g}`, term: { type: 'gold', amount: g }, group: 'gold', label: t('bt.peace.goldOpt', { g }), detail: t('bt.peace.theyHave', { n: Math.floor(treasury) }) }));
  const rest = [
    { key: 'reparations', term: { type: 'reparations' }, group: 'other', label: t('bt.peace.reparations'), detail: t('bt.peace.reparationsDetail') },
    { key: 'humiliate', term: { type: 'humiliate' }, group: 'other', label: t('bt.peace.humiliate'), detail: t('bt.peace.humiliateDetail') },
    { key: 'vassalize', term: { type: 'vassalize' }, group: 'other', label: t('bt.peace.vassalize'), detail: t('bt.peace.vassalizeDetail') }
  ];
  return [...lands, ...gold, ...rest]
    .map((c) => ({ ...c, cost: getTermCost(state, war, me, c.term) }))
    .filter((c) => Number.isFinite(c.cost))
    .sort((a, b) => (a.group === 'land' ? 0 : 1) - (b.group === 'land' ? 0 : 1) || a.cost - b.cost);
};

/** The most they would give: the candidates, cheapest land first, while the willingness covers them (one gold option at most). */
export const bestDeal = (state, war, candidates = peaceCandidates(state, war)) => {
  const me = state.playerNationId;
  const budget = getPeaceAcceptance(state, war, me, []).total;
  const picked = []; let spent = 0;
  candidates.forEach((c) => {
    if (c.group === 'gold' && picked.some((p) => p.group === 'gold')) return;
    if (spent + c.cost <= budget) { picked.push(c); spent += c.cost; }
  });
  return { keys: picked.map((p) => p.key), worth: spent, budget };
};

const signedN = (n) => isolateLtr(n > 0 ? `+${n}` : `${n}`);
const ledgerText = (l) => (l.id === 'odds' && l.pct != null ? `${ledgerLabel(l)}` : ledgerLabel(l));

/**
 * Why a white peace is refused (PEACE-01): the willingness against the price, then the two biggest
 * things pulling it down, in the ledger's own words. The war score is a separate number.
 */
export const refusalReason = (acc) => {
  const worst = (acc.breakdown || []).filter((l) => l.value < 0).sort((a, b) => a.value - b.value).slice(0, 2);
  const why = worst.length ? t('bt.peace.refusalWeighing', { list: worst.map((l) => `${ledgerText(l).toLowerCase()} ${signedN(l.value)}`).join(', ') }) : '';
  return t('bt.peace.refusal', { total: acc.total, cost: acc.cost, why });
};

const placeName = (state, id) => regionName(state, id);

/**
 * What an AI peace offer (state.pendingPeaceOffer) would do, said plainly (PEACE-02): who keeps
 * which city, what is paid, and the turn the truce ends. Same rules as peace.js applyPeace: an
 * occupation between the two sides ends and the city goes back to its owner; land conquered in this
 * war stays with its conqueror unless a term cedes it. `ownership` and `money` are the English lines;
 * `ownershipMsg` and `moneyMsg` the same lines as messages ({ key, vars }) for other languages.
 */
export const peaceOfferModel = (state, offer) => {
  const war = (state.wars || []).find((w) => w.id === offer?.warId);
  const me = state.playerNationId;
  const them = offer?.from;
  const terms = offer?.terms || [];
  const sign = war ? (war.aggressor === me ? 1 : -1) : 1;
  const score = war ? Math.round(sign * computeWarScore(war, state)) : null;
  const ceded = new Set(terms.filter((t) => t.type === 'cede').map((t) => t.regionId));
  const keeps = []; const changes = [];
  const themRef = people(them, state.nations?.[them]?.name || 'them');
  Object.values(state.regions || {}).forEach((r) => {
    const nm = cityRef(r.id, placeName(state, r.id));
    if (ceded.has(r.id)) { changes.push(r.owner === me ? sub('m.diplo.ownFromYou', { city: nm, to: themRef }) : sub('m.diplo.ownToYou', { city: nm, from: people(r.owner, state.nations?.[r.owner]?.name || r.owner) })); return; }
    if (r.occupiedBy === them && r.owner === me) changes.push(sub('m.diplo.ownBack', { city: nm }));
    else if (r.occupiedBy === me && r.owner === them) changes.push(sub('m.diplo.ownReturns', { city: nm, nation: themRef }));
    else if (war && r.conquest?.warId === war.id) keeps.push(r.owner === me ? sub('m.diplo.ownStaysYours', { city: nm }) : sub('m.diplo.ownStaysTheirs', { city: nm, nation: people(r.owner, state.nations?.[r.owner]?.name || r.owner) }));
  });
  const moneyMsg = terms.flatMap((t) => (t.type === 'gold' ? [sub('m.diplo.moneyGold', { nation: themRef, gold: Math.round(Math.abs(t.amount || 0)) })]
    : t.type === 'reparations' ? [sub('m.diplo.moneyReparations')] : []));
  const ownershipMsg = [...changes, ...keeps];
  const textOf = (m) => msgText(m.key, m.vars);
  const truceEndsTurn = (state.turnNumber || 0) + TRUCE_DURATION_TURNS;
  return { score, themWinning: score != null && score < 0, ownership: ownershipMsg.map(textOf), money: moneyMsg.map(textOf), ownershipMsg, moneyMsg, truceEndsTurn };
};

/** The whole table for `selected` (a Set of candidate keys). */
export const peaceDealModel = (state, warId, selected = new Set()) => {
  const war = (state.wars || []).find((w) => w.id === warId && w.active);
  if (!war) return null;
  const me = state.playerNationId;
  const them = war.aggressor === me ? war.enemy : war.aggressor;
  const sign = sideOf(war, me);
  const candidates = peaceCandidates(state, war);
  const chosen = candidates.filter((c) => selected.has(c.key));
  const terms = chosen.map((c) => c.term);
  const acc = getPeaceAcceptance(state, war, me, terms);
  const cost = Number.isFinite(acc.cost) ? acc.cost : chosen.reduce((s, c) => s + c.cost, 0);
  const short = Math.max(0, cost - acc.total);
  const rows = candidates.map((c) => {
    const on = selected.has(c.key);
    const withIt = on ? cost : cost + c.cost;
    const ok = withIt <= acc.total;
    return { ...c, on, status: ok ? (on ? t('bt.peace.accepts') : t('bt.peace.wouldAccept')) : t('bt.peace.refuses', { n: withIt - acc.total }), ok };
  });
  const turns = Math.max(0, (state.turnNumber || 0) - (war.startTurn ?? state.turnNumber ?? 0));
  const best = bestDeal(state, war, candidates);
  const white = getPeaceAcceptance(state, war, me, []);
  const exhaustion = (id) => Math.round(state.nations?.[id]?.warExhaustion || 0);
  return {
    war,
    enemyId: them,
    enemy: nationNow(state, them),
    me: state.nations?.[me]?.name ? nationNow(state, me) : t('bt.peace.you'),
    since: t('bt.peace.since', { turn: war.startTurn ?? '?', count: turns }),
    score: sign * computeWarScore(war, state),
    scoreParts: [
      { id: 'battles', label: t('bt.peace.battles'), value: Math.round(sign * (war.battleScore || 0)) },
      { id: 'land', label: t('bt.peace.landHeld'), value: Math.round(sign * getOccupationScore(state, war)) },
      { id: 'goal', label: t('bt.peace.warGoalLabel'), value: Math.round(sign * (war.tickScore || 0)) }
    ],
    exhaustion: { mine: exhaustion(me), theirs: exhaustion(them), max: 100 },
    willingness: acc.total,
    ledger: acc.breakdown.filter((l) => l.value).map((l) => ({ ...l, label: ledgerLabel(l) })),
    rows,
    demanded: cost,
    accepted: acc.accepted,
    refusal: acc.accepted ? null : refusalReason(acc), // said after their answer when the offer goes out
    short,
    verdict: acc.accepted ? (state.nations?.[them]?.name ? agreed('bt.peace.theyAccept', { name: nationNow(state, them) }, () => `${state.nations[them].name} accept${/[^s]s$/.test(state.nations[them].name) ? '' : 's'}`) : t('bt.peace.theyAcceptDefault')) : t('bt.peace.refusedShort', { n: short }),
    counter: best.keys.length
      ? { keys: best.keys, worth: best.worth, budget: best.budget, text: candidates.filter((c) => best.keys.includes(c.key)).map((c) => c.label).join(', ') }
      : null,
    whitePeace: { accepted: white.accepted, text: white.accepted ? t('bt.peace.white') : refusalReason(white) },
    truceTurns: TRUCE_DURATION_TURNS,
    terms
  };
};
