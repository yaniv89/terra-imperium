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
import { housingCap, placementBlock, START_WORKERS, repairPerHp, ecoView, workCodes, workJobOf, workNodeOf, WORK_JOB } from './economy';
import { BUILDINGS, MILLI, RES_INDEX, POP_LIMIT, CAMP_HOUSING, CAMP_HOUSING_PER_REGIMENT, START_STOCK, stockMult, TREE_WOOD, woodSlots } from '../data/economy';
import { TILE } from '../setup/mapgen';
import { SCATTER_SLIP, SCATTER_HQ_GAP } from '../setup/economySetup';
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
    expect(new Set(w.eco.nodes.map((n) => n.res))).toEqual(new Set(['food', 'wood', 'stone', 'gold']));
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
    const wood0 = w.eco.stock[0][RES_INDEX.wood];
    run(w, 1, [{ side: 0, type: 'build', squads: builders, building: 'house', ...spot }]);
    const site = w.eco.buildings.find((b) => b.type === 'house');
    expect(site.built).toBe(false);
    expect(w.eco.stock[0][RES_INDEX.wood]).toBeLessThanOrEqual(wood0 - BUILDINGS.house.cost.wood * MILLI + 5 * MILLI); // paid at placement (plus a little gathered)
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

  it('U01: four stocks; stone is gathered at a stone node, dropped at the camp and spent on a tower; no ore', () => {
    const w = createWorld(ecoSetup());
    expect(w.eco.stock[0]).toHaveLength(4);
    expect(w.eco.nodes.some((n) => n.kind === 'ore')).toBe(false);
    expect(w.eco.nodes.filter((n) => n.res === 'stone').length).toBeGreaterThanOrEqual(4); // two a side at least
    run(w, 1);
    const stone = w.eco.nodes.findIndex((n) => n.kind === 'stone' && n.x < w.map.w * Q * 0.3);
    const hands = workersOf(w, 0).map((q) => q.idx);
    const s0 = w.eco.stock[0][RES_INDEX.stone];
    run(w, 20 * 60, [{ side: 0, type: 'gather', squads: hands, node: stone }]);
    const s1 = w.eco.stock[0][RES_INDEX.stone];
    expect(s1).toBeGreaterThan(s0);
    expect(w.eco.stats[0].gathered[RES_INDEX.stone]).toBe(s1 - s0);
    // a tower costs stone, paid when its site is placed
    const spot = spotFor(w, 0, 'tower');
    run(w, 1, [{ side: 0, type: 'build', squads: hands.slice(0, 1), building: 'tower', ...spot }]);
    expect(w.eco.buildings.some((b) => b.type === 'tower')).toBe(true);
    expect(w.eco.stats[0].spent[RES_INDEX.stone]).toBe(BUILDINGS.tower.cost.stone * MILLI);
  });

  it('U01: mending the city costs stone; an economy building its wood and stone', () => {
    expect(repairPerHp({ eco: false })).toEqual([0, 0, 100, 0]);
    const tower = repairPerHp({ eco: true, type: 'tower', maxHp: BUILDINGS.tower.hp });
    expect(tower[RES_INDEX.stone]).toBeGreaterThan(0);
    expect(tower[RES_INDEX.wood]).toBeGreaterThan(0);
    expect(repairPerHp({ eco: true, type: 'barracks', maxHp: BUILDINGS.barracks.hp })).toEqual([0, 125, 0, 0]);
  });

  it('X28, X31: the view says what each laborer carries, and a spent grove stays as stumps', () => {
    const w = createWorld(ecoSetup());
    let carrying = null;
    for (let t = 0; t < 20 * 40 && !carrying; t++) { run(w, 1); const v = ecoView(w, 0); if (v.carrying.some((c) => c.load > 0)) carrying = v.carrying; }
    const c = carrying.find((x) => x.load > 0);
    expect(c).toMatchObject({ idx: expect.any(Number), res: expect.stringMatching(/^(food|wood|stone|gold)$/), kind: expect.any(String) });
    const grove = w.eco.nodes.findIndex((n) => n.kind === 'tree');
    w.eco.nodes[grove].amount = 0;
    const v = ecoView(w, 0);
    expect(v.nodes.find((n) => n.i === grove)).toMatchObject({ spent: true, amount: 0 });
  });

  it('W12: every forest tile of the field is a tree of one wood node, TREE_WOOD each', () => {
    ['forest', 'plains', 'mixed'].forEach((terrain) => {
      const setup = ecoSetup({ terrain, regionId: `w12-${terrain}` });
      const { map } = setup;
      const owner = new Int32Array(map.w * map.h).fill(-1);
      setup.economy.nodes.forEach((n, i) => (n.trees || []).forEach((t) => { expect(owner[t]).toBe(-1); owner[t] = i; }));
      const city = new Set([...(setup.structures || []).flatMap((s) => s.footprint || []), ...setup.economy.camp.footprint]);
      for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
        const i = y * map.w + x;
        if (map.tiles[i] === TILE.FOREST && !city.has(i)) expect(owner[i], `${terrain} ${x},${y}`).toBeGreaterThanOrEqual(0);
      }
      setup.economy.nodes.filter((n) => n.trees).forEach((n) => {
        expect(n.amount).toBe(n.trees.length * TREE_WOOD * MILLI);
        expect(n.tile).toBe(n.trees[0]);
        expect(n.slots).toBe(woodSlots(n.trees.length));
      });
    });
  });

  it('W12: laborers fell a wood tree by tree; the node walks on to the next tree and the view says how many are down', () => {
    const w = createWorld(ecoSetup({ terrain: 'forest', regionId: 'w12-fell' }));
    const camp = w.eco.buildings.find((b) => b.type === 'camp');
    let best = -1; let bestD = Infinity;
    w.eco.nodes.forEach((n, i) => { if (n.trees?.length >= 3) { const d = (n.x - camp.x) ** 2 + (n.y - camp.y) ** 2; if (d < bestD) { bestD = d; best = i; } } });
    const n = w.eco.nodes[best];
    const first = n.trees[0];
    run(w, 20 * 200, [{ side: 0, type: 'gather', squads: workersOf(w, 0).map((q) => q.idx), node: best }]);
    expect(n.cut).toBeGreaterThan(0);
    expect(n.cut).toBe(Math.floor((n.max - n.amount) / (TREE_WOOD * MILLI)));
    expect(n.tile).toBe(n.trees[Math.min(n.cut, n.trees.length - 1)]);
    expect(n.tile).not.toBe(first);
    expect(w.eco.stats[0].gathered[RES_INDEX.wood]).toBeGreaterThan(0);
    const v = ecoView(w, 0).nodes.find((x) => x.i === best);
    expect(v).toMatchObject({ cut: n.cut, trees: n.trees.length });
  });

  it('W12: scattered nodes come in mirrored pairs, kept away from both headquarters', () => {
    ['mixed', 'hills', 'desert', 'forest'].forEach((terrain) => {
      const setup = ecoSetup({ terrain, regionId: `w12-scatter-${terrain}` });
      const { w: mw } = setup.map;
      const sc = setup.economy.nodes.filter((n) => n.scattered && n.kind !== 'fish');
      expect(sc.length, terrain).toBeGreaterThanOrEqual(8);
      const west = sc.filter((n) => n.x / Q < mw / 2); const east = sc.filter((n) => n.x / Q >= mw / 2);
      expect(west.length).toBe(east.length);
      west.forEach((n) => {
        const mx = mw - 1 - Math.floor(n.x / Q); const my = Math.floor(n.y / Q);
        expect(east.some((e) => e.kind === n.kind && Math.abs(Math.floor(e.x / Q) - mx) <= SCATTER_SLIP && Math.abs(Math.floor(e.y / Q) - my) <= SCATTER_SLIP), `${terrain} ${n.kind}`).toBe(true);
      });
      const hqs = [{ x: setup.economy.camp.x, y: setup.economy.camp.y }, { x: setup.map.keep.x * Q, y: setup.map.keep.y * Q }];
      setup.economy.nodes.filter((n) => n.scattered).forEach((n) => hqs.forEach((h) => expect(Math.hypot(n.x - h.x, n.y - h.y) / Q).toBeGreaterThan(SCATTER_HQ_GAP - 3)));
    });
  });

  it('I219: work codes say what each laborer does, from both sides; deposits are dated; the hash never sees either', () => {
    const w = createWorld(ecoSetup({ controllers: ['ai', 'ai'], difficultyId: 'king' }));
    const seen = { 0: new Set(), 1: new Set() }; const kinds = new Set();
    let deposits = 0;
    for (let t = 0; t < 20 * 60; t++) {
      run(w, 1);
      const codes = workCodes(w);
      w.squads.forEach((q, i) => {
        if (!q.worker) { expect(codes[i]).toBe(0); return; }
        if (!codes[i]) return;
        seen[q.side].add(workJobOf(codes[i]));
        if (workNodeOf(codes[i])) kinds.add(workNodeOf(codes[i]));
        if (workJobOf(codes[i]) === WORK_JOB.gathering) expect(q.job.phase).toBe(1);
        if (q.lastDepositTick === w.tick - 1) deposits += 1; // step() moves the tick on after the economy
      });
    }
    [0, 1].forEach((side) => [WORK_JOB.toNode, WORK_JOB.gathering, WORK_JOB.hauling].forEach((j) => expect(seen[side].has(j), `side ${side} job ${j}`).toBe(true)));
    expect(deposits).toBeGreaterThan(0);
    expect(kinds.size).toBeGreaterThan(1);
    // drawing-only fields: rewriting them changes nothing the hash folds in
    const h = worldHash(w);
    w.squads.forEach((q) => { q.lastDepositTick = -1234; });
    workCodes(w);
    expect(worldHash(w)).toBe(h);
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
