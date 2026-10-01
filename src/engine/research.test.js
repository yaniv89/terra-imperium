import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { TECH_TREE } from '../data/techTree';
import { applyResearchTurn, getResearchCost, getResearchPath, stepResearch, suggestTechs, canStartTech } from './research';

const fresh = () => createInitialState({ playerNationId: 'fr', rngSeed: 5 });
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

  it('a tech whose year has not come yet cannot start', () => {
    const later = Object.values(TECH_TREE).find((t) => t.ageId === 'classical' && t.prerequisites.length);
    expect(canStartTech(later.id, new Set(later.prerequisites), -2000).ok).toBe(false);
  });
});

describe('science pays into research', () => {
  it('completes a tech when its cost is reached and carries the rest into the next', () => {
    let s = gameReducer(fresh(), { type: ActionTypes.QUEUE_RESEARCH, payload: { techId: firstOf('military') } });
    s = gameReducer(s, { type: ActionTypes.QUEUE_RESEARCH, payload: { techId: firstOf('economy') } });
    const cost = getResearchCost(s, 'fr', firstOf('military'));
    const out = stepResearch(withStock(s, cost + 5), 'fr');
    expect(out.completed).toEqual([firstOf('military')]);
    expect(out.research.current).toBe(firstOf('economy'));
    expect(out.research.progress[firstOf('economy')]).toBe(5);
    expect(out.stock).toBe(0);
  });

  it('keeps progress on a tech when switching away and back', () => {
    let s = gameReducer(fresh(), { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('military') } });
    s = applyResearchTurn(withStock(s, 3));
    expect(s.research.progress[firstOf('military')]).toBe(3);
    s = gameReducer(s, { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('economy') } });
    s = gameReducer(s, { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('military') } });
    expect(s.research.progress[firstOf('military')]).toBe(3);
  });

  it('banks science when nothing is chosen, and the advisor picks when allowed', () => {
    const s = withStock(fresh(), 40);
    const banked = applyResearchTurn(s);
    expect(banked.resources.techPoints).toBe(40);
    expect(banked.research.current).toBe(null);
    const auto = applyResearchTurn(gameReducer(s, { type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } }));
    expect(auto.resources.techPoints).toBeLessThan(40);
    expect(suggestTechs(s, 'fr')).toHaveLength(3);
  });

  it('AI nations research with the same rules', () => {
    const s = fresh();
    const id = 'de';
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
      let s = quiet(gameReducer(fresh(), { type: ActionTypes.RESEARCH_TECH, payload: { techId: firstOf('economy') } }));
      for (let t = 0; t < 12 && !s.techTree[firstOf('economy')]?.researched; t++) {
        if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE });
        s = resolveTurn(s);
        if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      }
      return s;
    };
    const a = play(); const b = play();
    expect(a.techTree[firstOf('economy')].researched).toBe(true);
    expect(a.turnNumber).toBe(b.turnNumber);
    expect(a.logs.some((l) => l.message === `Researched ${TECH_TREE[firstOf('economy')].name}.`)).toBe(true);
  });
});
