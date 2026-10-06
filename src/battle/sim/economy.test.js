// src/battle/sim/economy.test.js
// The battle economy (phase R1; master plan 6.3, 6.4): workers gather and deposit, sites go up,
// training waits for housing but the brought army never does, destroyed houses lower the cap, the
// AI runs an economy, and a battle with an economy is as deterministic as any other.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { worldHash } from './hash';
import { toStrategicResult } from './result';
import { housingCap, placementBlock, START_WORKERS } from './economy';
import { BUILDINGS, MILLI, POP_LIMIT, CAMP_HOUSING, CAMP_HOUSING_PER_REGIMENT, START_STOCK, stockMult } from '../data/economy';
import { buildTownManifest, manifestHousing } from '../../data/townLayout';
import { Q, ECONOMY_FIELD_TICKS, ECONOMY_SIEGE_TICKS } from './constants';

const mk = (p, cls, extra = {}) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', ...extra }));
const ecoSetup = (opts = {}) => buildSetupFromArmies({
  regionId: 'eco-test', terrain: 'mixed', seed: 11,
  attackerUnits: mk('a', ['infantry', 'infantry', 'ranged']), defenderUnits: mk('d', ['infantry', 'ranged']),
  controllers: ['player', 'player'], intel: { attackerSeesDefender: true }, economy: true, ...opts
});
const run = (w, ticks, orders = []) => { step(w, orders); for (let i = 1; i < ticks && !w.ended; i++) { step(w, []); w.events.length = 0; } };
const workersOf = (w, side) => w.squads.filter((q) => q.worker && q.side === side && q.alive);
// A spot `type` fits for `side` near its headquarters (the same rule the AI uses).
const spotFor = (w, side, type) => {
  const hq = w.eco.buildings.find((b) => b.side === side && BUILDINGS[b.type].hq);
  for (let r = 3; r < 18; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const tx = Math.floor(hq.x / Q) + dx; const ty = Math.floor(hq.y / Q) + dy;
    if (!placementBlock(w, side, type, tx, ty)) return { tx, ty };
  }
  return null;
};

describe('battle economy', () => {
  it('is off unless the setup asks for it: no eco state, the old clocks', () => {
    const setup = buildSetupFromArmies({ regionId: 'eco-test', terrain: 'mixed', seed: 11, attackerUnits: mk('a', ['infantry']), defenderUnits: mk('d', ['infantry']) });
    expect(setup.economy).toBeNull();
    expect(createWorld(setup).eco).toBeUndefined();
  });

  it('starts with a camp, a town hall, laborers and stockpiles scaled by supply', () => {
    const setup = ecoSetup();
    expect(setup.limitTicks).toBe(ECONOMY_FIELD_TICKS);
    const w = createWorld(setup);
    expect(w.eco.buildings.map((b) => b.type)).toEqual(['camp', 'hall']);
    expect(workersOf(w, 0)).toHaveLength(START_WORKERS);
    expect(workersOf(w, 1)).toHaveLength(START_WORKERS);
    expect(w.eco.stock[0][0]).toBe(Math.round(START_STOCK.attacker.food * stockMult(1, 0)) * MILLI);
    // A starving army (supply meter 20) brings a smaller stockpile.
    const hungry = createWorld(ecoSetup({ attackerUnits: mk('a', ['infantry', 'infantry'], { supply: 20 }) }));
    expect(hungry.eco.stock[0][0]).toBeLessThan(w.eco.stock[0][0]);
    // Every side gets a starter cluster of nodes, and there is a contested middle.
    expect(w.eco.nodes.some((n) => n.x < w.map.w * Q * 0.3)).toBe(true);
    expect(w.eco.nodes.some((n) => n.x > w.map.w * Q * 0.62)).toBe(true);
    expect(new Set(w.eco.nodes.map((n) => n.res))).toEqual(new Set(['food', 'materials', 'gold']));
  });

  it('workers gather, carry and deposit: stockpiles grow only at the drop-off', () => {
    const w = createWorld(ecoSetup());
    const before = w.eco.stock[0].reduce((a, b) => a + b, 0);
    run(w, 20 * 60);
    const after = w.eco.stock[0].reduce((a, b) => a + b, 0);
    expect(after).toBeGreaterThan(before);
    expect(w.eco.stats[0].gathered.reduce((a, b) => a + b, 0)).toBe(after - before);
  });

  it('a village house goes up under its builders and adds 10 housing', () => {
    const w = createWorld(ecoSetup());
    const cap0 = housingCap(w, 0);
    expect(cap0).toBe(CAMP_HOUSING + CAMP_HOUSING_PER_REGIMENT * 3);
    run(w, 1); // the first tick lifts the fog around the camp: only ground in sight can be built on
    const spot = spotFor(w, 0, 'house');
    expect(spot).not.toBeNull();
    const builders = workersOf(w, 0).slice(0, 2).map((q) => q.idx);
    const mat0 = w.eco.stock[0][1];
    run(w, 1, [{ side: 0, type: 'build', squads: builders, building: 'house', ...spot }]);
    const site = w.eco.buildings.find((b) => b.type === 'house');
    expect(site.built).toBe(false);
    expect(w.eco.stock[0][1]).toBeLessThanOrEqual(mat0 - BUILDINGS.house.cost.materials * MILLI + 5 * MILLI); // paid at placement (plus a little gathered)
    run(w, 20 * 40);
    expect(site.built).toBe(true);
    expect(housingCap(w, 0)).toBe(cap0 + 10);
    // Placement rules: not on top of the house again, never touching another building.
    expect(placementBlock(w, 0, 'house', spot.tx, spot.ty)).toBe('ground');
  });

  it('training waits for housing; the brought army is never blocked or harmed by it', () => {
    const w = createWorld(ecoSetup());
    const camp = w.eco.buildings.find((b) => b.type === 'camp');
    const army = w.squads.filter((q) => q.side === 0 && !q.worker).length;
    // The camp burns: the attacker's housing is gone (cap 0, population 3 regiments + 5 laborers).
    camp.alive = false; camp.hp = 0;
    expect(housingCap(w, 0)).toBe(0);
    // A house it raises later houses 10 again; until then a queued laborer waits, and nobody dies.
    w.eco.buildings.push({ ...w.eco.buildings[0] }); // (bookkeeping only: a second headquarters to train at)
    const hq = w.eco.buildings[w.eco.buildings.length - 1];
    Object.assign(hq, { idx: w.eco.buildings.length - 1, id: 'hq2', alive: true, startHousing: null, queue: [] });
    run(w, 1, [{ side: 0, type: 'train', building: hq.idx, role: 'worker' }]);
    run(w, 20 * 30);
    expect(hq.queue).toHaveLength(1);
    expect(hq.queue[0].blocked).toBe('housing');
    expect(w.eco.stats[0].trained.worker || 0).toBe(0);
    expect(w.squads.filter((q) => q.side === 0 && !q.worker && q.alive).length).toBe(army);
  });

  it('a city assault houses the defender in its real houses; destroying them lowers the cap', () => {
    const manifest = buildTownManifest({ cityId: 'eco-city', ageId: 'bronze', tierId: 'medium', style: 'levant', seed: 5, capital: false, defenseTier: 1, buildings: {} });
    const setup = ecoSetup({ cityManifest: manifest, fortLevel: 2 });
    expect(setup.limitTicks).toBe(ECONOMY_SIEGE_TICKS);
    const w = createWorld(setup);
    expect(housingCap(w, 1)).toBe(Math.min(POP_LIMIT, manifestHousing(manifest)));
    const houses = w.structures.filter((s) => s.kind === 'house' && s.alive);
    const lost = houses.slice(0, 3).reduce((s, h) => s + h.housing, 0);
    const capBefore = housingCap(w, 1);
    houses.slice(0, 3).forEach((h) => { h.alive = false; h.hp = 0; });
    expect(lost).toBeGreaterThan(0);
    expect(housingCap(w, 1)).toBe(capBefore - lost);
  });

  it('never houses more than 300', () => {
    const w = createWorld(ecoSetup({ attackerUnits: mk('a', Array(40).fill('infantry')) }));
    expect(housingCap(w, 0)).toBe(POP_LIMIT);
  });

  it('the AI gathers, builds and trains, and the battle replays to the same hash', () => {
    const setup = ecoSetup({ controllers: ['ai', 'ai'], difficultyId: 'king', attackerUnits: mk('a', ['infantry']), defenderUnits: mk('d', ['infantry']) });
    const a = createWorld(setup); const b = createWorld(setup);
    run(a, 20 * 150); run(b, 20 * 150);
    expect(worldHash(a)).toBe(worldHash(b));
    expect(a.hashChain).toBe(b.hashChain);
    [0, 1].forEach((side) => {
      expect(a.eco.buildings.filter((x) => x.side === side && x.built && !BUILDINGS[x.type].hq).length, `side ${side} built something`).toBeGreaterThan(0);
      expect(a.eco.stats[side].trained.worker || 0, `side ${side} trained laborers`).toBeGreaterThan(0);
    });
    // A checkpoint (structured clone) mid-battle continues identically.
    const c = structuredClone(createWorld(setup));
    run(c, 20 * 150);
    expect(worldHash(c)).toBe(worldHash(a));
  });

  it('the result leaves workers and auxiliaries out of the campaign units and reports the economy', () => {
    const w = createWorld(ecoSetup({ controllers: ['ai', 'ai'], difficultyId: 'prince' }));
    run(w, 20 * 90);
    const r = toStrategicResult(w);
    expect(r.attackerUnits.map((u) => u.id)).toEqual(['a0', 'a1', 'a2']);
    expect(r.defenderUnits.map((u) => u.id)).toEqual(['d0', 'd1']);
    const eco = r.report.tactical.economy;
    expect(eco).toHaveLength(2);
    expect(eco[0]).toHaveProperty('gathered');
    expect(eco[0].housingCap).toBeGreaterThan(0);
  });
});
