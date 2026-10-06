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

export const GOLD_OPTIONS = [500, 1500, 3000];

const sideOf = (war, me) => (war.aggressor === me ? 1 : -1);
const regionName = (state, id) => REGIONS_DATA[id]?.name || state.regions?.[id]?.name || id;

/** Every demand you could make in this war, cheapest land first; `cost` Infinity = not possible. */
export const peaceCandidates = (state, war) => {
  const me = state.playerNationId;
  const them = war.aggressor === me ? war.enemy : war.aggressor;
  const capital = state.nations?.[them]?.capitalRegionId;
  const lands = Object.values(state.regions || {})
    .filter((r) => r.owner === them && (r.occupiedBy === me || (r.conquest?.warId === war.id && r.conquest.from === me) || (war.goal?.type === 'capture_region' && war.goal.regionId === r.id)))
    .map((r) => ({
      key: `cede:${r.id}`, term: { type: 'cede', regionId: r.id }, group: 'land',
      label: `Cede ${regionName(state, r.id)}`,
      detail: [r.id === capital ? 'Their capital' : null, `size ${r.size || 1}`, r.occupiedBy === me ? 'you occupy it' : r.conquest?.from === me ? 'they took it from you' : 'your war goal'].filter(Boolean).join(', ')
    }));
  const treasury = getPool(state, them).gold || 0;
  const gold = GOLD_OPTIONS.filter((g) => g <= treasury).map((g) => ({ key: `gold:${g}`, term: { type: 'gold', amount: g }, group: 'gold', label: `${g} gold`, detail: `They have ${Math.floor(treasury)}` }));
  const rest = [
    { key: 'reparations', term: { type: 'reparations' }, group: 'other', label: 'War reparations', detail: 'A tenth of their gold income for 10 turns' },
    { key: 'humiliate', term: { type: 'humiliate' }, group: 'other', label: 'Humiliate them', detail: 'Prestige for you, a loss for them' },
    { key: 'vassalize', term: { type: 'vassalize' }, group: 'other', label: 'Make them your vassal', detail: 'They follow your wars and pay you' }
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
    return { ...c, on, status: ok ? (on ? 'Accepts' : 'Would accept') : `Refuses: too much, ${withIt - acc.total} short`, ok };
  });
  const turns = Math.max(0, (state.turnNumber || 0) - (war.startTurn ?? state.turnNumber ?? 0));
  const best = bestDeal(state, war, candidates);
  const white = getPeaceAcceptance(state, war, me, []);
  const exhaustion = (id) => Math.round(state.nations?.[id]?.warExhaustion || 0);
  return {
    war,
    enemyId: them,
    enemy: state.nations?.[them]?.name || them,
    me: state.nations?.[me]?.name || 'You',
    since: `war since turn ${war.startTurn ?? '?'} · ${turns} turn${turns === 1 ? '' : 's'}`,
    score: sign * computeWarScore(war, state),
    scoreParts: [
      { id: 'battles', label: 'Battles', value: Math.round(sign * (war.battleScore || 0)) },
      { id: 'land', label: 'Land held', value: Math.round(sign * getOccupationScore(state, war)) },
      { id: 'goal', label: 'War goal', value: Math.round(sign * (war.tickScore || 0)) }
    ],
    exhaustion: { mine: exhaustion(me), theirs: exhaustion(them), max: 100 },
    willingness: acc.total,
    ledger: acc.breakdown.filter((l) => l.value),
    rows,
    demanded: cost,
    accepted: acc.accepted,
    short,
    verdict: acc.accepted ? `${state.nations?.[them]?.name || 'They'} accept${/[^s]s$/.test(state.nations?.[them]?.name || '') ? '' : 's'}` : `Refused: ${short} short`,
    counter: best.keys.length
      ? { keys: best.keys, worth: best.worth, budget: best.budget, text: candidates.filter((c) => best.keys.includes(c.key)).map((c) => c.label).join(', ') }
      : null,
    whitePeace: { accepted: white.accepted, text: white.accepted ? 'Back to how things stand: no land or gold changes hands.' : 'They are winning: they would refuse a white peace.' },
    truceTurns: TRUCE_DURATION_TURNS,
    terms
  };
};
