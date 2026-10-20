// The Modern vehicles' authored clips (plans/art/clip-animation-pipeline.md section 7 and 7.4): every GLB carries
// Idle, Move, Fire, Hit, Wreck (and Death when it has a crew) at 20 fps with frame counts that match its options
// file, the `fire` and `settle` events, closed loops, every rig keyed in every clip, Idle frame 1 at rest, the
// hull in place, the wheels (or road wheels) turning in Move, the barrel recoiling along its bore in Fire and
// back at rest by the end, the Turret never keyed and the Barrel never rotated (the game aims them), the hulk
// and the fallen crews still at the end. The machine's bake options (footprint, budget) stay as they were.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Quaternion } from 'three';

const UNITS = {
  'modern-cavalry': { crew: 0, wheels: /^RoadWheel_/, footprint: [1.39, 3.45] },
  'modern-support': { crew: 1, wheels: /^Wheel_/, footprint: [1.44, 2.56] },
  'modern-general': { crew: 2, wheels: /^Wheel_/, footprint: [0.89, 1.39], gun: false },
  'modern-raider': { crew: 1, wheels: /^Wheel_/, footprint: [0.86, 1.97] },
  'modern-siege': { crew: 3, wheels: /^Wheel_/, footprint: [1.69, 2.92] },
  // the older machines (2026-10-20, ti_vehicle_clips.old_machine and trebuchet): a frame or a carriage on two wheels
  'classical-siege': { crew: 3, wheels: /^Wheel_/, footprint: [1.34, 1.56], gun: false },
  'kingdoms-siege': { crew: 3, wheels: /^Wheel_/, footprint: [1.9, 3.2], gun: false },
  'gunpowder-siege': { crew: 3, wheels: /^Wheel_/, footprint: [1.26, 1.67], gun: false }
};
const LOOPS = ['Idle', 'Move'];
const FPS = 20;

const bytes = (name) => { const b = readFileSync(`src/assets/units/${name}.glb`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const load = async (name) => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(bytes(name), '');
};
const track = (clip, node, path) => clip.tracks.find((t) => t.name === `${node}.${path}`);
const quat = (t, k) => new Quaternion().fromArray(t.values, Math.min(k, t.times.length - 1) * 4);
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI;

describe.each(Object.entries(UNITS))('%s clips', (name, spec) => {
  const opts = JSON.parse(readFileSync(`src/assets/units/${name}.json`, 'utf8'));
  const want = Object.keys(opts.clips || {});
  const set = ['Idle', 'Move', 'Fire', 'Hit', ...(spec.crew ? ['Death'] : []), 'Wreck'];

  it('lists its clips with loop flags and events, its machine options kept', () => {
    expect(opts.restClip).toBe('^Idle$');
    expect(want).toEqual(set);
    expect(opts.quadruped).toBe(false);
    expect(opts.footprint).toEqual(spec.footprint);
    expect(opts.triangleBudget).toBe(6000);
    want.forEach((c) => {
      const info = opts.clips[c];
      expect(info.fps, c).toBe(FPS);
      expect(info.loop, c).toBe(LOOPS.includes(c));
      expect(info.frames, c).toBeGreaterThanOrEqual(10);
      expect(info.frames, c).toBeLessThanOrEqual(60);
    });
    expect(opts.clips.Fire.events.fire).toBeGreaterThanOrEqual(1);
    expect(opts.clips.Fire.events.fire).toBeLessThan(opts.clips.Fire.frames);
    ['Death', 'Wreck'].filter((c) => want.includes(c)).forEach((c) => expect(opts.clips[c].events.settle).toBe(opts.clips[c].frames));
  });

  it('carries the clips over every rig: closed loops, Idle at rest, in place, wheels, recoil, the aim left free', async () => {
    const gltf = await load(name);
    const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    expect(Object.keys(clips).sort()).toEqual([...want].sort());
    const bones = new Map(); gltf.scene.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
    const rest = new Map([...bones].map(([n, b]) => [n, { p: b.position.clone(), q: b.quaternion.clone() }]));
    const rigs = [...bones.values()].filter((b) => !b.parent?.isBone).map((top) => {
      const names = new Set(); top.traverse((o) => { if (o.isBone) names.add(o.name); });
      return { top, names };
    });
    expect(rigs.length).toBe(1 + spec.crew);
    expect(bones.has('Hull')).toBe(true);
    const wheels = [...bones.keys()].filter((n) => spec.wheels.test(n));
    expect(wheels.length).toBeGreaterThanOrEqual(['modern-siege', 'classical-siege', 'kingdoms-siege', 'gunpowder-siege'].includes(name) ? 2 : 4); // (the howitzer and the older machines have one axle)
    want.forEach((c) => {
      const clip = clips[c]; const info = opts.clips[c];
      const times = clip.tracks.reduce((m, t) => (t.times.length > m.length ? t.times : m), []);
      expect(times.length, c).toBe(info.frames);
      expect(times[0], c).toBeCloseTo(1 / FPS, 4);
      expect(times[times.length - 1], c).toBeCloseTo(info.frames / FPS, 4);
      rigs.forEach((r) => expect(clip.tracks.some((t) => r.names.has(t.name.slice(0, t.name.lastIndexOf('.')))), `${c} keys ${r.top.name}`).toBe(true));
      // the game aims the gun: no Turret track at all, no Barrel rotation
      clip.tracks.forEach((t) => {
        expect(t.name.startsWith('Turret.'), `${c} ${t.name}`).toBe(false);
        expect(t.name, c).not.toBe('Barrel.quaternion');
      });
      if (info.loop) {
        clip.tracks.forEach((t) => {
          if (t.times.length !== info.frames) return;
          const n = t.getValueSize(); const a = 0; const b = info.frames - 1;
          if (/quaternion$/.test(t.name)) expect(Math.abs(quat(t, a).dot(quat(t, b))), `${c} ${t.name} closes`).toBeGreaterThan(0.9999);
          else for (let k = 0; k < n; k++) expect(Math.abs(t.values[a * n + k] - t.values[b * n + k]), `${c} ${t.name} closes`).toBeLessThan(1e-4);
        });
      }
      // in place: the hull's bone stays over its spot (it turns about the axles, a little off the bone)
      const h = track(clip, 'Hull', 'position');
      if (h) for (let k = 0; k < h.times.length; k++) expect(Math.hypot(h.values[k * 3] - rest.get('Hull').p.x, h.values[k * 3 + 2] - rest.get('Hull').p.z), c).toBeLessThan(0.05);
    });
    // Idle frame 1 is the rest pose of every rig
    bones.forEach((o, n) => {
      const q = track(clips.Idle, n, 'quaternion');
      if (q) expect(Math.abs(quat(q, 0).dot(rest.get(n).q)), n).toBeGreaterThan(0.99996);
      const t = track(clips.Idle, n, 'position');
      if (t) expect(Math.hypot(t.values[0] - rest.get(n).p.x, t.values[1] - rest.get(n).p.y, t.values[2] - rest.get(n).p.z), n).toBeLessThan(0.0015);
    });
    // Move: the wheels turn (a good part of a turn over the loop)
    wheels.forEach((w) => {
      const t = track(clips.Move, w, 'quaternion');
      expect(t, `Move ${w}`).toBeTruthy();
      let most = 0;
      for (let k = 0; k < t.times.length; k++) most = Math.max(most, angle(quat(t, k), rest.get(w).q));
      expect(most, `Move ${w} turns`).toBeGreaterThan(90);
    });
    // Fire: the barrel goes back along its bore and is home again by the end
    if (spec.gun !== false) {
      const p = track(clips.Fire, 'Barrel', 'position');
      expect(p, 'Fire Barrel').toBeTruthy();
      const r0 = rest.get('Barrel').p; const fire = opts.clips.Fire.events.fire;
      const d = (k) => Math.hypot(p.values[k * 3] - r0.x, p.values[k * 3 + 1] - r0.y, p.values[k * 3 + 2] - r0.z);
      expect(d(fire - 1), 'recoil at the shot').toBeGreaterThan(0.01);
      expect(d(p.times.length - 1), 'run out again').toBeLessThan(0.001);
      expect(d(0), 'at rest before the shot').toBeLessThan(0.001);
    }
    // the falls end still: every bone the same over the last three frames
    ['Death', 'Wreck'].filter((c) => want.includes(c)).forEach((c) => {
      clips[c].tracks.forEach((t) => {
        if (!/quaternion$/.test(t.name) || t.times.length < 3) return;
        const n = t.times.length;
        expect(Math.abs(quat(t, n - 1).dot(quat(t, n - 3))), `${c} ${t.name} still`).toBeGreaterThan(0.9999);
      });
    });
  }, 60000);
});
