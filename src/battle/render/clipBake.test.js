// The clip bake (I219): every clip of the four Bronze GLBs that carry clips is sampled into a rigid
// bone texture, and playing it back reproduces what three's own skinning does on the same frame.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vector3, Vector4, Matrix4, AnimationMixer, LoopOnce } from 'three';
import { extractUnitGeometry } from './gltfUnitLoader';
import { clipMeta, boneRows, CLIP_FPS } from './clipBake';
import { soldierLodGeometries, soldierLodReady } from './soldierLod';

const bytes = (name) => { const b = readFileSync(`src/assets/units/${name}.glb`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const optsOf = (name) => JSON.parse(readFileSync(`src/assets/units/${name}.json`, 'utf8'));
const parse = async (name) => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(bytes(name), '');
};
const bake = async (name) => {
  const gltf = await parse(name);
  const o = optsOf(name);
  const { geometry, stats } = extractUnitGeometry(gltf.scene, { animations: gltf.animations, restClip: /^Idle$/i, scale: 1.2, clips: o.clips });
  return { gltf, geometry, stats, clips: geometry.userData.clips };
};
const apply = (rows, p) => rows.map((r) => r[0] * p.x + r[1] * p.y + r[2] * p.z + r[3]);

describe('clip metadata', () => {
  it('loops all but the one-shot clips, unless the file says otherwise; events 0-based', () => {
    expect(clipMeta('Walk').loop).toBe(true);
    expect(clipMeta('Death').loop).toBe(false);
    expect(clipMeta('Hit').loop).toBe(false);
    expect(clipMeta('Chop', { Chop: { contact: 19 } }).events.contact).toBe(18);
    expect(clipMeta('Hit', { Hit: { loop: true } }).loop).toBe(true);
  });
});

describe('the bone texture of the Bronze clip units', () => {
  it.each(['bronze-infantry', 'bronze-ranged', 'bronze-worker', 'bronze-siege'])('%s: every clip baked at 20 fps, one bone per vertex', async (name) => {
    const { gltf, geometry, clips } = await bake(name);
    expect(clips).toBeTruthy();
    expect(clips.clips.map((c) => c.name).sort()).toEqual(gltf.animations.map((a) => a.name).sort());
    expect(clips.fps).toBe(CLIP_FPS);
    expect(clips.bones).toBeLessThanOrEqual(128);
    const aBone = geometry.attributes.aBone;
    expect(aBone.count).toBe(geometry.attributes.position.count);
    for (let i = 0; i < aBone.count; i++) expect(aBone.getX(i)).toBeGreaterThan(0);
    clips.clips.forEach((c) => expect(c.frames).toBe(Math.max(2, Math.round(gltf.animations[clips.byName[c.name]].duration * 20) + 1)));
    expect(clips.width * clips.height * 4).toBe(clips.data.length);
    expect(clips.data.every(Number.isFinite)).toBe(true);
  });

  it('the rest pose (Idle frame 1) is the identity for every bone', async () => {
    const { clips } = await bake('bronze-worker');
    const idle = clips.clips[clips.byName.Idle];
    for (let b = 0; b < clips.bones; b++) {
      boneRows(clips, b, idle.first).forEach((row, r) => row.forEach((x, c) => expect(x).toBeCloseTo(r === c ? 1 : 0, 4)));
    }
  });

  it('the worker\'s work clips move (Chop, Mine, Harvest, Build, Repair, Carry, Deposit)', async () => {
    const { clips } = await bake('bronze-worker');
    const moved = (name) => {
      const c = clips.clips[clips.byName[name]];
      let most = 0;
      for (let f = 1; f < c.frames; f++) for (let b = 1; b < clips.bones; b++) {
        const a = boneRows(clips, b, c.first).flat(); const z = boneRows(clips, b, c.first + f).flat();
        a.forEach((x, i) => { most = Math.max(most, Math.abs(x - z[i])); });
      }
      return most;
    };
    ['Chop', 'Mine', 'Harvest', 'Build', 'Repair', 'Carry', 'Deposit', 'Walk', 'Death'].forEach((n) => expect(moved(n), n).toBeGreaterThan(0.05));
  });

  it('plays back what three\'s skinning gives on the same frame (single-weight vertices, Walk and Death)', async () => {
    const { gltf, clips } = await bake('bronze-worker');
    const norm = new Matrix4().fromArray(clips.norm);
    const root = gltf.scene;
    const boneIndex = new Map(clips.boneNames.map((n, i) => [n, i]));
    // every vertex with one bone, at rest (normalised)
    const samples = [];
    const v = new Vector3(); const si = new Vector4(); const sw = new Vector4();
    root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isSkinnedMesh) return;
      const g = m.geometry;
      for (let i = 0; i < g.attributes.position.count; i += 7) {
        si.fromBufferAttribute(g.attributes.skinIndex, i); sw.fromBufferAttribute(g.attributes.skinWeight, i);
        let best = 0; for (let q = 1; q < 4; q++) if (sw.getComponent(q) > sw.getComponent(best)) best = q;
        if (sw.getComponent(best) < 0.999) continue;
        m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(norm);
        samples.push({ m, i, rest: v.clone(), bone: boneIndex.get(m.skeleton.bones[si.getComponent(best)].name) });
      }
    });
    expect(samples.length).toBeGreaterThan(100);
    const mixer = new AnimationMixer(root);
    for (const name of ['Walk', 'Death']) {
      const clip = gltf.animations.find((a) => a.name === name);
      const c = clips.clips[clips.byName[name]];
      const action = mixer.clipAction(clip); action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.reset().play();
      for (const f of [3, Math.floor(c.frames / 2), c.frames - 1]) {
        mixer.setTime(Math.min(clip.duration, f / 20)); root.updateMatrixWorld(true);
        let worst = 0;
        samples.forEach((s) => {
          s.m.getVertexPosition(s.i, v); v.applyMatrix4(s.m.matrixWorld).applyMatrix4(norm);
          const p = apply(boneRows(clips, s.bone, c.first + f), s.rest);
          worst = Math.max(worst, Math.abs(p[0] - v.x), Math.abs(p[1] - v.y), Math.abs(p[2] - v.z));
        });
        expect(worst, `${name} frame ${f}`).toBeLessThan(1e-3);
      }
      action.stop();
    }
  });

  it('the detail levels keep each vertex\'s bone (welded per bone, never across)', async () => {
    await soldierLodReady();
    const { geometry } = await bake('bronze-infantry');
    const levels = soldierLodGeometries(geometry);
    levels.slice(1).forEach((g) => {
      expect(g.attributes.aBone).toBeTruthy();
      const ids = new Set(); for (let i = 0; i < g.attributes.aBone.count; i++) ids.add(g.attributes.aBone.getX(i));
      ids.forEach((b) => expect(Number.isInteger(b) && b > 0).toBe(true));
    });
  });
});
