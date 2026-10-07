// The battle's player cues and unit voices: which bark answers a selection or an order, which
// sound an order makes, the alerts read from the sim's events and the economy's frames.
import { describe, it, expect } from 'vitest';
import { dominantClass, voiceForOrders, voiceForSelection } from './voiceLines';
import { cueForEvent, orderSound, frameAlerts } from './battleAudio';
import { BATTLE_SOUNDS, battleFilesFor } from '../../audio/soundRegistry';

const squads = [
  { idx: 0, classId: 'infantry', side: 0 }, { idx: 1, classId: 'infantry', side: 0 }, { idx: 2, classId: 'ranged', side: 0 },
  { idx: 3, classId: 'worker', side: 0 }, { idx: 4, classId: 'cavalry', side: 0, unitId: 'gen_c1' }, { idx: 5, classId: 'infantry', side: 1 }
];

describe('unit voices', () => {
  it('the class most of the group shares answers', () => {
    expect(dominantClass([0, 1, 2], squads)).toBe('infantry');
    expect(dominantClass([2], squads)).toBe('ranged');
    expect(dominantClass([], squads)).toBeNull();
  });

  it('a new selection is answered, the same group again is not', () => {
    expect(voiceForSelection([0, 1], [], squads)).toEqual({ classId: 'infantry', kind: 'select' });
    expect(voiceForSelection([0, 1], [1, 0], squads)).toBeNull();
    expect(voiceForSelection([], [0], squads)).toBeNull();
  });

  it('an attack is shouted, a move or a task acknowledged, a rally point or a power left silent', () => {
    expect(voiceForOrders([{ type: 'attack', squads: [2], target: {} }], squads)).toEqual({ classId: 'ranged', kind: 'attack' });
    expect(voiceForOrders([{ type: 'move', squads: [0, 1] }], squads)).toEqual({ classId: 'infantry', kind: 'order' });
    expect(voiceForOrders([{ type: 'gather', squads: [3] }, { type: 'move', squads: [0] }], squads)).toEqual({ classId: 'worker', kind: 'order' });
    expect(voiceForOrders([{ type: 'rally', building: 1 }], squads)).toBeNull();
    expect(voiceForOrders([{ type: 'power', power: 'rallyCry' }], squads)).toBeNull();
  });
});

describe('battle cues', () => {
  it('each order has its sound', () => {
    expect(orderSound([{ type: 'move' }])).toBe('order-move');
    expect(orderSound([{ type: 'attackMove' }])).toBe('order-attack');
    expect(orderSound([{ type: 'build' }])).toBe('building-placed');
    expect(orderSound([{ type: 'gather' }])).toBe('worker-task');
    expect(orderSound([{ type: 'repair' }])).toBe('worker-task');
    expect(orderSound([{ type: 'retreatAll' }])).toBe('retreat-horn');
    expect(orderSound([{ type: 'stop' }])).toBe('order-click');
    expect(orderSound()).toBe('order-click');
  });

  it('the player hears their economy, their walls falling, powers and a general struck down', () => {
    const view = { squads, structures: [{ id: 'gate1', kind: 'gate' }, { id: 'wall2', kind: 'wall' }, { id: 'b_market', kind: 'building' }] };
    expect(cueForEvent({ type: 'trained', side: 0 }, view, 0)).toBe('squad-trained');
    expect(cueForEvent({ type: 'trained', side: 1 }, view, 0)).toBeNull();
    expect(cueForEvent({ type: 'built', side: 0, kind: 'house' }, view, 0)).toBe('house-built');
    expect(cueForEvent({ type: 'built', side: 0, kind: 'barracks' }, view, 0)).toBe('building-finished');
    expect(cueForEvent({ type: 'structureDestroyed', structure: 'gate1' }, view, 0)).toBe('gate-breached');
    expect(cueForEvent({ type: 'structureDestroyed', structure: 'wall2' }, view, 0)).toBe('wall-destroyed');
    expect(cueForEvent({ type: 'structureDestroyed', structure: 'b_market' }, view, 0)).toBeNull();
    expect(cueForEvent({ type: 'keepBreached', structure: 'keep' }, view, 0)).toBe('gate-breached');
    expect(cueForEvent({ type: 'power', power: 'rallyCry' }, view, 0)).toBe('rally-cry');
    expect(cueForEvent({ type: 'power', power: 'arrowStorm' }, view, 0)).toBe('power-used');
    expect(cueForEvent({ type: 'destroyed', id: 4 }, view, 0)).toBe('general-killed');
    expect(cueForEvent({ type: 'destroyed', id: 0 }, view, 0)).toBeNull();
  });

  it('alerts from the economy: housing full once, a resource worked out (not hidden by fog)', () => {
    const queue = (blocked) => ({ buildings: [{ queue: [{ blocked }] }], nodes: [] });
    expect(frameAlerts(queue(null), queue('housing'))).toEqual(['housing-full']);
    expect(frameAlerts(queue('housing'), queue('housing'))).toEqual([]);
    const before = { buildings: [], nodes: [{ i: 1, amount: 3, max: 100 }, { i: 2, amount: 80, max: 100 }] };
    expect(frameAlerts(before, { buildings: [], nodes: [{ i: 2, amount: 80, max: 100 }] })).toEqual(['node-depleted']);
    expect(frameAlerts(before, { buildings: [], nodes: [{ i: 1, amount: 3, max: 100 }] })).toEqual([]);
    expect(frameAlerts(null, null)).toEqual([]);
  });

  it('every new battle cue is registered with recordings', () => {
    ['order-move', 'order-attack', 'worker-task', 'building-placed', 'building-finished', 'house-built', 'squad-trained', 'housing-full',
      'node-depleted', 'under-attack', 'gate-breached', 'wall-destroyed', 'retreat-horn', 'rally-cry', 'power-used', 'general-killed']
      .forEach((id) => { expect(BATTLE_SOUNDS[id], id).toBeTruthy(); expect(battleFilesFor(id).length, id).toBeGreaterThanOrEqual(1); });
  });
});
