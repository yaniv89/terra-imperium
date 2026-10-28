// Art-2 lane: a building that falls in view sinks into its wreck (collapseMatrix, COLLAPSE_S) with
// a dust cloud, and shots fly long enough to follow, trailing a streak at least SHOT_TRAIL_PX thick.
import { describe, it, expect } from 'vitest';
import { Group, Matrix4, Vector3 } from 'three';
import { collapseMatrix, COLLAPSE_S } from '../art/structureArt';
import { shotLife, shotTrail, SHOT_TRAIL_PX } from './BattleRenderer';
import { EconomyLayer } from './economyLayer';
import { createArtIndex } from '../art/artIndex';
import { parseKit } from '../art/kitLoader';
import { kitGlb, parseGlbBytes } from '../../components/map/closeView/glbFixture';
import { Q, TICK_HZ } from '../sim/constants';

describe('building collapse', () => {
  it('sinks the standing piece by its height, easing in, and leans it', () => {
    const m = new Matrix4().makeScale(2, 2, 2).setPosition(10, 1, 5);
    const at = (k) => new Vector3().setFromMatrixPosition(collapseMatrix(new Matrix4(), m, k, 4, 3));
    expect(at(0).toArray()).toEqual([10, 1, 5]);
    expect(at(0.5).y).toBeCloseTo(0, 5); // 1 - 4 * 0.25
    expect(at(1).y).toBeCloseTo(-3, 5);
    expect(at(1).x).toBeCloseTo(10, 5); // the base stays put while it leans
    const up = new Vector3(0, 1, 0).transformDirection(collapseMatrix(new Matrix4(), m, 1, 4, 3));
    expect(up.y).toBeLessThan(0.99);
  });

  it('a building that falls while watched sinks into its wreck for COLLAPSE_S, with dust; one dead at the start does not', async () => {
    const files = { 'battle/rts/rts-bronze.glb': [{ name: 'barracks', size: 1.2 }, { name: 'barracks-damaged', size: 1.2 }, { name: 'barracks-ruined', size: 1.2 }] };
    const load = async (url) => parseKit((await parseGlbBytes(kitGlb(files[url.replace('test://', '')]))).scene);
    const art = createArtIndex({ 'assets/battle/rts/rts-bronze.glb': 'test://battle/rts/rts-bronze.glb' });
    const fx = []; const sheets = new Set(['dust', 'debris', 'smoke']);
    const r = { scene: new Group(), track: (x) => x, heightAt: () => 0, camera: { zoom: 1 }, fx, fxSprites: { has: (k) => sheets.has(k) },
      setup: { terrain: 'plains', economy: {}, sides: [{ ageId: 'bronze', color: '#dc2626' }, { ageId: 'bronze', color: '#2563eb' }] } };
    const layer = new EconomyLayer(r, { art, load });
    layer.build();
    await Promise.all(layer.ready);
    const b = (idx, alive) => ({ idx, alive, side: 0, type: 'barracks', size: 3, x: (5 + idx * 10) * Q, y: 5 * Q, built: true, hp: alive ? 1200 : 0, maxHp: 1200, progress: 100 });
    layer.update({ tick: 0, eco: { nodes: [], buildings: [b(0, true), b(1, false)] } }, () => true);
    expect(layer.kits.stats().copies).toBe(2); // the standing barracks, the old wreck
    expect(fx.length).toBe(0);
    layer.update({ tick: 10, eco: { nodes: [], buildings: [b(0, false), b(1, false)] } }, () => true);
    expect(layer.kits.stats().copies).toBe(3); // two wrecks and the falling barracks
    expect(fx.map((f) => f.sheet).sort()).toEqual(['debris', 'dust', 'smoke']);
    layer.update({ tick: 10 + Math.ceil(COLLAPSE_S * TICK_HZ), eco: { nodes: [], buildings: [b(0, false), b(1, false)] } }, () => true);
    expect(layer.kits.stats().copies).toBe(2);
    layer.dispose();
  });
});

describe('shots', () => {
  it('fly longer the further they go, within a beat of the hit', () => {
    expect(shotLife(0)).toBeCloseTo(0.24);
    expect(shotLife(10)).toBeGreaterThan(shotLife(4));
    expect(shotLife(100)).toBe(0.7);
  });
  it('trail a streak that grows from the bow and is never thinner than SHOT_TRAIL_PX on screen', () => {
    expect(shotTrail(0, 10, 0.05)[0]).toBe(0);
    expect(shotTrail(1, 10, 0.05)[0]).toBeCloseTo(1.8);
    expect(shotTrail(0.5, 10, 0.1)[1]).toBeCloseTo(SHOT_TRAIL_PX * 0.1);
    expect(shotTrail(0.5, 10, 0.001)[1]).toBe(0.04);
  });
});
