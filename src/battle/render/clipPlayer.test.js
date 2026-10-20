// The clip player (I219): which clip a figure plays, cross-fades, and strikes timed on the sim's beat.
import { describe, it, expect } from 'vitest';
import { clipSetOf, newFigureState, playClip, writeAnim, baseMotion, strikeTiming, TILE_M, WALK_MPS, MOUNTED_TPS } from './clipPlayer';
import { WORK_JOB, WORK_NODE } from '../sim/economy';

const bakeOf = (clips) => ({
  clips: clips.map(([name, frames, loop, events]) => ({ name, frames, loop, events: events || {}, duration: (frames - 1) / 20 })),
  byName: Object.fromEntries(clips.map(([name], i) => [name, i]))
});
const WORKER = bakeOf([['Idle', 41, true], ['Walk', 21, true], ['Run', 15, true], ['Carry', 25, true], ['Chop', 33, true, { contact: 16 }], ['Mine', 29, true],
  ['Harvest', 37, true], ['Build', 25, true], ['Repair', 21, true], ['Deposit', 30, false, { pour: 15 }], ['Hit', 8, false], ['Death', 30, false]]);
const SPEAR = bakeOf([['Idle', 41, true], ['IdleAlt', 41, true], ['Walk', 21, true], ['Run', 15, true], ['Retreat-run', 15, true], ['Attack', 21, false, { contact: 10 }],
  ['Attack2', 25, false, { contact: 12 }], ['Hit', 8, false], ['Death', 30, false], ['DeathAlt', 30, false], ['Cheer', 33, true]]);
const code = (job, kind) => job + 8 * WORK_NODE.indexOf(kind);

describe('clip player', () => {
  it('maps motions to the clips a unit has, with fallbacks', () => {
    const w = clipSetOf(WORKER); const s = clipSetOf(SPEAR);
    expect(w.roles.chop).toBe(WORKER.byName.Chop);
    expect(w.roles.retreat).toBe(WORKER.byName.Run);
    expect(w.roles.attack).toBe(WORKER.byName.Chop); // a worker strikes with his work swing
    expect(s.roles.attack2).toBe(SPEAR.byName.Attack2);
    expect(s.roles.deathAlt).toBe(SPEAR.byName.DeathAlt);
    expect(s.strike[SPEAR.byName.Attack]).toBeCloseTo(10 / 20);
  });

  it('workers play their job: chop at a grove, mine at stone and gold, harvest at farms, pick, fish and herd, carry home', () => {
    const set = clipSetOf(WORKER);
    const m = (work, moving = false) => baseMotion(set, { worker: true, work, moving, speed: 1, simRate: 1 }).role;
    expect(m(code(WORK_JOB.gathering, 'tree'))).toBe('chop');
    expect(m(code(WORK_JOB.gathering, 'gold'))).toBe('mine');
    expect(m(code(WORK_JOB.gathering, 'farm'))).toBe('harvest');
    expect(m(code(WORK_JOB.waiting, 'tree'))).toBe('idle');
    expect(m(code(WORK_JOB.hauling, 'stone'), true)).toBe('carry');
    expect(m(code(WORK_JOB.toNode, 'stone'), true)).toBe('walk');
    expect(m(WORK_JOB.build)).toBe('build');
    expect(m(WORK_JOB.repair)).toBe('repair');
    // each food node its own work; a worker file without Pick, Fish or Herd plays its Harvest for them
    expect(m(code(WORK_JOB.gathering, 'berries'))).toBe('pick');
    expect(m(code(WORK_JOB.gathering, 'fish'))).toBe('fish');
    expect(m(code(WORK_JOB.gathering, 'herd'))).toBe('herd');
    expect(m(code(WORK_JOB.gathering, 'cattle'))).toBe('herd');
    expect(set.roles.pick).toBe(WORKER.byName.Harvest);
    expect(set.roles.fish).toBe(WORKER.byName.Harvest);
  });

  it('gaits follow the real speed: walk, run, and the rate scales the stride', () => {
    const set = clipSetOf(SPEAR);
    const walk = baseMotion(set, { moving: true, speed: WALK_MPS / TILE_M, simRate: 1 });
    expect(walk).toEqual({ role: 'walk', rate: 1 });
    expect(baseMotion(set, { moving: true, speed: 3 / TILE_M, simRate: 1 }).role).toBe('run');
    expect(baseMotion(set, { moving: true, routed: true, speed: 1, simRate: 1 }).role).toBe('retreat');
    expect(baseMotion(set, { won: true, speed: 0, simRate: 1 }).role).toBe('cheer');
  });

  it('horses walk, trot and gallop by speed at actual / natural pace; a chariot gallops on Move (section 7.3)', () => {
    const horse = clipSetOf(bakeOf([['Idle', 41, true], ['Walk', 21, true], ['Trot', 15, true], ['Gallop', 13, true], ['Charge', 41, false, { contact: 22 }], ['Attack', 21, false, { contact: 10 }], ['Death', 40, false]]));
    const m = (speed) => baseMotion(horse, { moving: true, speed, simRate: 1 });
    expect(m(0.52)).toEqual({ role: 'walk', rate: 1 });
    expect(m(1.29).role).toBe('trot');
    expect(m(3.0).role).toBe('gallop');
    expect(m(3.0).rate).toBeCloseTo(3.0 / MOUNTED_TPS.gallop);
    const chariot = clipSetOf(bakeOf([['Idle', 41, true], ['Move', 13, true], ['Charge', 41, false, { contact: 22 }], ['Archer-shoot', 30, false, { release: 20 }], ['Hit', 8, false], ['Wreck', 40, false]]));
    expect(chariot.chariot).toBe(true);
    expect(baseMotion(chariot, { moving: true, speed: 2.69, simRate: 1 })).toEqual({ role: 'gallop', rate: 1 });
    expect(chariot.roles.death).toBe(5);
    expect(chariot.roles.attack).toBe(3);
    // Charge: contact (frame 23) 1.1 s into the clip
    expect(horse.strike[horse.roles.charge]).toBeCloseTo(1.1);
  });

  it('a new clip cross-fades from the old one; the same loop at a new rate keeps its frame', () => {
    const st = newFigureState(2); const anim = new Float32Array(8); const prev = new Float32Array(8);
    playClip(st, 0, 1, 10, 1, 10);
    playClip(st, 0, 2, 12, 1, 12);
    writeAnim(st, 0, anim, prev, 0, 0.5);
    expect([...anim.slice(0, 4)]).toEqual([2, 12, 1, 0.5]);
    expect([...prev.slice(0, 4)]).toEqual([1, 10, 1, 12]);
    // the same loop at double speed: (now - start) x rate unchanged
    playClip(st, 0, 2, 99, 2, 14);
    writeAnim(st, 0, anim, prev, 0, 0);
    expect((14 - anim[1]) * anim[2]).toBeCloseTo((14 - 12) * 1);
    // a snap (shared pose) leaves no fade
    playClip(st, 1, 3, 5, 1, 5); playClip(st, 1, 4, 6, 1, 6, { fade: false, keepLoop: false });
    writeAnim(st, 1, anim, prev, 1, 0);
    expect(prev[7]).toBe(-1);
  });

  it('a strike is timed so its contact frame lands on the next strike', () => {
    const set = clipSetOf(SPEAR); const a = SPEAR.byName.Attack;
    const { start, rate } = strikeTiming(set, a, 100, 1.0);
    expect(start + set.strike[a] / rate).toBeCloseTo(101);
    // a clip longer than the attack period is sped up to fit it
    expect(strikeTiming(set, a, 0, 0.5).rate).toBeGreaterThan(1.9);
  });
});
