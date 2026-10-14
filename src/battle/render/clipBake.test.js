// The clip bake (I219): every clip of the GLBs whose options file lists clips (the workers of every
// age, the foot soldiers, the Bronze siege) is sampled into a rigid bone texture, and playing it back
// reproduces what three's own skinning does on the same frame, the workers' hidden tools included.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { Vector3, Vector4, Matrix4, AnimationMixer, LoopOnce } from 'three';
import { extractUnitGeometry } from './gltfUnitLoader';
import { clipMeta, boneRows, CLIP_FPS, toBindPose, isHidden } from './clipBake';
import { soldierLodGeometries, soldierLodReady } from './soldierLod';

const DIR = 'src/assets/units';
const bytes = (name) => { const b = readFileSync(`${DIR}/${name}.glb`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const optsOf = (name) => JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'));
const FILES = readdirSync(DIR);
const CLIP_UNITS = FILES.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  .filter((n) => FILES.includes(`${n}.glb`) && optsOf(n).clips && optsOf(n).enabled !== false);
const parse = async (name) => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(bytes(name), '');
};
const bake = async (name) => {
  const gltf = await parse(name);
  const { geometry, stats } = extractUnitGeometry(gltf.scene, { animations: gltf.animations, restClip: /^Idle$/i, scale: 1.2, clips: optsOf(name).clips });
  return { gltf, geometry, stats, clips: geometry.userData.clips };
};
const apply = (rows, p) => rows.map((r) => r[0] * p.x + r[1] * p.y + r[2] * p.z + r[3]);

describe('clip metadata', () => {
  it('loops all but the one-shot clips, unless the file says otherwise; events 0-based', () => {
    expect(clipMeta('Walk').loop).toBe(true);
    expect(clipMeta('Death').loop).toBe(false);
    expect(clipMeta('Attack').loop).toBe(false);
    expect(clipMeta('Chop', { Chop: { contact: 19 } }).events.contact).toBe(18);
    expect(clipMeta('Hit', { Hit: { loop: true } }).loop).toBe(true);
    // the art's format (section 7.1): events under "events", frames listed
    expect(clipMeta('Chop', { Chop: { frames: 33, loop: true, tool: 'Axe', events: { contact: 17 } } }))
      .toMatchObject({ loop: true, frames: 33, tool: 'Axe', events: { contact: 16 } });
  });
  it('a model whose options file lists no clips keeps the procedural rig only', async () => {
    const gltf = await parse('bronze-worker');
    const { geometry } = extractUnitGeometry(gltf.scene, { animations: gltf.animations, restClip: /^Idle$/i, scale: 1.2 });
    expect(geometry.attributes.aBone).toBeUndefined();
    expect(geometry.userData.clips).toBeUndefined();
  });
});

describe('the bone texture of the clip units', () => {
  it('covers the art\'s clip units (workers of every age, the foot soldiers)', () => {
    expect(CLIP_UNITS.length).toBeGreaterThanOrEqual(20);
    ['bronze-worker', 'modern-worker', 'kingdoms-infantry', 'gunpowder-ranged'].forEach((n) => expect(CLIP_UNITS).toContain(n));
  });

  it.each(CLIP_UNITS)('%s: every clip baked at 20 fps, one bone per vertex', async (name) => {
    const { gltf, geometry, clips } = await bake(name);
    expect(clips).toBeTruthy();
    expect(clips.clips.map((c) => c.name).sort()).toEqual(gltf.animations.map((a) => a.name).sort());
    expect(clips.fps).toBe(CLIP_FPS);
    expect(clips.bones).toBeLessThanOrEqual(128);
    const aBone = geometry.attributes.aBone;
    expect(aBone.count).toBe(geometry.attributes.position.count);
    expect(geometry.attributes.aClipPos.count).toBe(aBone.count);
    for (let i = 0; i < aBone.count; i++) expect(aBone.getX(i)).toBeGreaterThan(0);
    const listed = optsOf(name).clips;
    clips.clips.forEach((c) => { if (listed[c.name]?.frames) expect(c.frames).toBe(listed[c.name].frames); else expect(c.frames).toBeGreaterThanOrEqual(2); });
    expect(clips.width * clips.height * 4).toBe(clips.data.length);
    expect(clips.data.every(Number.isFinite)).toBe(true);
  });

  it('the rest pose (Idle frame 1) is the identity for every bone shown at rest', async () => {
    const { clips } = await bake('bronze-worker');
    const idle = clips.clips[clips.byName.Idle];
    for (let b = 0; b < clips.bones; b++) {
      if (/^Tool_(?!Held)/.test(clips.boneNames[b])) continue; // hidden at rest: referenced to the bind pose
      boneRows(clips, b, idle.first).forEach((row, r) => row.forEach((x, c) => expect(x, clips.boneNames[b]).toBeCloseTo(r === c ? 1 : 0, 2)));
    }
  });

  it('shows each work tool only in its clip (Tool_Axe in Chop, Tool_Pick in Mine)', async () => {
    const { clips } = await bake('bronze-worker');
    const size = (bone, clip, f) => { const r = boneRows(clips, clips.boneNames.indexOf(bone), clips.clips[clips.byName[clip]].first + f); return Math.hypot(r[0][0], r[1][0], r[2][0]); };
    expect(size('Tool_Axe', 'Chop', 5)).toBeGreaterThan(0.5);
    expect(size('Tool_Axe', 'Idle', 5)).toBeLessThan(0.01);
    expect(size('Tool_Pick', 'Mine', 5)).toBeGreaterThan(0.5);
    expect(size('Tool_Pick', 'Chop', 5)).toBeLessThan(0.01);
  });

  it('the work clips move (Chop, Mine, Harvest, Build, Repair, Carry, Deposit)', async () => {
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

  it.each(['bronze-worker', 'gunpowder-worker', 'kingdoms-infantry', 'classical-ranged'])('%s plays back what three\'s skinning gives on the same frame (single-weight vertices, tools included)', async (name) => {
    const { gltf, clips } = await bake(name);
    const norm = new Matrix4().fromArray(clips.norm);
    const root = gltf.scene;
    const boneIndex = new Map(clips.boneNames.map((n, i) => [n, i]));
    const samples = [];
    const v = new Vector3(); const si = new Vector4(); const sw = new Vector4();
    root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isSkinnedMesh) return;
      const g = m.geometry;
      for (let i = 0; i < g.attributes.position.count; i += 5) {
        si.fromBufferAttribute(g.attributes.skinIndex, i); sw.fromBufferAttribute(g.attributes.skinWeight, i);
        let best = 0; for (let q = 1; q < 4; q++) if (sw.getComponent(q) > sw.getComponent(best)) best = q;
        if (sw.getComponent(best) < 0.999) continue;
        const b = m.skeleton.bones[si.getComponent(best)];
        m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(norm);
        samples.push({ m, i, rest: v.clone(), bone: boneIndex.get(b.name), hidden: isHidden(b.matrixWorld) });
      }
    });
    expect(samples.length).toBeGreaterThan(100);
    // parts hidden at rest are referenced to the bind pose (section 7.1)
    toBindPose(root);
    samples.forEach((s) => { if (s.hidden) { s.m.getVertexPosition(s.i, v); s.rest.copy(v.applyMatrix4(s.m.matrixWorld).applyMatrix4(norm)); } });
    const mixer = new AnimationMixer(root);
    let checked = 0;
    for (const clipName of ['Walk', 'Death', 'Chop', 'Attack', 'Draw-aim-release']) {
      const clip = gltf.animations.find((a) => a.name === clipName);
      if (!clip) continue;
      const c = clips.clips[clips.byName[clipName]];
      toBindPose(root);
      const action = mixer.clipAction(clip); action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.reset().play();
      for (const f of [3, Math.floor(c.frames / 2), c.frames - 1]) {
        mixer.setTime(Math.min(clip.duration, c.t0 + f / 20)); root.updateMatrixWorld(true);
        let worst = 0;
        samples.forEach((s) => {
          s.m.getVertexPosition(s.i, v); v.applyMatrix4(s.m.matrixWorld).applyMatrix4(norm);
          const p = apply(boneRows(clips, s.bone, c.first + f), s.rest);
          worst = Math.max(worst, Math.abs(p[0] - v.x), Math.abs(p[1] - v.y), Math.abs(p[2] - v.z));
        });
        expect(worst, `${clipName} frame ${f}`).toBeLessThan(1e-3);
        checked += 1;
      }
      action.stop(); mixer.uncacheAction(clip);
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it('the detail levels keep each vertex\'s bone (welded per bone, never across)', async () => {
    await soldierLodReady();
    const { geometry } = await bake('bronze-infantry');
    const levels = soldierLodGeometries(geometry);
    levels.slice(1).forEach((g) => {
      expect(g.attributes.aBone).toBeTruthy();
      expect(g.attributes.aClipPos).toBeTruthy();
      const ids = new Set(); for (let i = 0; i < g.attributes.aBone.count; i++) ids.add(g.attributes.aBone.getX(i));
      ids.forEach((b) => expect(Number.isInteger(b) && b > 0).toBe(true));
    });
  });
});
