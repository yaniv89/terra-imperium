// src/components/map/marchBar.test.js
// ACT-01 (GPT audit): a halted army, March toward Hagmatana (an independent), "Attack now" opened
// the province card with no attack in it, and nothing happened. Two causes: the bar's Attack opened
// the province card instead of the attack card, and the card listed only armies based next to the
// city, never one based far away that stands beside it. Every refused attack now says why on the
// bar (and its button is off), one test per refusal reason, and the province card lists the army.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCity, cap, gateTile } from '../../engine/testWorld';
import { getNeighborIds } from '../../data/regions';
import { getTiles } from '../../data/geo/tiles';
import { marchBarModel } from './MarchBar';
import RegionInfoModal from '../modals/RegionInfoModal';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

const game = vi.hoisted(() => ({ state: null, dispatch: vi.fn(), addLog: vi.fn() }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../../context/EffectsContext', () => ({ useEffects: () => ({ triggerEffect: vi.fn(), effects: [] }) }));
vi.mock('../../context/MapInsetsContext', () => ({ useReportInset: () => {} }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../hooks/useAutoPeek', () => ({ useAutoPeek: () => [false, vi.fn()] }));

const BASE = (() => {
  const s0 = peoplesWorld({ seed: 7 });
  // A German city away from the French capital: an army based at the capital must walk to it.
  const { state, cityId } = addCity(s0, DE);
  return { state, home: cap(FR), target: cityId };
})();

let s;
const army = (extra = {}) => ({ id: 'army', ownerId: FR, regionId: BASE.home, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, ...extra });
const march = (target = BASE.target) => ({ from: BASE.home, target, unitIds: ['army'], naval: false });
const PLAN = { ok: true, turns: 2, supplies: 3 };

beforeEach(() => {
  const gate = gateTile(BASE.state, BASE.home, BASE.target);
  s = {
    ...BASE.state,
    wars: [{ id: 'w', aggressor: FR, enemy: DE, active: true, score: 0 }],
    resources: { ...BASE.state.resources, gold: 10000, mil: 10000 },
    units: { army: army({ tile: gate }) }
  };
  game.state = s;
});

describe('ACT-01 march bar: an army beside a city', () => {
  it('the fixture: the army is based away from the city but stands beside it', () => {
    expect(gateTile(BASE.state, BASE.home, BASE.target)).not.toBeNull();
    const m = marchBarModel(s, march(), PLAN);
    expect(m.canAttackNow).toBe(true);
    expect(m.attackBlocked).toBeNull();
  });

  it('no moves left: the bar says why and the attack is off', () => {
    s.units.army = { ...s.units.army, movesLeft: 0 };
    const m = marchBarModel(s, march(), PLAN);
    expect(m.canAttackNow).toBe(true);
    expect(m.attackBlocked).toMatch(/End the turn before attacking again\./);
  });

  it('not enough resources: the bar says why', () => {
    s.resources = {};
    expect(marchBarModel(s, march(), PLAN).attackBlocked).toBe('Not enough resources to launch this attack.');
  });

  it('at peace with a major: no attack is offered, and the bar says declare war first', () => {
    s.wars = [];
    const m = marchBarModel(s, march(), PLAN);
    expect(m.canAttackNow).toBe(false);
    expect(m.canMarchAttack).toBe(false);
    expect(m.marchAttackBlocked).toBe(`At peace with ${s.nations[DE].name}: declare war before attacking (its province card).`);
  });

  it('far at war: March to attack, no refusal', () => {
    s.units.army = army({ tile: s.regions[BASE.home].tile });
    const m = marchBarModel(s, march(), PLAN);
    expect(m.canAttackNow).toBe(false);
    expect(m.canMarchAttack).toBe(true);
    expect(m.marchAttackBlocked).toBeNull();
  });

  it('an independent city is attacked without a war', () => {
    s.wars = [];
    s.nations = { ...s.nations, [DE]: { ...s.nations[DE], kind: 'independent', indep: { personality: 'tribal' } } };
    const m = marchBarModel(s, march(), PLAN);
    expect(m.canAttackNow).toBe(true);
    expect(m.attackBlocked).toBeNull();
  });

  it('an enemy army beside the stack it cannot attack (no moves): the reason, not "march beside it"', () => {
    const tiles = getTiles();
    const at = s.units.army.tile;
    const spot = tiles.neighbors[at].find((t) => tiles.land[t] === 1 && t !== s.regions[BASE.target].tile);
    s.units.army = { ...s.units.army, movesLeft: 0 };
    s.units.foe = { id: 'foe', ownerId: DE, regionId: BASE.target, tile: spot, domain: 'land', classId: 'infantry', strength: 500, maxStrength: 1000, morale: 100, movesLeft: 1 };
    const m = marchBarModel(s, march(spot), PLAN);
    expect(m.enemyArmy?.adjacent).toBe(true);
    expect(m.enemyArmy.blocked).toMatch(/End the turn before attacking again\./);
  });
});

describe('ACT-01 province card: the army beside it is a source', () => {
  it('lists Invade for an army based far away that stands beside the city', () => {
    expect(getNeighborIds(BASE.target)).not.toContain(BASE.home); // the army's base is not next to the city
    const html = renderToStaticMarkup(React.createElement(RegionInfoModal, { regionId: BASE.target, onClose: vi.fn() }));
    expect(html).toContain(`Invade ${s.regions[BASE.target].name}`);
    expect(html).not.toContain('No actions available against this region right now.');
  });

  it('with no army near, at war, the card says how to attack instead of "no actions"', () => {
    s.units = {};
    game.state = s;
    const html = renderToStaticMarkup(React.createElement(RegionInfoModal, { regionId: BASE.target, onClose: vi.fn() }));
    expect(html).toContain('No army of yours is beside this city');
  });
});
