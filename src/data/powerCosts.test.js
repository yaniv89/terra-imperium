// Differentiation plan U7 (KTD2): the ADM/DIP/MIL pools are gone. Every cost, grant and modifier
// is gold, a decree, authority or nothing; this guards the data and the cost code against a pool
// key creeping back, checks that every decree act costs what DECREE_ACTS says, and that science
// still researches techs for the player and the AI.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ACTION_COSTS } from './actionCosts';
import { DECREE_ACTS } from './decrees';
import { TECH_TREE } from './techTree';
import { HISTORICAL_EVENTS } from './events';
import { gameReducer } from '../engine/gameReducer';
import { resolveTurn } from '../engine/resolveTurn';
import { getIncreaseStabilityCost } from '../engine/nationalPower';
import { ActionTypes } from './types';
import { peoplesWorld } from '../engine/testWorld';

// Every file that holds a cost, a grant or a modifier source.
const SOURCES = ['data/actionCosts.js', 'data/laws.js', 'data/government.js', 'data/techTree.js', 'data/greatProjects.js', 'data/eraGoals.js',
  'data/events.js', 'data/proceduralEvents.js', 'data/eventChains.js', 'data/startingDoctrines.js', 'engine/colonies.js', 'engine/development.js',
  'engine/elimination.js', 'engine/applyEventEffects.js', 'engine/modifiers/registry.js', 'engine/modifiers/sources.js', 'engine/nationalPower.js'];

describe('no pool anywhere (KTD2)', () => {
  it('no cost, grant or modifier source names adm, dip or mil as a currency or a bonus', () => {
    SOURCES.forEach((file) => {
      const code = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      expect(code.match(/\b(adm|dip|mil|ap)Bonus\b|\b(resources|economy|pool)\??\.(adm|dip|mil)\b|effects: \{[^}]*\b(adm|dip|mil): /g), file).toBeNull();
    });
  });

  it('every decree act costs what DECREE_ACTS says, and no ACTION_COSTS entry carries a pool key', () => {
    Object.entries(ACTION_COSTS).forEach(([id, cost]) => {
      ['adm', 'dip', 'mil'].forEach((k) => expect(cost[k], `${id}.${k}`).toBeUndefined());
      if (cost.decrees) expect(DECREE_ACTS[id]?.decrees, id).toBe(cost.decrees);
    });
    Object.entries(DECREE_ACTS).forEach(([id, act]) => {
      if (id === 'increaseStability') expect(getIncreaseStabilityCost({ nations: {}, regions: {}, techTree: {} }, 'x').decrees).toBe(act.decrees);
      else if (id !== 'reshapeRuler') expect(ACTION_COSTS[id]?.decrees, id).toBe(act.decrees);
    });
  });
});

describe('science is still reachable in play', () => {
  it('science alone researches a first tech within 15 turns', () => {
    let state = {
      ...peoplesWorld({ seed: 7 }),
      firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      proceduralEventCooldown: 999999
    };
    // Research is Civ-style (src/engine/research.js): choose a tech, science pays for it each turn.
    const techId = Object.values(TECH_TREE).find((t) => t.prerequisites.length === 0).id;
    state = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId } });
    for (let i = 0; i < 15; i++) state = resolveTurn(state);
    expect(state.techTree[techId].researched).toBe(true);
  }, 60000);

  it('AI nations research techs too', () => {
    // A fixed seed and auto-defend: a random seed can queue an AI assault on France that stalls
    // resolveTurn until the player answers it.
    let state = {
      ...peoplesWorld({ seed: 7 }),
      firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      proceduralEventCooldown: 999999,
      battleSettings: { autoDefend: true }
    };
    for (let i = 0; i < 30; i++) state = resolveTurn(state);
    const withTech = Object.values(state.nations).filter((n) => !n.isPlayer && (n.tech?.researched || []).length > 0);
    expect(withTech.length).toBeGreaterThan(0);
  }, 120000);
});
