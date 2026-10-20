// The mounted units', the generals' and the other several-rig units' authored clips (plans/art/
// clip-animation-pipeline.md section 7 and 7.3): every GLB carries its archetype's clips at 20 fps with frame
// counts that match its options file, events at the right frames (contacts held two frames), loops close,
// every rig in the file is keyed in every clip, Idle frame 1 is the rest pose of every rig, the mount and the
// people on foot stay in place (a rider moves with his horse and leaves it only in the falls), the falls end
// lying down and still, the reins' hand end has its own bone, and a lance hangs from Prop_R alone (the shaft
// the loader stretches rides on one rigid bone).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Matrix4, Quaternion } from 'three';

const SETS = {
  mounted: ['Idle', 'Walk', 'Trot', 'Gallop', 'Charge', 'Attack', 'Hit', 'Death', 'DeathAlt', 'Cheer'],
  general: ['Idle', 'Walk', 'Trot', 'Gallop', 'Charge', 'Attack', 'Hit', 'Death', 'DeathAlt', 'Cheer'],
  chariot: ['Idle', 'Move', 'Charge', 'Archer-shoot', 'Hit', 'Wreck'],
  atgm: ['Idle', 'Walk', 'Aim-fire-reload', 'Hit', 'Death', 'DeathAlt']
};
const LOOPS = ['Idle', 'Walk', 'Trot', 'Gallop', 'Move', 'Cheer'];
const EVENTS = {
  Charge: ['contact'], Attack: ['contact'], 'Archer-shoot': ['release'], 'Aim-fire-reload': ['fire', 'reloaded'],
  Death: ['settle'], DeathAlt: ['settle'], Wreck: ['settle']
};
const HELD = ['Charge', 'Attack'];
const FALLS = ['Death', 'DeathAlt', 'Wreck'];
// unit -> archetype
const UNITS = {
  'bronze-cavalry': 'chariot', 'bronze-general': 'general', 'bronze-raider': 'mounted',
  'classical-cavalry': 'mounted', 'classical-general': 'general', 'classical-raider': 'mounted',
  'kingdoms-cavalry': 'mounted', 'kingdoms-general': 'general', 'kingdoms-raider': 'mounted',
  'gunpowder-cavalry': 'mounted', 'gunpowder-general': 'general', 'gunpowder-raider': 'mounted',
  'modern-ranged': 'atgm',
  // the signature chariots (scripts/blender/build_signature_chariots.py)
  'signature/ugarit': 'chariot',
  'signature/kemet': 'chariot',
  'signature/garamantes': 'chariot',
  'signature/oxus': 'chariot',
  'signature/andronovo': 'chariot',
  'signature/kuru': 'chariot',
  'signature/zhou': 'chariot',
  'signature/pontus': 'chariot',
  'signature/brigantes': 'chariot'
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
const quatAt = (t, k) => new Quaternion().fromArray(t.values, Math.min(k, t.times.length - 1) * 4);
const angle = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI;
const turned = (bind, q) => angle(bind.clone().invert().multiply(q));

describe.each(Object.entries(UNITS))('%s clips', (name, archetype) => {
  const opts = JSON.parse(readFileSync(`src/assets/units/${name}.json`, 'utf8'));
  const want = Object.keys(opts.clips || {});

  it('lists its archetype\'s clips with loop flags and events in the options file', () => {
    expect(opts.restClip).toBe('^Idle$');
    expect(want).toEqual(SETS[archetype]);
    if (archetype !== 'atgm') expect(opts.quadruped).toBe(true);
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
    FALLS.filter((c) => want.includes(c)).forEach((c) => expect(opts.clips[c].events.settle).toBe(opts.clips[c].frames));
    if (want.includes('Aim-fire-reload')) expect(opts.clips['Aim-fire-reload'].events.fire).toBeLessThan(opts.clips['Aim-fire-reload'].events.reloaded);
  });

  it('carries the clips at 20 fps over every rig: closed loops, held contacts, in place, Idle frame 1 at rest, the falls lying down', async () => {
    const gltf = await load(name);
    const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    expect(Object.keys(clips).sort()).toEqual([...want].sort());
    const bones = new Map(); gltf.scene.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
    expect(bones.size).toBeLessThanOrEqual(128);
    // the rigs: each top bone (Root, Root_1, Mount_Root, Hull) and the bones under it
    const rigs = [...bones.values()].filter((b) => !b.parent?.isBone).map((top) => {
      const names = new Set(); top.traverse((o) => { if (o.isBone) names.add(o.name); });
      return { top, names };
    });
    const horses = rigs.filter((r) => r.top.name.startsWith('Mount_Root'));
    const people = rigs.filter((r) => /^Root(_\d+)?$/.test(r.top.name));
    expect(rigs.length, 'rigs').toBeGreaterThanOrEqual(2);
    if (archetype === 'mounted' || archetype === 'general') {
      expect(horses.length).toBe(1);
      expect(bones.has('Mount_Rein'), 'the reins\' bone').toBe(true);
    }
    // in place: the mount, the car and a person on foot never leave their spot on the ground plane (glTF X
    // and Z); a carried person (a rider, a chariot's crew: the rig stands above the ground) rides within a
    // hand's breadth of the seat; in the falls the people go down beside their mount (a thrown rider, a
    // bearer stepping clear of the falling horse)
    const v = gltf.scene.position.clone();
    gltf.scene.updateMatrixWorld(true);
    const person = (r) => [...r.names].some((n) => /^Head(_\d+)?$/.test(n)); // (the loader numbers repeated names: Head_1)
    rigs.forEach((r) => { r.carried = person(r) && r.top.getWorldPosition(v).y > 0.1; });
    want.forEach((c) => {
      const clip = clips[c]; const info = opts.clips[c];
      const times = clip.tracks.reduce((m, t) => (t.times.length > m.length ? t.times : m), []);
      expect(times.length, c).toBe(info.frames);
      expect(times[0], c).toBeCloseTo(1 / FPS, 4);
      expect(times[times.length - 1], c).toBeCloseTo(info.frames / FPS, 4);
      // every rig keyed in every clip
      rigs.forEach((r) => expect(clip.tracks.some((t) => r.names.has(t.name.slice(0, t.name.lastIndexOf('.')))), `${c} keys ${r.top.name}`).toBe(true));
      const same = (t, a, b) => {
        const n = t.getValueSize();
        if (/quaternion$/.test(t.name)) return Math.abs(new Quaternion().fromArray(t.values, a * n).dot(new Quaternion().fromArray(t.values, b * n))) > 0.9999;
        for (let k = 0; k < n; k++) if (Math.abs(t.values[a * n + k] - t.values[b * n + k]) > 1e-4) return false;
        return true;
      };
      clip.tracks.forEach((t) => {
        if (t.times.length !== info.frames) return; // a constant track (gltfpack keeps one key)
        if (info.loop) expect(same(t, 0, info.frames - 1), `${c} ${t.name} closes`).toBe(true);
        if (c === 'Attack') expect(same(t, info.events.contact - 1, info.events.contact), `${c} ${t.name} held at contact`).toBe(true);
      });
      rigs.forEach((r) => {
        const p = track(clip, r.top.name, 'position');
        if (!p) return;
        // (a car turns about its axle, a little behind its Hull bone)
        const lim = person(r) && FALLS.includes(c) ? 1.0 : r.carried ? 0.1 : r.top.name === 'Hull' ? 0.05 : 0.001;
        for (let k = 0; k < p.times.length; k++) {
          expect(Math.abs(p.values[k * 3] - r.top.position.x), `${c} ${r.top.name} x`).toBeLessThan(lim);
          expect(Math.abs(p.values[k * 3 + 2] - r.top.position.z), `${c} ${r.top.name} z`).toBeLessThan(lim);
        }
      });
    });
    // Idle frame 1 is the rest pose of every rig: the bones at their bind rotations and places
    const idle = clips.Idle;
    bones.forEach((o) => {
      const q = track(idle, o.name, 'quaternion');
      if (q) expect(Math.abs(new Quaternion().fromArray(q.values, 0).dot(o.quaternion)), o.name).toBeGreaterThan(0.99996);
      const t = track(idle, o.name, 'position');
      if (t) expect(Math.hypot(t.values[0] - o.position.x, t.values[1] - o.position.y, t.values[2] - o.position.z), o.name).toBeLessThan(0.0015);
    });
    // the falls end lying down and still: the horse's back rolled onto its side, every person's Root turned
    // most of the way to the ground
    // (in the Wreck the chariot's horses go down on their chests, so only its crew are checked)
    FALLS.filter((c) => want.includes(c)).forEach((c) => {
      const down = [...(c === 'Wreck' ? [] : horses.map(() => bones.get('Mount_Spine')).filter(Boolean)), ...people.map((r) => r.top)];
      down.forEach((b) => {
        const r = track(clips[c], b.name, 'quaternion');
        expect(r, `${c} ${b.name}`).toBeTruthy();
        const n = r.times.length;
        expect(turned(b.quaternion, quatAt(r, n - 1)), `${c} ${b.name} down`).toBeGreaterThan(70);
        expect(Math.abs(quatAt(r, n - 1).dot(quatAt(r, n - 3))), `${c} ${b.name} still`).toBeGreaterThan(0.9999);
      });
    });
    // a lance hangs from Prop_R alone: the loader stretches the shaft at rest and one rigid bone moves it
    gltf.scene.traverse((m) => {
      if (!m.isSkinnedMesh || !POLEARMS.test(m.name) || /javelin|slung|throw/i.test(m.name)) return;
      const idx = m.geometry.attributes.skinIndex; const w = m.geometry.attributes.skinWeight;
      for (let i = 0; i < idx.count; i++) {
        for (let k = 0; k < 4; k++) {
          if (w.getComponent(i, k) > 0.01) expect(m.skeleton.bones[idx.getComponent(i, k)].name, m.name).toMatch(/^Prop_R(_\d+)?$/);
        }
      }
    });
    // the chariot archer's nocked arrow on its own bone: shown at rest, hidden from the release until a new one
    // comes out of the quiver
    if (bones.has('Tool_Arrow') && want.includes('Archer-shoot')) {
      const shot = clips['Archer-shoot']; const rel = opts.clips['Archer-shoot'].events.release;
      const t = track(shot, 'Tool_Arrow', 'scale');
      const at = (k) => (t ? t.values[(k < 0 ? t.times.length + k : k) * 3] : 1);
      expect(at(0)).toBe(1);
      expect(at(rel - 2)).toBe(1);
      expect(at(rel - 1)).toBe(0);
      expect(at(-1)).toBe(1);
    }
    // the ATGM loader's spare tube on its own bone: in his fist at rest, gone once it is loaded, a new one in his
    // fist by the end
    if (bones.has('Tool_Spare')) {
      const t = track(clips['Aim-fire-reload'], 'Tool_Spare', 'scale'); const done = opts.clips['Aim-fire-reload'].events.reloaded;
      const at = (k) => (t ? t.values[(k < 0 ? t.times.length + k : k) * 3] : 1);
      expect(at(0)).toBe(1);
      expect(at(done - 1)).toBe(1);
      expect(at(done)).toBe(0);
      expect(at(-1)).toBe(1);
    }
    // Charge: the horses gallop on through the impact; the riders' and the crews' weapons are held two frames
    // on their rigs (sampled last: the mixer leaves the bones posed)
    if (want.includes('Charge')) {
      const contact = opts.clips.Charge.events.contact;
      const mixer = new AnimationMixer(gltf.scene);
      mixer.clipAction(clips.Charge).play();
      const prop = [...bones.values()].filter((b) => /^Prop_R(_\d+)?$/.test(b.name) && rigs.some((r) => r.names.has(b.name) && r.carried));
      expect(prop.length).toBeGreaterThanOrEqual(1);
      const rel = (f) => {
        mixer.setTime(f / FPS); gltf.scene.updateMatrixWorld(true);
        return prop.map((b) => { let top = b; while (top.parent?.isBone) top = top.parent; return new Matrix4().copy(top.matrixWorld).invert().multiply(b.matrixWorld); });
      };
      const a = rel(contact); const b = rel(contact + 1);
      a.forEach((m, i) => m.elements.forEach((x, k) => expect(Math.abs(x - b[i].elements[k]), 'Charge weapon held').toBeLessThan(1e-3)));
    }
  }, 60000);
});
