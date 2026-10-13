import { describe, it, expect, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { attackStructure } from '../sim/combat';
import { applyEcoOrder, placementBlock, destroyEcoBuilding } from '../sim/economy';
import { makeRenderView } from '../render/view';
import { createViewPacker, createViewDecoder } from '../render/packedView';
import { Matrix4, Scene, Vector3 } from 'three';
import { createArtIndex } from './artIndex';
import { parseKit } from './kitLoader';
import { landingId, raidLandingRef, raidLandingPlacements, RaidLandingProps, RAID_LANDING_IDS } from './raidLandingProps';
import { TILE } from '../setup/mapgen';
import { Q } from '../sim/constants';
import { kitGlb, parseGlbBytes } from '../../components/map/closeView/glbFixture';

const index = (...ids) => createArtIndex(Object.fromEntries(ids.map((id) => [`../../assets/battle/props/${id}.glb`, `/props/${id}.glb`])));
const setup = (landing = false) => {
  const w = 40; const h = 20; const tiles = new Uint8Array(w * h).fill(TILE.OPEN);
  if (landing) for (let j = 0; j < h; j++) for (let i = 0; i < 5; i++) tiles[j * w + i] = TILE.WATER;
  return { map: { w, h, tiles, landing, attackerEdge: landing ? 5 : 1 }, sides: [{ ageId: 'classical', color: '#245ae9' }, { ageId: 'modern', color: '#ed4433' }], structures: [{ id: 'field', loot: true, category: 'fields' }, { id: 'depot', loot: true, category: 'depot' }] };
};
const structure = (id, alive) => ({ id, x: 20 * Q, y: 8 * Q, radius: Q, alive, hp: alive ? 1 : 0 });
const kit = async (ids) => parseKit((await parseGlbBytes(kitGlb(ids.map((name) => ({ name, size: 0.2 }))))).scene);
const renderer = (s = setup()) => ({ setup: s, scene: new Scene(), camera: { zoom: 1 }, track: (x) => x, heightAt: () => 0 });

describe('raid and landing delivery wiring', () => {
  it('resolves the exact six target files without cross-age substitution', () => {
    const art = index(...RAID_LANDING_IDS);
    RAID_LANDING_IDS.forEach((id) => expect(raidLandingRef(id, art)).toEqual({ id, key: `battle/props/${id}.glb`, url: `/props/${id}.glb` }));
    expect(raidLandingRef('props-bronze', art)).toBeNull();
    expect(raidLandingRef('landing-modern', index('landing-ancient'))).toBeNull();
    expect(['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'].map(landingId)).toEqual(['landing-ancient', 'landing-ancient', 'landing-middle', 'landing-middle', 'landing-modern']);
    expect(landingId('unknown')).toBeNull();
  });

  it('reads real destroyed field state and goods without changing snapshots', () => {
    const s = setup(); const view = { structures: [structure('field', true), structure('depot', false)], squads: [], eco: { buildings: [], carrying: [] } };
    const before = JSON.stringify({ s, view });
    const initial = raidLandingPlacements(s, view);
    expect(initial.filter((p) => p.id === 'burnt-field-overlay')).toHaveLength(0); // low HP is not destruction
    expect(initial.filter((p) => p.id === 'loot-sack')).toHaveLength(1);
    expect(JSON.stringify({ s, view })).toBe(before);
    expect(raidLandingPlacements(s, view)).toEqual(initial);
    view.structures = [structure('depot', false), structure('field', false)]; // metadata joined by id, not array index
    view.eco.buildings = [{ type: 'farm', x: 12 * Q, y: 12 * Q, size: 3, alive: false }, { type: 'farm', x: 10 * Q, y: 5 * Q, alive: true }];
    expect(raidLandingPlacements(s, view).filter((p) => p.id === 'burnt-field-overlay')).toHaveLength(2);
    expect(raidLandingPlacements(s, view).filter((p) => p.id === 'loot-sack')).toHaveLength(0);
  });


  it('keeps scorch geometry inside real field footprints on BUILDING tiles', async () => {
    const s = setup(); const cell = 8 * s.map.w + 20;
    s.map.tiles[cell] = TILE.BUILDING;
    s.structures[0].footprint = [cell];
    const view = { structures: [structure('field', false)] };
    const p = raidLandingPlacements(s, view).find((item) => item.id === 'burnt-field-overlay');
    expect(p).toMatchObject({ x: 20.5, z: 8.5, fieldSize: 1 });
    const k = await kit(['burnt-field-overlay']); const r = renderer(s);
    const layer = new RaidLandingProps(r, { art: index('burnt-field-overlay'), load: async () => k });
    await layer.ready; layer.update(view);
    const mesh = layer.instances.meshes.get(k.objects['burnt-field-overlay'].lods[0]).mesh;
    const matrix = new Matrix4(); mesh.getMatrixAt(0, matrix);
    const bounds = k.objects['burnt-field-overlay'].box.clone().applyMatrix4(matrix);
    expect(bounds.min.x).toBeCloseTo(20); expect(bounds.max.x).toBeCloseTo(21);
    expect(bounds.min.z).toBeCloseTo(8); expect(bounds.max.z).toBeCloseTo(9);
    layer.dispose();
    s.map.tiles[cell] = TILE.WATER;
    expect(raidLandingPlacements(s, view).some((item) => item.id === 'burnt-field-overlay')).toBe(false);
  });

  it('shows only actual visible carriers and never fabricates raider inventory', () => {
    const squads = Array.from({ length: 6 }, (_, idx) => ({ idx, side: 0, look: 'raider', x: 10 * Q, y: 10 * Q, facing: 0, alive: true, onField: true, visible: true, inside: -1 }));
    squads[1].visible = false; squads[2].hidden = true; squads[3].inside = 0; squads[4].fled = true;
    const view = { squads, eco: { carrying: [0, 1, 2, 3, 4] } };
    const goods = raidLandingPlacements(setup(), view).filter((p) => p.id === 'loot-sack');
    expect(goods).toHaveLength(1); expect(goods[0].x).toBe(9.8); expect(goods[0].lift).toBeGreaterThan(0);
  });

  it('aligns landing at the actual sea edge and skips naval maps', () => {
    const s = setup(true);
    const a = raidLandingPlacements(s);
    expect(a.find((p) => p.shore)).toMatchObject({ id: 'landing-ancient', x: 5, yaw: Math.PI / 2, side: 0 });
    s.map.tiles.fill(TILE.OPEN); expect(raidLandingPlacements(s).some((p) => p.shore)).toBe(false);
    s.map.naval = true; expect(raidLandingPlacements(s)).toEqual([]);
    expect(raidLandingPlacements(setup()).some((p) => p.shore)).toBe(false);
    const markers = raidLandingPlacements(setup()).filter((p) => p.id === 'exit-marker');
    expect(markers.map((p) => p.yaw)).toEqual([-Math.PI / 2, Math.PI / 2]);
  });

  it('instances three LODs, pins the shore socket and clears removed overlays', async () => {
    const k = await kit(RAID_LANDING_IDS); k.objects['landing-ancient'].sockets['socket-door'] = new Vector3(0, 0, 0.6);
    const r = renderer(setup(true)); const layer = new RaidLandingProps(r, { art: index(...RAID_LANDING_IDS), load: async () => k });
    await layer.ready;
    layer.update({ structures: [structure('field', false)] });
    expect(layer.instances.stats().copies).toBe(4); // two exits, one field, one landing
    const landing = layer.instances.meshes.get(k.objects['landing-ancient'].lods[0]);
    const m = new Matrix4(); landing.mesh.getMatrixAt(0, m);
    expect(new Vector3(0, 0, 0.6).applyMatrix4(m).x).toBeCloseTo(5);
    r.camera.zoom = 0.3; layer.update({ structures: [structure('field', true)] });
    expect(layer.instances.meshes.get(k.objects['landing-ancient'].lods[0]).mesh.visible).toBe(false);
    expect(layer.instances.meshes.get(k.objects['landing-ancient'].lods[2]).mesh.visible).toBe(true);
    expect(layer.instances.stats().copies).toBe(4); // goods replace scorch
    layer.dispose(); expect(r.scene.children).toHaveLength(0);
  });


  it('uses actual sim-generated plain and decoded snapshots for carriers and destroyed farms', () => {
    const mk = (id) => [{ id, classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, promotions: [], domain: 'land' }];
    const s = buildSetupFromArmies({ regionId: 'rlp-audit', terrain: 'plains', seed: 11, attackerUnits: mk('a'), defenderUnits: mk('d'), controllers: ['player', 'player'], intel: { attackerSeesDefender: true }, economy: true, battleType: 'field', powers: [[], []] });
    const w = createWorld(s); let carryingView;
    for (let t = 0; t < 500 && !carryingView; t++) {
      step(w, []);
      const v = makeRenderView(w, [], 0, false);
      if (v.eco.carrying.length) carryingView = v;
    }
    expect(carryingView).toBeTruthy();
    const carriers = carryingView.squads.filter((q) => carryingView.eco.carrying.includes(q.idx) && q.alive && q.onField && !q.fled && q.visible && !q.hidden && q.inside < 0);
    expect(carriers.length).toBeGreaterThan(0);
    expect(raidLandingPlacements(s, carryingView).filter((p) => p.lift)).toHaveLength(carriers.length);
    const camp = w.eco.buildings.find((b) => b.type === 'camp'); let spot;
    for (let r = 3; r < 18 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
      const tx = Math.floor(camp.x / Q) + dx; const ty = Math.floor(camp.y / Q) + dy;
      if (!placementBlock(w, 0, 'farm', tx, ty)) spot = { tx, ty };
    }
    expect(spot).toBeTruthy();
    applyEcoOrder(w, { side: 0, type: 'build', squads: w.squads.filter((q) => q.worker && q.side === 0).map((q) => q.idx), building: 'farm', ...spot });
    const farm = w.eco.buildings.find((b) => b.type === 'farm'); expect(farm).toBeTruthy();
    for (let t = 0; t < 1500 && !farm.built; t++) step(w, []);
    expect(farm.built).toBe(true);
    const intact = makeRenderView(w, [], 0, false);
    expect(raidLandingPlacements(s, intact).filter((p) => p.id === 'burnt-field-overlay')).toHaveLength(0);
    destroyEcoBuilding(w, farm, 1);
    const view = makeRenderView(w, [], 0, false);
    const decoded = createViewDecoder()(createViewPacker().pack(w, [], 0, { fog: false, slow: true }).packed);
    expect(raidLandingPlacements(s, decoded)).toEqual(raidLandingPlacements(s, view));
    const scorch = raidLandingPlacements(s, view).find((p) => p.id === 'burnt-field-overlay');
    expect(scorch).toMatchObject({ x: (spot.tx + farm.size / 2), z: (spot.ty + farm.size / 2), fieldSize: farm.size });
    const raidSetup = buildSetupFromArmies({ regionId: 'rlp-raid-audit', terrain: 'plains', seed: 11, attackerUnits: mk('ra'), defenderUnits: mk('rd'), controllers: ['player', 'player'], battleType: 'raid' });
    const raidWorld = createWorld(raidSetup);
    const raidView = makeRenderView(raidWorld, [], 0, false);
    const field = raidSetup.structures.find((b) => b.category === 'fields');
    expect(field).toBeTruthy();
    const snapshotField = raidView.structures.find((b) => b.id === field.id);
    expect(snapshotField.category).toBeUndefined(); expect(snapshotField.loot).toBeUndefined(); // metadata must join by id
    const target = raidWorld.structures.find((b) => b.id === field.id);
    const attacker = raidWorld.squads.find((q) => q.side === 0);
    for (let n = 0; n < 100 && target.alive; n++) attackStructure(raidWorld, attacker, target);
    expect(target.alive).toBe(false);
    const burntRaidView = makeRenderView(raidWorld, [], 0, false);
    const raidScorch = raidLandingPlacements(raidSetup, burntRaidView).find((p) => p.id === 'burnt-field-overlay');
    expect(raidScorch).toMatchObject({ x: target.x / Q, z: target.y / Q, fieldSize: 1 });
    if (process.env.RLP_SNAPSHOT_REPORT) writeFileSync(process.env.RLP_SNAPSHOT_REPORT, JSON.stringify({
      status: 'passed', source: 'createWorld + step + applyEcoOrder + destroyEcoBuilding + makeRenderView + packed view decoder',
      carry_tick: carryingView.tick, carrying: carryingView.eco.carrying, visible_carriers: carriers.map((q) => ({ idx: q.idx, x: q.x, y: q.y, facing: q.facing, onField: q.onField, visible: q.visible, inside: q.inside })),
      destroyed_farm: view.eco.buildings.find((b) => b.id === farm.id), scorch, packed_plain_placements_equal: true,
      field_metadata: field, actual_structure_snapshot: snapshotField, destroyed_raid_snapshot: burntRaidView.structures.find((b) => b.id === field.id), raid_scorch: raidScorch, raid_economy: burntRaidView.eco, no_sim_or_view_source_edits: true
    }, null, 2));
  });


  it('loads only exits in actual ordinary no-economy setups, and gates goods and landing textures', async () => {
    const units = (id) => [{ id, classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, promotions: [], domain: 'land' }];
    const build = (extra = {}) => buildSetupFromArmies({ regionId: 'rlp-load-audit', terrain: 'plains', seed: 11, attackerUnits: units('a'), defenderUnits: units('d'), ...extra });
    const art = index(...RAID_LANDING_IDS);
    const fetches = async (s) => {
      const load = vi.fn(async () => null); const layer = new RaidLandingProps(renderer(s), { art, load });
      await layer.ready; const urls = load.mock.calls.map(([url]) => url).sort(); layer.dispose(); return urls;
    };
    const normal = build();
    expect(normal.economy).toBeNull(); expect(normal.structures.some((s) => s.loot)).toBe(false);
    expect(await fetches(normal)).toEqual(['/props/exit-marker.glb']);
    const economy = build({ economy: true }); expect(typeof economy.economy).toBe('object'); expect(economy.economy.camp).toBeTruthy();
    const goods = ['/props/burnt-field-overlay.glb', '/props/exit-marker.glb', '/props/loot-sack.glb'];
    expect(await fetches(economy)).toEqual(goods);
    const raid = build({ battleType: 'raid' }); expect(raid.economy).toBeNull(); expect(raid.structures.some((s) => s.loot)).toBe(true);
    expect(await fetches(raid)).toEqual(goods);
    const landing = build({ landing: true });
    const expectedLanding = landingId(landing.sides[0].ageId);
    expect(await fetches(landing)).toEqual(['/props/exit-marker.glb', `/props/${expectedLanding}.glb`].sort());
    normal.map.naval = true; expect(await fetches(normal)).toEqual([]);
  });

  it('preserves missing-file fallback and does not resurrect after disposal', async () => {
    const load = vi.fn(); const a = new RaidLandingProps(renderer(), { art: index(), load });
    await a.ready; a.update({}); expect(load).not.toHaveBeenCalled(); expect(a.instances.stats().copies).toBe(0); a.dispose();
    let release; const pending = new Promise((resolve) => { release = resolve; });
    const b = new RaidLandingProps(renderer(), { art: index('exit-marker'), load: () => pending });
    b.dispose(); release(await kit(['exit-marker'])); await b.ready; b.update({});
    expect(b.objects.size).toBe(0); expect(b.instances.stats().copies).toBe(0);
  });
});
