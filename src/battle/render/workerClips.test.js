// The five base workers' authored clips (manifest rows U06, AN15, AN16, MD07; the art contract of
// plans/art/clip-animation-pipeline.md section 7): every worker GLB carries the twelve clips at 20 fps
// with frame counts that match its options file, the tool bones are there and shown by scale only in
// the clips that use them, Idle frame 1 shows the held tool only (the rest pose the game bakes), loops
// close, and the options file lists the events.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Quaternion } from 'three';

const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
const CLIPS = ['Idle', 'Walk', 'Run', 'Carry', 'Chop', 'Mine', 'Harvest', 'Build', 'Repair', 'Deposit', 'Hit', 'Death'];
const LOOPS = ['Idle', 'Walk', 'Run', 'Carry', 'Chop', 'Mine', 'Harvest', 'Build', 'Repair'];
const EVENTS = { Chop: 'contact', Mine: 'contact', Build: 'contact', Repair: 'contact', Harvest: 'cut', Deposit: 'pour', Death: 'settle' };
const TOOLS = { Chop: 'Axe', Mine: 'Pick', Harvest: 'Sickle' };
const FPS = 20;

const bytes = (name) => { const b = readFileSync(`src/assets/units/${name}.glb`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const load = async (name) => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(bytes(name), '');
};
const track = (clip, node, path) => clip.tracks.find((t) => t.name === `${node}.${path}`);
// a scale track's x at a key (a missing track means the bind value, 1)
const scaleAt = (clip, node, key) => { const t = track(clip, node, 'scale'); return t ? t.values[(key < 0 ? t.times.length + key : key) * 3] : 1; };

describe.each(AGES)('%s worker clips', (age) => {
  const name = `${age}-worker`;
  const opts = JSON.parse(readFileSync(`src/assets/units/${name}.json`, 'utf8'));

  it('lists every clip with its loop flag, tool and events in the options file', () => {
    expect(opts.restClip).toBe('^Idle$');
    expect(Object.keys(opts.clips)).toEqual(CLIPS);
    CLIPS.forEach((c) => {
      const info = opts.clips[c];
      expect(info.fps).toBe(FPS);
      expect(info.loop, c).toBe(LOOPS.includes(c));
      expect(info.frames, c).toBeGreaterThanOrEqual(8);
      expect(info.frames, c).toBeLessThanOrEqual(60);
      if (TOOLS[c]) expect(info.tool, c).toBe(TOOLS[c]);
      if (EVENTS[c]) {
        const f = info.events?.[EVENTS[c]];
        expect(f, `${c} ${EVENTS[c]}`).toBeGreaterThanOrEqual(1);
        expect(f, `${c} ${EVENTS[c]}`).toBeLessThanOrEqual(info.frames);
      }
    });
    expect(opts.clips.Death.events.settle).toBe(opts.clips.Death.frames);
    expect(['Hammer', 'Held']).toContain(opts.clips.Build.tool);
  });

  it('carries the clips at 20 fps, the tool bones, and shows each tool only where it is used', async () => {
    const gltf = await load(name);
    const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    expect(Object.keys(clips).sort()).toEqual([...CLIPS].sort());
    const bones = new Set(); gltf.scene.traverse((o) => { if (o.isBone) bones.add(o.name); });
    ['Root', 'Hips', 'Chest', 'Hand_R', 'Prop_R', 'Prop_Back', 'Tool_Held', 'Tool_Axe', 'Tool_Pick', 'Tool_Sickle'].forEach((b) => expect(bones.has(b), b).toBe(true));
    const tools = [...bones].filter((b) => /^Tool_/.test(b) && b !== 'Tool_Wheel');
    expect(bones.size).toBeLessThanOrEqual(128);
    CLIPS.forEach((c) => {
      const clip = clips[c]; const info = opts.clips[c];
      // frame f sits at f / 20 s: frame 1 at 0.05 s, the last at frames / 20
      const times = clip.tracks.reduce((m, t) => (t.times.length > m.length ? t.times : m), []);
      expect(times.length, c).toBe(info.frames);
      expect(times[0], c).toBeCloseTo(1 / FPS, 4);
      expect(times[times.length - 1], c).toBeCloseTo(info.frames / FPS, 4);
      const want = info.tool === 'Held' ? 'Tool_Held' : `Tool_${info.tool}`;
      expect(bones.has(want), c).toBe(true);
      tools.forEach((t) => expect(scaleAt(clip, t, 0), `${c} ${t}`).toBe(t === want ? 1 : 0));
      if (info.loop) {
        clip.tracks.forEach((t) => {
          const n = t.getValueSize(); const last = t.values.length - n;
          if (/quaternion$/.test(t.name)) {
            const a = new Quaternion().fromArray(t.values, 0); const b = new Quaternion().fromArray(t.values, last);
            expect(Math.abs(a.dot(b)), `${c} ${t.name} closes`).toBeGreaterThan(0.9999);
          } else for (let k = 0; k < n; k++) expect(t.values[last + k], `${c} ${t.name} closes`).toBeCloseTo(t.values[k], 4);
        });
      }
    });
    // Idle frame 1 is the rest pose: the bones at their bind rotations within a degree (the rig's round
    // trip through Blender's edit mode; the baked rest geometry itself is unchanged), Root lifted at most 1 mm
    const idle = clips.Idle;
    gltf.scene.traverse((o) => {
      if (!o.isBone) return;
      const q = track(idle, o.name, 'quaternion');
      if (q) expect(Math.abs(new Quaternion().fromArray(q.values, 0).dot(o.quaternion)), o.name).toBeGreaterThan(0.99996);
      const p = track(idle, o.name, 'position');
      if (p) expect(Math.hypot(p.values[0] - o.position.x, p.values[1] - o.position.y, p.values[2] - o.position.z), o.name).toBeLessThan(0.0015);
    });
    // Death ends lying down: the root turned most of the way to the ground
    const root = track(clips.Death, 'Root', 'quaternion');
    const end = new Quaternion().fromArray(root.values, root.values.length - 4);
    expect(2 * Math.acos(Math.min(1, Math.abs(end.w))) * 180 / Math.PI).toBeGreaterThan(70);
  }, 60000);
});
