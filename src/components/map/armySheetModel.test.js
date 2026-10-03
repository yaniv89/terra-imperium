import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import { armySheetModel, stackOn, attackTargets, siegePressed } from './armySheetModel';
import { getTiles } from '../../data/geo/tiles';

describe('army sheet model', () => {
  it('groups the stack on a tile by army, reads supply and route, and renaming tags every unit', () => {
    let s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const cap = s.regions[getNationCapital('fr')];
    const mine = Object.values(s.units).filter((u) => u.ownerId === 'fr' && u.domain === 'land' && u.regionId === cap.id);
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
    expect(armySheetModel(walking, cap.tile).route.turns).toBe(2);
    expect(armySheetModel(s, 0)).toBeNull();
  });
  it('shows promotions once a unit has earned a rank and the free generals to assign', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const cap = s.regions[getNationCapital('fr')];
    const id = stackOn(s, cap.tile)[0].id;
    const fresh = armySheetModel(s, cap.tile).groups[0].units.find((u) => u.id === id);
    expect(fresh.rank).toBe('recruit');
    expect(fresh.perks).toEqual([]);
    const veteran = { ...s, units: { ...s.units, [id]: { ...s.units[id], xp: 60 } }, hiredCommanders: { g1: { id: 'g1', name: 'Ney', nationId: 'fr', personality: 'bold' } } };
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
    const base = createInitialState({ playerNationId: 'in', rngSeed: 3 });
    const tiles = getTiles();
    const IN = getNationCapital('in'); const PK = getNationCapital('pk');
    const s0 = { ...base, units: {}, resources: { ...base.resources, mil: 100, gold: 1000 } };
    const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
    // Two adjacent free land tiles near Delhi: ours and theirs.
    const seen = new Set([s0.regions[IN].tile]); let f = [s0.regions[IN].tile]; let pair = null;
    for (let d = 0; d < 8 && !pair; d++) { const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } })); f = n.sort((a, b) => a - b); for (const t of f) { if (tiles.land[t] !== 1 || s0.world.tileOwner[t]) continue; const o = tiles.neighbors[t].find((x) => tiles.land[x] === 1 && !s0.world.tileOwner[x] && x !== t); if (o != null) { pair = [t, o]; break; } } }
    const [ours, theirs] = pair;
    const peace = { ...s0, units: { a: unit('a', IN, { tile: ours }), e: unit('e', PK, { ownerId: 'pk', tile: theirs }) } };
    expect(attackTargets(peace, ours, [peace.units.a])).toEqual([]); // not at war: nothing to attack
    const war = { ...peace, wars: [...peace.wars, { id: 'w', aggressor: 'in', enemy: 'pk', active: true, startYear: peace.year, battleScore: 0 }], nations: { ...peace.nations, in: { ...peace.nations.in, isAtWar: true }, pk: { ...peace.nations.pk, isAtWar: true } } };
    const m = armySheetModel(war, ours);
    expect(m.targets).toEqual([{ kind: 'army', tile: theirs, regionId: null, name: `${war.nations.pk.name} army`, owner: war.nations.pk.name, strength: 1000, ok: true, reason: null }]);
    const spent = { ...war, units: { ...war.units, a: { ...war.units.a, movesLeft: 0 } } };
    expect(attackTargets(spent, ours, [spent.units.a])[0]).toMatchObject({ ok: false, reason: 'no moves left' });
    // Beside the enemy capital: an assault target and a siege.
    const ring = tiles.neighbors[s0.regions[PK].tile].find((t) => tiles.land[t] === 1);
    const siege = { ...war, units: { a: unit('a', IN, { tile: ring, regionId: IN }), g: unit('g', PK, { ownerId: 'pk', tile: s0.regions[PK].tile }) } };
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
