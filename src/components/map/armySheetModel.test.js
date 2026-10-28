import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../engine/gameReducer';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';
import { ActionTypes } from '../../data/types';
import { armySheetModel, stackOn, attackTargets, siegePressed, supplyState } from './armySheetModel';
import { getTiles } from '../../data/geo/tiles';

describe('army sheet model', () => {
  it('finds an army crossing water on its own boats on its sea tile', () => {
    const s = peoplesWorld({ seed: 7 });
    const me = s.playerNationId;
    const u = Object.values(s.units).find((x) => x.ownerId === me && x.domain === 'land' && x.classId !== 'settler');
    const sea = getTiles().land.findIndex((v) => v !== 1);
    const at = { ...s, units: { ...s.units, [u.id]: { ...u, tile: sea, embarkedOn: u.id, route: [sea] } } };
    expect(stackOn(at, sea).map((x) => x.id)).toEqual([u.id]);
    expect(armySheetModel(at, sea)).not.toBeNull();
  });

  it('groups the stack on a tile by army, reads supply and route, and renaming tags every unit', () => {
    let s = peoplesWorld({ seed: 7 });
    const me = s.playerNationId;
    const cap = s.regions[s.nations[me].capitalRegionId];
    const mine = Object.values(s.units).filter((u) => u.ownerId === me && u.domain === 'land' && u.regionId === cap.id);
    expect(mine.length).toBeGreaterThan(0);
    const m = armySheetModel(s, cap.tile);
    expect(m).not.toBeNull();
    expect(stackOn(s, cap.tile).map((u) => u.id)).toEqual(m.unitIds);
    expect(m.groups[0].name).toBe('Unassigned units');
    expect(m.zone).toBe('home');
    expect(m.zoneText).toMatch(/^Supply \d+\/\d+, \+\d+ a turn\. /); // the readable report (plans/playtest-1.md P2.2)
    expect(m.supplyReport.zone).toBe('home'); expect(m.fortified).toBe(false); expect(Array.isArray(m.mergeFrom)).toBe(true);
    expect(m.route).toBeNull();
    expect(m.soldiers).toBe(mine.reduce((x, u) => x + u.strength, 0));
    m.groups[0].units.forEach((u) => { expect(u.supply).toBeGreaterThan(0); expect(u.movePoints).toBeGreaterThan(0); });
    s = gameReducer(s, { type: ActionTypes.RENAME_ARMY, payload: { unitIds: m.unitIds, name: 'Old Guard' } });
    const named = armySheetModel(s, cap.tile);
    expect(named.groups).toHaveLength(1);
    expect(named.groups[0].name).toBe('Old Guard');
    m.unitIds.forEach((id) => expect(s.units[id].army.name).toBe('Old Guard'));
    expect(gameReducer(s, { type: ActionTypes.RENAME_ARMY, payload: { unitIds: m.unitIds, name: '  ' } })).toBe(s);
    const walking = { ...s, units: { ...s.units, [m.unitIds[0]]: { ...s.units[m.unitIds[0]], route: [1, 2, 3, 4], routePace: 2 } } };
    expect(armySheetModel(walking, cap.tile).route.turns).toBe(3); // tiles 1 to 4 are sea: 3 to embark, then 1 a step, at 2 a turn
    expect(armySheetModel(s, 0)).toBeNull();
  });
  it('a stack out in the wild says how long its supplies last and offers one tap back to land that refills them', () => {
    let s = peoplesWorld({ seed: 7 });
    const me = s.playerNationId; const tiles = getTiles();
    const cap = s.regions[s.nations[me].capitalRegionId];
    const own = (t) => s.regions[s.world.tileOwner[t]]?.owner === me;
    // a free land tile a few rings out from the capital
    let ring = [cap.tile]; const seen = new Set(ring); let wild = null;
    for (let d = 0; d < 12 && wild == null; d++) {
      ring = ring.flatMap((t) => tiles.neighbors[t]).filter((t) => !seen.has(t) && seen.add(t) && tiles.land[t]);
      wild = ring.find((t) => s.world.tileOwner[t] == null) ?? null;
    }
    expect(wild).not.toBeNull();
    const id = stackOn(s, cap.tile)[0].id;
    s = { ...s, units: { ...s.units, [id]: { ...s.units[id], tile: wild, supply: 25, movesLeft: 1, route: null } } };
    const m = armySheetModel(s, wild);
    expect(m.supplyState.kind).toBe('drain');
    expect(m.supplyState.label).toMatch(/^Supplies for \d+ more turns?$/);
    expect(m.resupply).not.toBeNull();
    expect(own(m.resupply.tile)).toBe(true);
    expect(m.resupply.turns).toBeGreaterThanOrEqual(1);
    // the tap is a real march order home
    const marched = gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: m.regionId, ...(typeof m.resupply.target === 'number' ? { toTile: m.resupply.target } : { toRegionId: m.resupply.target }), unitIds: m.unitIds } });
    const after = marched.units[id];
    expect(after.route?.length > 0 || own(after.tile)).toBe(true);
    // starving: the red state; at home: nothing to go back to
    const starving = armySheetModel({ ...s, units: { ...s.units, [id]: { ...s.units[id], supply: 0 } } }, wild);
    expect(starving.supplyState.kind).toBe('starving');
    expect(starving.resupply).not.toBeNull();
    expect(armySheetModel(peoplesWorld({ seed: 7 }), cap.tile).resupply).toBeNull();
    expect(supplyState(null)).toBeNull();
  });
  it('shows promotions once a unit has earned a rank and the free generals to assign', () => {
    const s = peoplesWorld({ seed: 7 });
    const me = s.playerNationId;
    const cap = s.regions[s.nations[me].capitalRegionId];
    const id = stackOn(s, cap.tile)[0].id;
    const fresh = armySheetModel(s, cap.tile).groups[0].units.find((u) => u.id === id);
    expect(fresh.rank).toBe('recruit');
    expect(fresh.perks).toEqual([]);
    const veteran = { ...s, units: { ...s.units, [id]: { ...s.units[id], xp: 60 } }, hiredCommanders: { g1: { id: 'g1', name: 'Ney', nationId: me, personality: 'bold' } } };
    const m = armySheetModel(veteran, cap.tile);
    const row = m.groups[0].units.find((u) => u.id === id);
    expect(row.rank).toBe('regular');
    expect(row.perks.length).toBeGreaterThan(0);
    expect(m.generals).toEqual([{ id: 'g1', name: 'Ney' }]);
    const promoted = gameReducer(veteran, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId: id, perkId: row.perks[0].id } });
    expect(armySheetModel(promoted, cap.tile).groups[0].units.find((u) => u.id === id).perks).toEqual([]);
    const led = gameReducer(veteran, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId: 'g1', unitId: id } });
    const ledModel = armySheetModel(led, cap.tile);
    expect(ledModel.groups[0].units.find((u) => u.id === id).general).toBe('Ney');
    expect(ledModel.generals).toEqual([]);
  });
  it('lists what the stack can attack from its tile, with the reason when it cannot, and the siege it presses', () => {
    const base = peoplesWorld({ seed: 3 });
    const me = base.playerNationId; const foe = rivalOf(base);
    const tiles = getTiles();
    const IN = base.nations[me].capitalRegionId; const PK = base.nations[foe].capitalRegionId;
    const s0 = { ...base, units: {}, resources: { ...base.resources, mil: 100, gold: 1000 } };
    const unit = (id, regionId, extra = {}) => ({ id, ownerId: me, regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
    // Two adjacent free land tiles near our capital: ours and theirs.
    const seen = new Set([s0.regions[IN].tile]); let f = [s0.regions[IN].tile]; let pair = null;
    for (let d = 0; d < 8 && !pair; d++) { const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } })); f = n.sort((a, b) => a - b); for (const t of f) { if (tiles.land[t] !== 1 || s0.world.tileOwner[t]) continue; const o = tiles.neighbors[t].find((x) => tiles.land[x] === 1 && !s0.world.tileOwner[x] && x !== t); if (o != null) { pair = [t, o]; break; } } }
    const [ours, theirs] = pair;
    const peace = { ...s0, units: { a: unit('a', IN, { tile: ours }), e: unit('e', PK, { ownerId: foe, tile: theirs }) } };
    expect(attackTargets(peace, ours, [peace.units.a])).toEqual([]); // not at war: nothing to attack
    const war = { ...peace, wars: [...peace.wars, { id: 'w', aggressor: me, enemy: foe, active: true, startYear: peace.year, battleScore: 0 }], nations: { ...peace.nations, [me]: { ...peace.nations[me], isAtWar: true }, [foe]: { ...peace.nations[foe], isAtWar: true } } };
    const m = armySheetModel(war, ours);
    expect(m.targets).toEqual([{ kind: 'army', tile: theirs, regionId: null, name: `${war.nations[foe].name} army`, owner: war.nations[foe].name, strength: 1000, ok: true, reason: null }]);
    const spent = { ...war, units: { ...war.units, a: { ...war.units.a, movesLeft: 0 } } };
    expect(attackTargets(spent, ours, [spent.units.a])[0]).toMatchObject({ ok: false, reason: 'no moves left' });
    // Beside the enemy capital: an assault target and a siege.
    const ring = tiles.neighbors[s0.regions[PK].tile].find((t) => tiles.land[t] === 1);
    const siege = { ...war, units: { a: unit('a', IN, { tile: ring, regionId: IN }), g: unit('g', PK, { ownerId: foe, tile: s0.regions[PK].tile }) } };
    const t = attackTargets(siege, ring, [siege.units.a]).find((x) => x.kind === 'city');
    expect(t).toMatchObject({ regionId: PK, name: s0.regions[PK].name, strength: 1000 });
    expect(['ok', 'reason']).toContain(t.ok ? 'ok' : 'reason');
    const sp = siegePressed(siege, ring, [siege.units.a]);
    expect(sp).toMatchObject({ regionId: PK, name: s0.regions[PK].name, encircled: false });
    expect(sp.hp).toBe(sp.maxHp);
    expect(sp.strength).toBeGreaterThan(0);
    expect(siegePressed(war, ours, [war.units.a])).toBeNull();
  });
});
