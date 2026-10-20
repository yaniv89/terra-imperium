// The foot soldiers' authored clips (plans/art/clip-animation-pipeline.md section 7 and 7.2): every unit
// GLB carries its archetype's clips at 20 fps with frame counts that match its options file, events at
// the right frames (contacts held two frames), loops close, Idle frame 1 is the rest pose the game
// bakes, the Root stays in place on the ground plane, the falls end lying down, a nocked arrow hides by
// scale after the release, and a spear or a pike hangs from Prop_R alone (one rigid bone carries the
// shaft the loader stretches).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Quaternion } from 'three';

const SETS = {
  melee: ['Idle', 'IdleAlt', 'Walk', 'Run', 'Retreat-run', 'Attack', 'Attack2', 'Block', 'Hit', 'Death', 'DeathAlt', 'Cheer'],
  bow: ['Idle', 'IdleAlt', 'Walk', 'Run', 'Retreat-run', 'Draw-aim-release', 'Melee-fallback', 'Hit', 'Death', 'DeathAlt', 'Cheer'],
  gun: ['Idle', 'IdleAlt', 'Walk', 'Run', 'Retreat-run', 'Aim-fire-reload', 'Melee-fallback', 'Hit', 'Death', 'DeathAlt', 'Cheer'],
  support: ['Idle', 'Walk', 'Run', 'Build', 'Repair', 'Hit', 'Death']
};
const LOOPS = ['Idle', 'IdleAlt', 'Walk', 'Run', 'Retreat-run', 'Cheer', 'Mine', 'Build', 'Repair'];
const EVENTS = {
  Attack: ['contact'], Attack2: ['contact'], 'Melee-fallback': ['contact'], Mine: ['contact'], Build: ['contact'], Repair: ['contact'],
  'Draw-aim-release': ['release'], 'Aim-fire-reload': ['fire', 'reloaded'], Death: ['settle'], DeathAlt: ['settle']
};
const HELD = ['Attack', 'Attack2', 'Melee-fallback', 'Mine', 'Build', 'Repair'];
// unit -> archetype (a support unit may add Mine when its tool is a pick)
const UNITS = {
  'bronze-infantry': 'melee', 'bronze-ranged': 'bow', 'bronze-mercenary': 'melee',
  'classical-infantry': 'melee', 'classical-ranged': 'bow', 'classical-mercenary': 'melee', 'classical-support': 'support',
  'kingdoms-infantry': 'melee', 'kingdoms-ranged': 'bow', 'kingdoms-mercenary': 'melee', 'kingdoms-support': 'support',
  'gunpowder-infantry': 'gun', 'gunpowder-ranged': 'gun', 'gunpowder-mercenary': 'gun', 'gunpowder-support': 'support',
  'modern-infantry': 'gun', 'modern-mercenary': 'gun',
  // the Stone Age (eight-ages plan U80): the chief and the shaman are foot figures on the melee set
  'stone-infantry': 'melee', 'stone-ranged': 'bow', 'stone-mercenary': 'melee', 'stone-raider': 'melee', 'stone-general': 'melee', 'stone-support': 'melee'
};
const POLEARMS = /spear|pike|lance|halberd/i;
const FPS = 20;

const bytes = (name) => { const b = readFileSync(`src/assets/units/${name}.glb`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const load = async (name) => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(bytes(name), '');
};
const track = (clip, node, path) => clip.tracks.find((t) => t.name === `${node}.${path}`);
const scaleAt = (clip, node, key) => { const t = track(clip, node, 'scale'); return t ? t.values[(key < 0 ? t.times.length + key : key) * 3] : 1; };
const angle = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI;

describe.each(Object.entries(UNITS))('%s clips', (name, archetype) => {
  const opts = JSON.parse(readFileSync(`src/assets/units/${name}.json`, 'utf8'));
  const want = Object.keys(opts.clips || {});

  it('lists its archetype\'s clips with loop flags and events in the options file', () => {
    expect(opts.restClip).toBe('^Idle$');
    const set = SETS[archetype];
    expect(want.filter((c) => c !== 'Mine')).toEqual(set);
    if (want.includes('Mine')) expect(archetype).toBe('support');
    want.forEach((c) => {
      const info = opts.clips[c];
      expect(info.fps, c).toBe(FPS);
      expect(info.loop, c).toBe(LOOPS.includes(c));
      expect(info.frames, c).toBeGreaterThanOrEqual(8);
      expect(info.frames, c).toBeLessThanOrEqual(60);
      (EVENTS[c] || []).forEach((e) => {
        const f = info.events?.[e];
        expect(f, `${c} ${e}`).toBeGreaterThanOrEqual(1);
        expect(f, `${c} ${e}`).toBeLessThanOrEqual(info.frames);
      });
      if (HELD.includes(c)) expect(info.events.contact + 1, `${c} contact held`).toBeLessThanOrEqual(info.frames);
    });
    ['Death', 'DeathAlt'].filter((c) => want.includes(c)).forEach((c) => expect(opts.clips[c].events.settle).toBe(opts.clips[c].frames));
    if (want.includes('Aim-fire-reload')) expect(opts.clips['Aim-fire-reload'].events.fire).toBeLessThan(opts.clips['Aim-fire-reload'].events.reloaded);
  });

  it('carries the clips at 20 fps: closed loops, held contacts, in place, Idle frame 1 at rest, the falls lying down', async () => {
    const gltf = await load(name);
    const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    expect(Object.keys(clips).sort()).toEqual([...want].sort());
    const bones = new Map(); gltf.scene.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
    ['Root', 'Hips', 'Spine', 'Chest', 'Head', 'Hand_R', 'Hand_L', 'Prop_R', 'Prop_L', 'Prop_Back'].forEach((b) => expect(bones.has(b), b).toBe(true));
    expect(bones.size).toBeLessThanOrEqual(128);
    const root = bones.get('Root');
    want.forEach((c) => {
      const clip = clips[c]; const info = opts.clips[c];
      // frame f sits at f / 20 s: frame 1 at 0.05 s, the last at frames / 20
      const times = clip.tracks.reduce((m, t) => (t.times.length > m.length ? t.times : m), []);
      expect(times.length, c).toBe(info.frames);
      expect(times[0], c).toBeCloseTo(1 / FPS, 4);
      expect(times[times.length - 1], c).toBeCloseTo(info.frames / FPS, 4);
      const same = (t, a, b) => {
        const n = t.getValueSize();
        if (/quaternion$/.test(t.name)) return Math.abs(new Quaternion().fromArray(t.values, a * n).dot(new Quaternion().fromArray(t.values, b * n))) > 0.9999;
        for (let k = 0; k < n; k++) if (Math.abs(t.values[a * n + k] - t.values[b * n + k]) > 1e-4) return false;
        return true;
      };
      clip.tracks.forEach((t) => {
        if (t.times.length !== info.frames) return; // a constant track (gltfpack keeps one key)
        if (info.loop) expect(same(t, 0, info.frames - 1), `${c} ${t.name} closes`).toBe(true);
        if (HELD.includes(c)) expect(same(t, info.events.contact - 1, info.events.contact), `${c} ${t.name} held at contact`).toBe(true);
      });
      // in place: the Root never leaves its spot on the ground plane (glTF X and Z)
      const p = track(clip, 'Root', 'position');
      if (p) {
        for (let k = 0; k < p.times.length; k++) {
          expect(Math.abs(p.values[k * 3] - root.position.x), `${c} Root x`).toBeLessThan(0.001);
          expect(Math.abs(p.values[k * 3 + 2] - root.position.z), `${c} Root z`).toBeLessThan(0.001);
        }
      }
    });
    // Idle frame 1 is the rest pose: the bones at their bind rotations (within the rig's round trip through
    // Blender's edit mode), the Root lifted at most 1 mm
    const idle = clips.Idle;
    bones.forEach((o) => {
      const q = track(idle, o.name, 'quaternion');
      if (q) expect(Math.abs(new Quaternion().fromArray(q.values, 0).dot(o.quaternion)), o.name).toBeGreaterThan(0.99996);
      const t = track(idle, o.name, 'position');
      if (t) expect(Math.hypot(t.values[0] - o.position.x, t.values[1] - o.position.y, t.values[2] - o.position.z), o.name).toBeLessThan(0.0015);
    });
    // the falls end lying down: the root turned most of the way to the ground, still over the last frames
    ['Death', 'DeathAlt'].filter((c) => want.includes(c)).forEach((c) => {
      const r = track(clips[c], 'Root', 'quaternion');
      const n = r.values.length / 4;
      const end = new Quaternion().fromArray(r.values, (n - 1) * 4);
      expect(angle(end), c).toBeGreaterThan(70);
      expect(Math.abs(end.dot(new Quaternion().fromArray(r.values, (n - 3) * 4))), `${c} still`).toBeGreaterThan(0.9999);
    });
    // a nocked arrow on its own bone: shown at rest, hidden from the release
    if (bones.has('Tool_Arrow')) {
      const draw = clips['Draw-aim-release']; const rel = opts.clips['Draw-aim-release'].events.release;
      expect(scaleAt(idle, 'Tool_Arrow', 0)).toBe(1);
      expect(scaleAt(draw, 'Tool_Arrow', 0)).toBe(1);
      expect(scaleAt(draw, 'Tool_Arrow', rel - 2)).toBe(1);
      expect(scaleAt(draw, 'Tool_Arrow', rel - 1)).toBe(0);
      expect(scaleAt(draw, 'Tool_Arrow', -1)).toBe(1);
    }
    // a spear or a pike hangs from Prop_R alone: the loader stretches the shaft at rest and one rigid bone moves it
    gltf.scene.traverse((m) => {
      if (!m.isSkinnedMesh || !POLEARMS.test(m.name) || /javelin|slung|throw/i.test(m.name)) return;
      const idx = m.geometry.attributes.skinIndex; const w = m.geometry.attributes.skinWeight;
      for (let i = 0; i < idx.count; i++) {
        for (let k = 0; k < 4; k++) {
          if (w.getComponent(i, k) > 0.01) expect(m.skeleton.bones[idx.getComponent(i, k)].name, m.name).toBe('Prop_R');
        }
      }
    });
  }, 60000);
});
