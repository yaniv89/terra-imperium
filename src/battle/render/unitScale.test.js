// Foot and mounted figures at true size against each other, in every age (the "zoomed in, the
// spearmen are bigger than the horses" report). The art set (src/assets/units) is authored on one
// rig at one scale; preloadUnitModels bakes it through bakeOptionsFor and the renderer draws each
// class at MODEL_SCALE. Taking a man as 1.8 m, a horse must stand about 1.3 to 1.6 m at the withers
// (the art's horses are period horses, about 1.3 m) and a rider's head about 2.4 m off the ground.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { parseUnitModel } from './gltfUnitLoader';
import { bakeOptionsFor, findUnitModel, ART_UNIT_WORLD } from './unitModels';
import { MODEL_SCALE } from './soldierFactory';

const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
const bytes = (name) => { const b = readFileSync(`src/assets/units/${name}.glb`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

// Authored heights read off the rig: the top of the head (its skin: a crest or a hat would make a
// man of the plumed ages look taller than his horse is), the
// horse's back (Mount_Spine, without the team cloth that hangs above it), the lowest point.
const rigHeights = async (name) => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(bytes(name), '');
  gltf.scene.updateMatrixWorld(true);
  const out = { head: -Infinity, withers: -Infinity }; const v = new Vector3();
  gltf.scene.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    const g = m.geometry; const si = g.attributes.skinIndex; const sw = g.attributes.skinWeight;
    const mat = Array.isArray(m.material) ? '' : m.material.name;
    const team = /team/i.test(mat); const skin = /skin/i.test(mat);
    for (let i = 0; i < g.attributes.position.count; i++) {
      let best = 0; for (let q = 1; q < 4; q++) if (sw.getComponent(i, q) > sw.getComponent(i, best)) best = q;
      const bone = m.skeleton.bones[si.getComponent(i, best)].name;
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      if (bone === 'Head' && skin) out.head = Math.max(out.head, v.y); // the head itself, not a crest or a tall hat
      if (bone === 'Mount_Spine' && !team) out.withers = Math.max(out.withers, v.y);
    }
  });
  return out;
};

// World units per authored unit as the battle draws the figure: the bake's scale times MODEL_SCALE.
const drawnScale = async (ageId, key, classId) => {
  const model = findUnitModel(ageId, key);
  const { stats } = await parseUnitModel(bytes(`${ageId}-${key}`), bakeOptionsFor(ageId, key, classId, model));
  return stats.scale * (key === 'general' ? MODEL_SCALE.general : MODEL_SCALE[classId]);
};

describe('figure scale: men, horses and riders at true size', () => {
  it('draws every person-scale figure at the art set scale', async () => {
    for (const ageId of AGES) {
      expect(await drawnScale(ageId, 'infantry', 'infantry')).toBeCloseTo(ART_UNIT_WORLD, 3);
      // (the Modern raider is a technical, a vehicle fitted to its JSON height)
      if (ageId !== 'modern' && existsSync(`src/assets/units/${ageId}-raider.glb`)) expect(await drawnScale(ageId, 'raider', 'cavalry')).toBeCloseTo(ART_UNIT_WORLD, 3);
    }
  }, 60000);

  it('a man about 1.8 m, a horse about 1.3 to 1.6 m at the withers, a rider about 2.4 m, every age', async () => {
    const men = [];
    for (const ageId of AGES) {
      const man = (await rigHeights(`${ageId}-infantry`)).head * (await drawnScale(ageId, 'infantry', 'infantry'));
      men.push(man);
      const metres = 1.8 / man;
      if (ageId === 'modern') continue; // no horses: tanks, trucks and a technical
      // the age's horse and rider: its cavalry, or (Bronze: chariots) its mounted raider
      const key = ageId === 'bronze' ? 'raider' : 'cavalry';
      const rig = await rigHeights(`${ageId}-${key}`);
      const k = await drawnScale(ageId, key, 'cavalry');
      const withers = (ageId === 'bronze' ? (await rigHeights('bronze-general')).withers * (await drawnScale('bronze', 'general', 'cavalry')) : rig.withers * k) * metres;
      const rider = rig.head * k * metres;
      expect(withers, `${ageId} withers ${withers.toFixed(2)} m`).toBeGreaterThan(1.25);
      expect(withers, `${ageId} withers ${withers.toFixed(2)} m`).toBeLessThan(1.7);
      expect(rider, `${ageId} rider ${rider.toFixed(2)} m`).toBeGreaterThan(2.2);
      expect(rider, `${ageId} rider ${rider.toFixed(2)} m`).toBeLessThan(2.8);
      // a man on foot stands shoulder-high (about 80% of his height) to the horse's back or above it
      expect(withers / 1.8).toBeLessThan(0.95);
    }
    // the same man in every age (a crest or a tall hat aside): within 12% of each other
    expect(Math.max(...men) / Math.min(...men)).toBeLessThan(1.12);
  }, 60000);
});
