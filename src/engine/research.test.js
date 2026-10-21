import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { TECH_TREE } from '../data/techTree';
import { applyResearchTurn, getResearchCost, getResearchPath, stepResearch, suggestTechs, canStartTech, FIRST_TECH_COST_MULT, withTechsResearched, FUTURE_TECH_COST_GROWTH } from './research';
import { ageOf, getResearched } from './nationState';
import { labelYear } from './displayYear';
import { peoplesWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 5 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

const fresh = () => peoplesWorld({ seed: 5 });
const firstOf = (category) => Object.values(TECH_TREE).find((t) => t.category === category && t.prerequisites.length === 0).id;
const secondOf = (category) => Object.values(TECH_TREE).find((t) => t.prerequisites[0] === firstOf(category)).id;
const withStock = (s, techPoints) => ({ ...s, resources: { ...s.resources, techPoints } });

describe('choosing research', () => {
  it('queues the missing earlier techs of a line before the one picked', () => {
    const s = fresh();
    const second = secondOf('military');
    expect(getResearchPath(second, new Set())).toEqual([firstOf('military'), second]);
    const next = gameReducer(s, { type: ActionTypes.RESEARCH_TECH, payload: { techId: second } });
    expect(next.research.current).toBe(firstOf('military'));
    expect(next.research.queue).toEqual([second]);
    expect(next.resources).toBe(s.resources); // choosing costs nothing
  });

  it('the research window: a Bronze nation may start a Classical tech whose prerequisite it has, not a Kingdoms one', () => {
    const classical = Object.values(TECH_TREE).find((t) => t.ageId === 'classical' && t.prerequisites.length);
    expect(canStartTech(classical.id, new Set(classical.prerequisites), 'bronze').ok).toBe(true);
    const kingdoms = Object.values(TECH_TREE).find((t) => t.ageId === 'kingdoms');
    const known = new Set(Object.values(TECH_TREE).filter((t) => t.ageId !== 'kingdoms').map((t) => t.id));
    expect(canStartTech(kingdoms.id, known, 'bronze').ok).toBe(false);
    expect(canStartTech(kingdoms.id, known, 'classical').ok).toBe(true);
  });

  it('the picker takes an own-age tech before a next-age one at equal doctrine weight, then the id', () => {
    const s = fresh();
    const all = new Set(Object.values(TECH_TREE).filter((t) => t.ageId === 'stone' && t.lineIndex === 0).map((t) => t.id));
    const picks = suggestTechs({ ...s, techAgeId: 'stone' }, FR_ID, 20, all);
    const ages = picks.map((id) => TECH_TREE[id].ageId);
    expect(ages.indexOf('bronze') === -1 || ages.lastIndexOf('stone') < ages.indexOf('bronze')).toBe(true);
    expect(picks.every((id) => ['stone', 'bronze'].includes(TECH_TREE[id].ageId))).toBe(true);
    expect(suggestTechs({ ...s, techAgeId: 'stone' }, FR_ID, 20, all)).toEqual(picks);
  });

  it('an AI nation never researches outside its window', () => {
    let s = fresh();
    const id = DE_ID;
    s = { ...s, nations: { ...s.nations, [id]: { ...s.nations[id], tech: { researched: [], ageId: 'stone' }, economy: { ...s.nations[id].economy, techPoints: 1e7 } } } };
    const out = stepResearch(s, id);
    expect(out.completed.length).toBeGreaterThan(0);
    expect(out.completed.every((t) => ['stone', 'bronze'].includes(TECH_TREE[t].ageId))).toBe(true);
  });
});

describe('science pays into research', () => {
  it('completes a tech when its cost is reached and carries the rest into the next', () => {
    let s = gameReducer(fresh(), { type: ActionTypes.QUEUE_RESEARCH, payload: { techId: firstOf('military') } });
    s = gameReducer(s, { type: ActionTypes.QUEUE_RESEARCH, payload: { techId: firstOf('governance') } });
    const cost = getResearchCost(s, FR_ID, firstOf('military'));
    const out = stepResearch(withStock(s, cost + 5), FR_ID);
    expect(out.completed).toEqual([firstOf('military')]);
    expect(out.research.current).toBe(firstOf('governance'));
    expect(out.research.progress[firstOf('governance')]).toBe(5);
    expect(out.stock).toBe(0);
  });

  it('keeps progress on a tech when switching away and back', () => {
    let s = gameReducer(fresh(), { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('military') } });
    s = applyResearchTurn(withStock(s, 3));
    const paid = s.research.progress[firstOf('military')]; // 3, plus the tech's boost when the map already meets it
    expect(paid).toBeGreaterThanOrEqual(3);
    s = gameReducer(s, { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('governance') } });
    s = gameReducer(s, { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('military') } });
    expect(s.research.progress[firstOf('military')]).toBe(paid);
  });

  it('banks science when nothing is chosen, and the advisor picks when allowed', () => {
    const s = withStock(fresh(), 40);
    const banked = applyResearchTurn(s);
    expect(banked.resources.techPoints).toBe(40);
    expect(banked.research.current).toBe(null);
    const auto = applyResearchTurn(gameReducer(s, { type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } }));
    expect(auto.resources.techPoints).toBeLessThan(40);
    expect(suggestTechs(s, FR_ID)).toHaveLength(3);
  });

  it('AI nations research with the same rules', () => {
    const s = fresh();
    const id = DE_ID;
    const withAi = { ...s, nations: { ...s.nations, [id]: { ...s.nations[id], economy: { ...s.nations[id].economy, techPoints: 200 } } } };
    // AI nations pay into research on a staggered cycle (AI_RESEARCH_PERIOD): one of these turns is Germany's.
    const outs = [0, 1, 2].map((k) => applyResearchTurn({ ...withAi, turnNumber: withAi.turnNumber + k }));
    const out = outs.find((o) => o.nations[id].economy.techPoints < 200);
    expect(out).toBeDefined();
    expect(out.nations[id].tech.researched.length).toBeGreaterThan(0);
    expect(outs.filter((o) => o.nations[id].economy.techPoints < 200)).toHaveLength(1);
  });
});

describe('through resolveTurn', () => {
  it('a chosen tech completes after enough turns, deterministically', () => {
    const quiet = (st) => ({ ...st, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
    const play = () => {
      let s = quiet(gameReducer(fresh(), { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('governance') } }));
      for (let t = 0; t < 12 && !s.techTree[firstOf('governance')]?.researched; t++) {
        if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE });
        s = resolveTurn(s);
        if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      }
      return s;
    };
    const a = play(); const b = play();
    expect(a.techTree[firstOf('governance')].researched).toBe(true);
    expect(a.turnNumber).toBe(b.turnNumber);
    expect(a.logs.some((l) => l.message === `Researched ${TECH_TREE[firstOf('governance')].name}.`)).toBe(true);
  });
});

describe('speed is keyed by the paying nation (KTD9)', () => {
  it('a tech costs the payer\'s own age multiplier, not the tech\'s', () => {
    const s = fresh();
    const tech = Object.values(TECH_TREE).find((t) => t.ageId === 'classical').id;
    const asBronze = getResearchCost({ ...s, techAgeId: 'bronze' }, FR_ID, tech);
    const asClassical = getResearchCost({ ...s, techAgeId: 'classical' }, FR_ID, tech);
    expect(asClassical / asBronze).toBeCloseTo((20 / 12) / 1.6, 1);
  });
});

describe('the first tech (U47)', () => {
  it('costs FIRST_TECH_COST_MULT of the full price until a nation knows a tech', () => {
    const s = fresh();
    const me = s.playerNationId;
    const stone = Object.values(TECH_TREE).filter((t) => t.ageId === 'stone' && t.id !== 'economy_agriculture' && canStartTech(t.id, new Set(), 'stone').ok).map((t) => t.id);
    const [a, b] = stone;
    const first = getResearchCost(s, me, b);
    const known = { ...s, techTree: { ...s.techTree, [a]: { ...s.techTree[a], researched: true } } };
    const full = getResearchCost(known, me, b);
    expect(first).toBeLessThan(full);
    expect(first).toBeCloseTo(full * FIRST_TECH_COST_MULT, -1);
  });
});

describe('the Future (U64, U65)', () => {
  const futureIds = Object.values(TECH_TREE).filter((t) => t.ageId === 'future' && !t.outsideThreshold).map((t) => t.id);
  const allButFutureTech = Object.keys(TECH_TREE).filter((id) => !TECH_TREE[id].repeatable);
  const inFuture = (ids) => withTechsResearched(fresh(), FR_ID, ids);

  it('the age threshold and the year label count the 10 base techs; 2500 only with all ten', () => {
    const before = Object.keys(TECH_TREE).filter((id) => TECH_TREE[id].ageId !== 'future');
    const s = inFuture([...before, 'military_autonomous_warfare', 'science_machine_consciousness']);
    expect(ageOf(s, FR_ID)).toBe('future');
    expect(labelYear('future', getResearched(s, FR_ID))).toBe(labelYear('future', before)); // robot techs move no label
    expect(labelYear('future', [...futureIds.slice(1)])).toBeLessThan(2500);
    expect(labelYear('future', futureIds)).toBe(2500);
  });

  it('Future Tech repeats, never marked researched, each one dearer', () => {
    let s = withStock(inFuture(allButFutureTech), 0);
    const id = 'governance_future_tech';
    const first = getResearchCost(s, FR_ID, id);
    expect(canStartTech(id, new Set(getResearched(s, FR_ID)), 'future').ok).toBe(true);
    expect(canStartTech(id, new Set(allButFutureTech.filter((t) => t !== 'economy_automated_industry')), 'future').ok).toBe(false); // after the last Future tech only
    s = { ...withStock(s, first * 2.5 + 1), research: { ...s.research, current: id, queue: [] } };
    const step = stepResearch(s, FR_ID);
    expect(step.completed).toEqual([id, id]);
    expect(step.research.futureTechs).toBe(2);
    expect(getResearchCost({ ...s, research: step.research }, FR_ID, id)).toBe(Math.round(first * (1 + 2 * FUTURE_TECH_COST_GROWTH)));
    const next = applyResearchTurn(s);
    expect(next.techTree[id]?.researched).toBeFalsy();
    expect(next.research.futureTechs).toBe(2);
  });
});
