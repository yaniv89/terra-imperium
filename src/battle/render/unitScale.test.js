// Foot and mounted figures at true size against each other, in every age (the "zoomed in, the
// spearmen are bigger than the horses" report). The art set (src/assets/units) is authored on one
// rig at one scale; preloadUnitModels bakes it through bakeOptionsFor and the renderer draws each
// class at MODEL_SCALE. Taking a man as 1.8 m, a horse must stand about 1.3 to 1.6 m at the withers
// (the art's horses are period horses, about 1.3 m) and a rider's head about 2.4 m off the ground.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { Vector3 } from 'three';
import { parseUnitModel } from './gltfUnitLoader';
import { bakeOptionsFor, findUnitModel, findSignatureModel, ART_UNIT_WORLD, footprintOf, machineLayout, MACHINE_BLOCK } from './unitModels';
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
      // (the Modern raider is a technical: a machine, checked with the machines below)
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

  it('polearms at true length: a spear 2.5 m, a pike 5 m, a lance 3.5 m', async () => {
    const metresOf = async (ageId, key, classId) => {
      const model = findUnitModel(ageId, key);
      const { geometry } = await parseUnitModel(bytes(`${ageId}-${key}`), bakeOptionsFor(ageId, key, classId, model));
      geometry.computeBoundingBox();
      const man = (await rigHeights(`${ageId}-infantry`)).head * (await drawnScale(ageId, 'infantry', 'infantry'));
      return (geometry.boundingBox.max.y * (key === 'general' ? MODEL_SCALE.general : MODEL_SCALE[classId]) * 1.8) / man;
    };
    // a spear or pike stands on the ground beside the man: its top is its length
    expect(await metresOf('bronze', 'infantry', 'infantry')).toBeCloseTo(2.5, 0);
    expect(Math.abs((await metresOf('kingdoms', 'infantry', 'infantry')) - 5)).toBeLessThan(0.3);
    // a lance is held from the rider's hand, about 1 to 1.4 m up
    for (const ageId of ['classical', 'kingdoms']) {
      const top = await metresOf(ageId, 'cavalry', 'cavalry');
      expect(top, `${ageId} lance top ${top.toFixed(2)} m`).toBeGreaterThan(3.5 + 0.8);
      expect(top, `${ageId} lance top ${top.toFixed(2)} m`).toBeLessThan(3.5 + 1.5);
    }
  }, 60000);

  it('the side colour is an accent: under a quarter of a figure, never the mount', async () => {
    const shareOf = (g) => {
      const p = g.attributes.position; const t = g.attributes.aTeam; const l = g.attributes.aLimb;
      const a = new Vector3(); const b = new Vector3(); const c = new Vector3();
      let team = 0; let all = 0; let horseTeam = 0;
      for (let k = 0; k < p.count; k += 3) {
        a.fromBufferAttribute(p, k); b.fromBufferAttribute(p, k + 1); c.fromBufferAttribute(p, k + 2);
        const area = b.sub(a).cross(c.sub(a)).length() / 2;
        all += area;
        if (t.getX(k) > 0.5) { team += area; if (l.getX(k) >= 5 && l.getX(k) <= 6) horseTeam += area; }
      }
      return { share: team / all, horseTeam };
    };
    for (const ageId of AGES) {
      for (const [key, classId] of [['infantry', 'infantry'], ['ranged', 'ranged'], ['cavalry', 'cavalry']]) {
        if (ageId === 'modern' && key === 'cavalry') continue; // a tank: its skirts and turret band
        const { geometry } = await parseUnitModel(bytes(`${ageId}-${key}`), bakeOptionsFor(ageId, key, classId, findUnitModel(ageId, key)));
        const { share, horseTeam } = shareOf(geometry);
        expect(share, `${ageId}-${key} team share ${share.toFixed(2)}`).toBeLessThan(0.25);
        expect(horseTeam, `${ageId}-${key} team on the horse`).toBe(0);
      }
    }
  }, 60000);
});

// Machines bigger, crews at the people's scale (manifest MD09, MD10: "only machines get bigger").
// A machine file is drawn at ART_UNIT_WORLD like the infantry beside it (no fitted height), its crew
// is authored at 1.0 and the machine at about TWO THIRDS of its real size against a 1.8 m man (the
// user's cap of 13 October: bigger than a man and than before, small enough for the 3 tiles between
// squads). Lengths and heights in metres: about 0.58 to 0.85 of the real machine.
const MACHINES = [
  // file, the key it registers under, its class, crew, [length], [height] of the machine alone
  { name: 'bronze-siege', key: 'siege', classId: 'siege', crew: 4, length: [3.5, 4.8], height: [1.5, 2.3] }, // covered ram: real 6 m, 2.5 to 3 m
  { name: 'classical-siege', key: 'siege', classId: 'siege', crew: 3, length: [1.8, 2.5], height: [1.1, 1.8] }, // ballista: real 3 m
  { name: 'kingdoms-siege', key: 'siege', classId: 'siege', crew: 3, length: [4.5, 6.5], height: [5.4, 6.8] }, // trebuchet: real 9 m high
  { name: 'gunpowder-siege', key: 'siege', classId: 'siege', crew: 3, length: [2.1, 2.9], height: [0.75, 1.1] }, // field gun: real 3.5 m, wheels 1.4 m
  { name: 'modern-siege', key: 'siege', classId: 'siege', crew: 3, length: [4.7, 6], height: [1.5, 3.2] }, // mid-century field howitzer: real about 7 m with its trails
  { name: 'modern-cavalry', key: 'cavalry', classId: 'cavalry', crew: 0, length: [3.8, 5.2], height: [1.6, 2.8] }, // mid-century medium tank: real about 6 m with the gun, 2.7 m to the cupola (aerial above)
  { name: 'modern-support', key: 'support', classId: 'support', crew: 1, length: [4.1, 5.4], height: [2.2, 3.8] }, // AA truck: a real 6 to 7 m lorry, the gun raised
  { name: 'modern-general', key: 'general', classId: 'cavalry', crew: 2, length: [2.2, 3], height: [1.5, 3.6] }, // command car: real 3.4 m, a whip mast
  { name: 'modern-raider', key: 'raider', classId: 'cavalry', crew: 1, length: [2.2, 3], height: [1.3, 2.2] }, // recon car: a real 3.4 m open car with a pintle gun
  // the present-day machines, renamed from modern-* (eight-ages plan U81)
  { name: 'information-siege', key: 'siege', classId: 'siege', crew: 3, length: [4.7, 6], height: [1.5, 3.2] }, // 155 mm howitzer: real 8 m with trails
  { name: 'information-cavalry', key: 'cavalry', classId: 'cavalry', crew: 0, length: [5.2, 7.2], height: [1.6, 2.8] }, // tank: real hull 7 m (9.5 m with the gun), 2.4 m to the roof (aerial above)
  { name: 'information-support', key: 'support', classId: 'support', crew: 1, length: [4.1, 5.4], height: [2.2, 3.8] }, // AA truck: real 7 m, guns raised
  { name: 'information-general', key: 'general', classId: 'cavalry', crew: 2, length: [2.2, 3], height: [1.5, 3.6] }, // command car: real 3.4 m, a whip mast
  { name: 'information-raider', key: 'raider', classId: 'cavalry', crew: 1, length: [3.1, 4.1], height: [1.3, 2.2] }, // technical: a real 5.3 m pickup
  // signature machines (a people's own unit in place of the base one)
  { name: 'signature/kingdom-of-israel', people: 'israel', ageId: 'modern', key: 'cavalry', classId: 'cavalry', crew: 0, length: [5.6, 7.6], height: [1.6, 2.9] }, // Merkava: real 7.6 m hull, 9 m with the gun
  { name: 'signature/marcomannia', people: 'marcomannia', ageId: 'modern', key: 'cavalry', classId: 'cavalry', crew: 0, length: [3, 4], height: [1.6, 2.9] }, // LT vz. 38: real 4.6 m, 2.4 m high (aerial above)
  { name: 'signature/bosporan-kingdom', people: 'bosporan_kingdom', ageId: 'classical', key: 'siege', classId: 'siege', crew: 3, length: [2.4, 3.4], height: [1.5, 2.3] }, // a stone-thrower: real about 4 m
  { name: 'signature/tondo', people: 'tondo', ageId: 'gunpowder', key: 'siege', classId: 'siege', crew: 3, length: [1.2, 2.2], height: [0.8, 1.5] } // a lantaka swivel gun on its rest: small in life too
];
// Camels and elephants (signature units): no fitted height either, the animal at its TRUE size (its
// back, metres), every rider and howdah crewman the infantryman's size.
const BEASTS = [
  { name: 'signature/saba', people: 'saba', ageId: 'classical', key: 'ranged', classId: 'ranged', crew: 1, back: [1.75, 2.1] }, // a dromedary: about 1.9 m at the hump
  { name: 'signature/qedar', people: 'qedar', ageId: 'classical', key: 'cavalry', classId: 'cavalry', crew: 1, back: [1.75, 2.1] },
  { name: 'signature/kindah', people: 'kindah', ageId: 'modern', key: 'infantry', classId: 'infantry', crew: 1, back: [1.75, 2.1] },
  { name: 'signature/magadha', people: 'magadha', ageId: 'classical', key: 'cavalry', classId: 'cavalry', crew: 3, back: [2.7, 3.3] }, // an Asian war elephant: 2.8 to 3 m at the shoulder
  { name: 'signature/kalinga', people: 'kalinga', ageId: 'classical', key: 'cavalry', classId: 'cavalry', crew: 3, back: [2.7, 3.3] },
  { name: 'signature/kamarupa', people: 'kamarupa', ageId: 'kingdoms', key: 'cavalry', classId: 'cavalry', crew: 3, back: [2.7, 3.3] },
  { name: 'signature/champa', people: 'champa', ageId: 'kingdoms', key: 'cavalry', classId: 'cavalry', crew: 3, back: [2.7, 3.3] }
];
const ageOf = (m) => m.ageId || m.name.split('-')[0];
const modelOf = (m) => (m.people ? findSignatureModel(m.people, m.ageId, m.classId) : findUnitModel(ageOf(m), m.key));
const scaleOf = async (m) => {
  const { stats } = await parseUnitModel(bytes(m.name), bakeOptionsFor(ageOf(m), m.key, m.classId, modelOf(m)));
  return stats.scale * (m.key === 'general' ? MODEL_SCALE.general : MODEL_SCALE[m.classId]);
};
// Carts and chariots: already at the people's scale (drawn like cavalry and support), checked for it.
const DRAWN_VEHICLES = [
  { name: 'bronze-cavalry', key: 'cavalry', classId: 'cavalry', crew: 2 },
  { name: 'bronze-support', key: 'support', classId: 'support', crew: 1 },
  { name: 'bronze-general', key: 'general', classId: 'cavalry', crew: 2 }
];

// What is in a unit file: every person's skeleton size (the bone chain from the left foot up to the
// head, which no pose changes: a seated driver measures like a standing man), the machine's own
// bounds (meshes on a rig with no head and no animal's bones), the whole file's bounds, triangles,
// and an animal's back (the top of a camel's hump or an elephant's body, without saddle or howdah).
const fileParts = async (name) => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const { Box3 } = await import('three');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(bytes(name), '');
  gltf.scene.updateMatrixWorld(true);
  const machine = new Box3(); const all = new Box3(); const v = new Vector3(); const w = new Vector3();
  const people = new Map(); let triangles = 0; let back = -Infinity;
  const chain = (bone) => { let d = 0; for (let b = bone; b.parent?.isBone && !/^Hips/.test(b.name); b = b.parent) d += b.getWorldPosition(v).distanceTo(b.parent.getWorldPosition(w)); return d; };
  gltf.scene.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry; const n = g.attributes.position.count; triangles += (g.index ? g.index.count : n) / 3;
    const bones = m.isSkinnedMesh ? m.skeleton.bones : [];
    const head = bones.find((b) => /^Head(_\d+)?$/.test(b.name)); const foot = bones.find((b) => /^Foot_L(_\d+)?$/.test(b.name));
    const animal = bones.some((b) => /^Mount_/.test(b.name));
    if (head && foot && !people.has(bones[0])) people.set(bones[0], chain(head) + chain(foot));
    for (let i = 0; i < n; i++) {
      if (m.isSkinnedMesh) m.getVertexPosition(i, v); else v.fromBufferAttribute(g.attributes.position, i);
      v.applyMatrix4(m.matrixWorld); all.expandByPoint(v);
      if (!head && !animal) machine.expandByPoint(v);
      if (/^(Camel|Elephant)(Barrel|Hump)$/.test(m.name)) back = Math.max(back, v.y);
    }
  });
  return { people: [...people.values()], machine, all, triangles, back };
};

describe('machines bigger, beasts at true size, their crews and riders at the people\'s scale (MD09, MD10)', () => {
  it('draws every machine and beast file at the infantry\'s scale: no fitted height', async () => {
    for (const m of [...MACHINES, ...DRAWN_VEHICLES, ...BEASTS]) {
      const ageId = ageOf(m);
      expect(modelOf(m).options.height, `${m.name} must not be fitted to a height`).toBeUndefined();
      expect(await scaleOf(m), m.name).toBeCloseTo(ART_UNIT_WORLD, 3);
      expect(await scaleOf(m), m.name).toBeCloseTo(await drawnScale(ageId, 'infantry', 'infantry'), 3);
    }
  }, 120000);

  it('every crew member and rider is the infantryman\'s size within 3%', async () => {
    for (const m of [...MACHINES, ...DRAWN_VEHICLES, ...BEASTS]) {
      const ageId = ageOf(m);
      const man = (await fileParts(`${ageId}-infantry`)).people[0] * (await drawnScale(ageId, 'infantry', 'infantry'));
      const k = await scaleOf(m);
      const { people } = await fileParts(m.name);
      expect(people.length, `${m.name} crew`).toBe(m.crew);
      people.forEach((p, i) => expect(Math.abs((p * k) / man - 1), `${m.name} crew ${i}: ${((p * k) / man).toFixed(3)} of an infantryman`).toBeLessThan(0.03));
    }
  }, 120000);

  it('a camel stands about 1.9 m at the hump and a war elephant about 2.8 to 3 m, against a 1.8 m man', async () => {
    for (const m of BEASTS) {
      const ageId = ageOf(m);
      const man = (await rigHeights(`${ageId}-infantry`)).head * (await drawnScale(ageId, 'infantry', 'infantry'));
      const back = ((await fileParts(m.name)).back * (await scaleOf(m)) * 1.8) / man;
      expect(back, `${m.name} back ${back.toFixed(2)} m`).toBeGreaterThanOrEqual(m.back[0]);
      expect(back, `${m.name} back ${back.toFixed(2)} m`).toBeLessThanOrEqual(m.back[1]);
    }
  }, 120000);

  it('every machine is about two thirds of its real size against a 1.8 m man', async () => {
    for (const m of MACHINES) {
      const ageId = ageOf(m);
      const man = (await rigHeights(`${ageId}-infantry`)).head * (await drawnScale(ageId, 'infantry', 'infantry'));
      const metres = ((await scaleOf(m)) * 1.8) / man;
      const { machine, triangles } = await fileParts(m.name);
      const length = (machine.max.z - machine.min.z) * metres; const height = machine.max.y * metres;
      expect(length, `${m.name} length ${length.toFixed(2)} m`).toBeGreaterThanOrEqual(m.length[0]);
      expect(length, `${m.name} length ${length.toFixed(2)} m`).toBeLessThanOrEqual(m.length[1]);
      expect(height, `${m.name} height ${height.toFixed(2)} m`).toBeGreaterThanOrEqual(m.height[0]);
      expect(height, `${m.name} height ${height.toFixed(2)} m`).toBeLessThanOrEqual(m.height[1]);
      expect(triangles, `${m.name} triangles`).toBeLessThanOrEqual(4000); // machine LOD0: 4,000 target, 6,000 hard
    }
  }, 120000);

  it('spaces a squad\'s machines by their footprint: none overlap, the block stays on the squad\'s ground', async () => {
    for (const m of MACHINES) {
      const footprint = footprintOf(modelOf(m));
      const { all } = await fileParts(m.name);
      // the JSON's footprint is the file's own width and length (crew included)
      expect(Math.abs(footprint[0] - (all.max.x - all.min.x)), `${m.name} footprint width`).toBeLessThan(0.05);
      expect(Math.abs(footprint[1] - (all.max.z - all.min.z)), `${m.name} footprint length`).toBeLessThan(0.05);
      if (m.key === 'general') continue; // one car beside the standard, not a block
      const soldiers = m.classId === 'siege' ? 3 : 4;
      const lay = machineLayout(footprint, soldiers, 1.5);
      const wide = footprint[0] * ART_UNIT_WORLD; const long = footprint[1] * ART_UNIT_WORLD;
      expect(lay.spacing - wide, `${m.name} side by side`).toBeGreaterThanOrEqual(MACHINE_BLOCK.gap - 1e-9);
      expect(lay.rowGap - long, `${m.name} nose to tail`).toBeGreaterThanOrEqual(MACHINE_BLOCK.gap - 1e-9);
      // one machine with its crew stands inside the squad's own ground (3 tiles between squads)
      expect(wide, `${m.name} is ${wide.toFixed(2)} tiles wide`).toBeLessThanOrEqual(MACHINE_BLOCK.width);
      expect(long, `${m.name} is ${long.toFixed(2)} tiles long`).toBeLessThanOrEqual(MACHINE_BLOCK.depth);
      expect(lay.figures).toBeGreaterThanOrEqual(1);
      expect(lay.figures).toBeLessThanOrEqual(soldiers);
      const rows = Math.ceil(lay.figures / lay.cols);
      if (lay.cols > 1) expect(lay.cols * lay.spacing - MACHINE_BLOCK.gap, `${m.name} block width`).toBeLessThanOrEqual(MACHINE_BLOCK.width + 1e-9);
      if (rows > 1) expect(rows * lay.rowGap - MACHINE_BLOCK.gap, `${m.name} block depth`).toBeLessThanOrEqual(MACHINE_BLOCK.depth + 1e-9);
    }
    // people and mounts have no footprint: their squads are laid out as before
    expect(machineLayout(footprintOf(findUnitModel('kingdoms', 'infantry')), 12, 0.52)).toBeNull();
    expect(machineLayout(footprintOf(findUnitModel('kingdoms', 'cavalry')), 8, 0.95)).toBeNull();
  }, 120000);
});
