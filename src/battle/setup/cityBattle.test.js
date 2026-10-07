import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from './buildBattleSetup';
import { TILE, reachable, isPassable } from './mapgen';
import { buildTownManifest, manifestHousing } from '../../data/townLayout';
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { runHeadless } from '../sim/headless';
import { attackStructure } from '../sim/combat';
import { replaySegment } from '../sim/replay';
import { getFlowField, tileOf } from '../sim/pathing';
import { Q } from '../sim/constants';

const mk = (p, cls) => cls.map((c, i) => ({ id: `${p}${i}`, classId: c, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const manifest = buildTownManifest({ cityId: 'city-test', ageId: 'classical', tierId: 'medium', style: 'europe', seed: 4, defenseTier: 1, capital: true, buildings: { culture: 1, economy: 0 } });
const setup = (over = {}) => buildSetupFromArmies({
  regionId: 'city-test', terrain: 'plains', seed: 9, fortLevel: 2, isCapital: true,
  attackerUnits: mk('a', ['infantry', 'infantry', 'infantry', 'cavalry', 'ranged', 'siege']),
  defenderUnits: mk('d', ['infantry', 'ranged', 'infantry']),
  attackerAgeId: 'classical', defenderAgeId: 'classical', controllers: ['ai', 'ai'],
  cityManifest: manifest, ...over
});

describe('a city assault loads the real city (cityBattle.js)', () => {
  it('every manifest structure stands on the field exactly once, the keep first', () => {
    const s = setup();
    expect(s.battleType).toBe('assault');
    expect(s.structures[0]).toMatchObject({ kind: 'keep', manifestId: 'townhall' });
    const ids = s.structures.map((st) => st.manifestId).filter(Boolean).sort();
    expect(ids).toEqual(manifest.structures.map((st) => st.id).sort());
    expect(s.city.housingCap).toBe(manifestHousing(manifest));
  });

  it('houses and walls block the ground; the closed gate seals the ring, the main street runs to it', () => {
    const s = setup();
    const { map } = s;
    const house = s.structures.find((st) => st.kind === 'house');
    expect(house.footprint.length).toBeGreaterThan(0);
    house.footprint.forEach((c) => expect(map.tiles[c]).toBe(TILE.BUILDING));
    expect(s.structures.filter((st) => st.kind === 'wall').every((st) => st.footprint.length > 0)).toBe(true);
    const gate = s.structures.find((st) => st.kind === 'gate');
    expect(gate.footprint.length).toBeGreaterThan(0);
    gate.footprint.forEach((c) => expect(map.tiles[c]).toBe(TILE.GATE));
    // shut, nothing outside reaches the keep; with the gate open, the street does
    expect(reachable(map.tiles, map.w, map.h, 6, map.keep.y, map.keep.x - 2, map.keep.y)).toBe(false);
    const open = map.tiles.slice(); gate.footprint.forEach((c) => { open[c] = TILE.OPEN; });
    expect(reachable(open, map.w, map.h, 6, map.keep.y, map.keep.x - 2, map.keep.y)).toBe(true);
    // no two structures share a tile
    const all = s.structures.flatMap((st) => st.footprint || []);
    expect(new Set(all).size).toBe(all.length);
    // the gate faces the attacker (west of the keep)
    expect(s.structures.find((st) => st.kind === 'gate').x).toBeLessThan(s.structures[0].x);
  });

  it('a ruined house from an earlier battle is rubble with no HP; a damaged one starts at half', () => {
    const s = setup({ cityDamage: { ruined: { 'house-0': 5 }, damaged: { 'house-1': 2 } } });
    const h0 = s.structures.find((st) => st.manifestId === 'house-0');
    const h1 = s.structures.find((st) => st.manifestId === 'house-1');
    expect(h0).toMatchObject({ alive: false, hp: 0, ruinedAtStart: true });
    h0.footprint.forEach((c) => expect(s.map.tiles[c]).toBe(TILE.RUBBLE));
    expect(h1.hp).toBe(Math.round(h1.maxHp / 2));
    expect(s.city.housingCap).toBe(manifestHousing(manifest, { 'house-0': 1 }));
  });

  it('a house brought down turns to rubble, opens the path and is reported by manifest id', () => {
    const s = setup();
    const w = createWorld(s);
    const si = w.structures.findIndex((st) => st.kind === 'house');
    const house = w.structures[si];
    const cell = house.footprint[0];
    const before = getFlowField(w, cell);
    const attacker = w.squads.find((q) => q.side === 0);
    for (let k = 0; k < 400 && house.alive; k++) attackStructure(w, attacker, house);
    expect(house.alive).toBe(false);
    expect(w.map.tiles[cell]).toBe(TILE.RUBBLE);
    expect(s.map.tiles[cell]).toBe(TILE.BUILDING); // the setup itself is untouched (replays start clean)
    expect(isPassable(w.map.tiles[cell])).toBe(true);
    expect(getFlowField(w, cell)).not.toBe(before);
    expect(w.events.some((e) => e.type === 'collapsed')).toBe(true);
  });

  it('passive houses are never picked automatically; the battle ends and reports the city', () => {
    const { world, result } = runHeadless(setup());
    expect(world.ended).toBeTruthy();
    const report = result.report.tactical.cityDamage;
    expect(report).toBeDefined();
    const houses = new Set(manifest.structures.filter((st) => st.kind === 'house').map((st) => st.id));
    // nobody ordered an attack on a house: none fell to the AI
    expect(report.destroyed.filter((id) => houses.has(id))).toEqual([]);
  }, 60000);

  it('is deterministic and replays from a snapshot', () => {
    const a = runHeadless(setup());
    const b = runHeadless(setup());
    expect(a.chain).toBe(b.chain);
    const w = createWorld(setup());
    for (let t = 0; t < 400; t++) { step(w, []); w.events.length = 0; }
    const snap = structuredClone(w);
    const end = replaySegment(snap, [], Infinity);
    expect(end.chain).toBe(a.chain);
  }, 60000);

  it('the wall ring has no gap, not even a corner to squeeze through (every age and size)', () => {
    // a flood from inside the ring that may step diagonally past any corner never reaches the field
    const escapes = (map) => {
      const { w, h, tiles } = map; const seen = new Uint8Array(w * h); const stack = [map.keep.y * w + map.keep.x - 2]; seen[stack[0]] = 1;
      while (stack.length) {
        const i = stack.pop(); const x = i % w; const y = (i - x) / w;
        if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) return true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * w + x + dx; if (!seen[j] && isPassable(tiles[j])) { seen[j] = 1; stack.push(j); } }
      }
      return false;
    };
    ['bronze', 'classical', 'modern'].forEach((ageId) => ['small', 'medium', 'big'].forEach((tierId) => [1, 2].forEach((seed) => {
      const m = buildTownManifest({ cityId: `seal-${seed}`, ageId, tierId, style: 'europe', seed, defenseTier: 1 });
      const s = setup({ regionId: `seal-${ageId}-${tierId}-${seed}`, seed, cityManifest: m, attackerAgeId: ageId, defenderAgeId: ageId });
      expect(escapes(s.map)).toBe(false);
    })));
  });

  it('nobody walks through the walls: the attacker gets in only once the gate (or the ring) falls', () => {
    const w = createWorld(setup());
    const kx = w.structures[0].x; const ky = w.structures[0].y;
    const ringR = manifest.structures.filter((st) => st.kind === 'wall' || st.kind === 'gate').reduce((r, st) => Math.max(r, Math.hypot(st.x, st.z)), 0) * w.setup.city.scale;
    const ring = w.structures.filter((st) => st.kind === 'wall' || st.kind === 'gate' || (st.kind === 'tower' && st.footprint?.length));
    const gate = w.structures.find((st) => st.kind === 'gate');
    const inner = (ringR - 1.5) * Q;
    let insideWhileShut = 0; let insideAfter = 0;
    for (let t = 0; t < 4000 && !w.ended; t++) {
      step(w, []); w.events.length = 0;
      const shut = ring.every((st) => st.alive);
      w.squads.forEach((q) => {
        if (q.side !== 0 || !q.alive || !q.onField || q.stats.flying) return;
        if ((q.x - kx) ** 2 + (q.y - ky) ** 2 < inner * inner) { if (shut) insideWhileShut += 1; else insideAfter += 1; }
      });
    }
    expect(insideWhileShut).toBe(0);
    expect(gate.alive).toBe(false); // the attacker battered it down on its own
    expect(insideAfter).toBeGreaterThan(0);
  }, 60000);

  it('the gate is shut to the attacker and open to the defender', () => {
    const w = createWorld(setup({ controllers: ['player', 'player'] }));
    const gate = w.structures.find((st) => st.kind === 'gate');
    const kx = w.structures[0].x; const ky = w.structures[0].y;
    const att = w.squads.find((q) => q.side === 0 && q.onField && q.classId === 'infantry');
    const def = w.squads.find((q) => q.side === 1 && q.onField && q.classId === 'infantry');
    const outside = { x: gate.x - 6 * Q, y: gate.y };
    step(w, [{ side: 0, type: 'move', squads: [att.idx], x: kx - 3 * Q, y: ky }, { side: 1, type: 'move', squads: [def.idx], x: outside.x, y: outside.y }]);
    const gateEdge = Math.min(...gate.footprint.map((c) => c % w.map.w)) * Q; // the gate's outer tile column
    let attMaxX = 0; let defOut = Infinity;
    for (let t = 0; t < 1000; t++) {
      step(w, []); w.events.length = 0;
      attMaxX = Math.max(attMaxX, att.x); defOut = Math.min(defOut, Math.hypot(def.x - outside.x, def.y - outside.y));
    }
    expect(gate.alive).toBe(true); // a plain move order never batters it
    expect(attMaxX).toBeLessThan(gateEdge); // it reached the gate and stood there, outside
    expect(attMaxX).toBeGreaterThan(gateEdge - 2 * Q);
    expect(defOut).toBeLessThan(Q); // the defender walked out through it
  }, 60000);

  it('a squad standing on the keep line spawns on open ground', () => {
    const w = createWorld(setup());
    w.squads.filter((q) => q.onField).forEach((q) => expect(isPassable(w.map.tiles[tileOf(w.map, q.x, q.y)])).toBe(true));
    expect(Q).toBe(256);
  });
});
