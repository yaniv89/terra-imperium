// Guards the ADM/DIP/MIL economy against the bug that shipped with M7-M10: the pools were capped
// at 2x their per-turn income (~8-18) while techs, laws, government changes, stability and great
// projects all cost 40-300, so none of them could ever be afforded by anyone. These tests pin two
// things: every static power price fits under POWER_POOL_CAP, and a real simulated game actually
// reaches those prices (player and AI).
import { describe, it, expect } from 'vitest';
import { ACTION_COSTS, POWER_POOL_CAP } from './actionCosts';
import { TECH_TREE, getTechPowerCost, canResearchTech } from './techTree';
import { AGE_ORDER, getAgesBehindResearchCostMultiplier } from './ages';
import { LAW_CATEGORIES } from './laws';
import { GREAT_PROJECT_TIER_COST } from './greatProjects';
import { HISTORICAL_EVENTS } from './events';
import { createInitialState, gameReducer } from '../engine/gameReducer';
import { resolveTurn } from '../engine/resolveTurn';
import { ActionTypes } from './types';

const POOLS = ['adm', 'dip', 'mil'];

// Every { adm/dip/mil } number anywhere inside ACTION_COSTS, including nested tables (missiles).
const collectPowerCosts = (node, path = [], out = []) => {
  if (!node || typeof node !== 'object') return out;
  Object.entries(node).forEach(([key, value]) => {
    if (POOLS.includes(key) && typeof value === 'number') out.push({ path: [...path, key].join('.'), value });
    else if (value && typeof value === 'object') collectPowerCosts(value, [...path, key], out);
  });
  return out;
};

describe('power costs fit under POWER_POOL_CAP', () => {
  it('every ACTION_COSTS power price', () => {
    const over = collectPowerCosts(ACTION_COSTS).filter((c) => c.value > POWER_POOL_CAP);
    expect(over).toEqual([]);
  });

  it('every tech, even at the worst ages-behind research multiplier', () => {
    const worstMult = getAgesBehindResearchCostMultiplier(AGE_ORDER.length - 1);
    const over = Object.values(TECH_TREE).filter((t) => getTechPowerCost(t) * worstMult > POWER_POOL_CAP);
    expect(over.map((t) => t.id)).toEqual([]);
  });

  it('every law (50 x tier ADM) and every great project tier', () => {
    Object.values(LAW_CATEGORIES).flat().forEach((law) => expect(50 * law.tier).toBeLessThanOrEqual(POWER_POOL_CAP));
    GREAT_PROJECT_TIER_COST.forEach((tier) => POOLS.forEach((p) => expect(tier[p] || 0).toBeLessThanOrEqual(POWER_POOL_CAP)));
  });
});

describe('power costs are actually reachable in play', () => {
  it('the player can afford a tech (power-wise) within 15 turns, and pools grow past 2x income', () => {
    let state = {
      ...createInitialState({ playerNationId: 'fr' }),
      firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      proceduralEventCooldown: 999999
    };
    for (let i = 0; i < 15; i++) state = resolveTurn(state);
    POOLS.forEach((p) => expect(state.resources[p]).toBeGreaterThan(state.resources[`max${p[0].toUpperCase()}${p.slice(1)}`] * 2));
    // techPoints aren't what this guards (Fund Scholars/Libraries supply those) — only the power side.
    const researchable = Object.keys(TECH_TREE).filter((id) =>
      canResearchTech(id, state.techTree, { ...state.resources, techPoints: 9999 }, state.year).can);
    expect(researchable.length).toBeGreaterThan(0);
    const techId = researchable[0];
    const next = gameReducer({ ...state, resources: { ...state.resources, techPoints: 9999 } }, { type: ActionTypes.RESEARCH_TECH, payload: { techId } });
    expect(next.techTree[techId].researched).toBe(true);
  }, 60000);

  it('AI nations research techs too', () => {
    let state = {
      ...createInitialState({ playerNationId: 'fr' }),
      firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      proceduralEventCooldown: 999999
    };
    for (let i = 0; i < 30; i++) state = resolveTurn(state);
    const withTech = Object.values(state.nations).filter((n) => !n.isPlayer && (n.tech?.researched || []).length > 0);
    expect(withTech.length).toBeGreaterThan(0);
  }, 120000);
});
