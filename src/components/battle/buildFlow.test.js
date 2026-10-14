// The build sheet / placement / cancel state machine (CB15: U02, U05, U13, I177 to I184).
import { describe, it, expect } from 'vitest';
import { buildFlowNext, BUILD_FLOW_CLOSED, closePrecedence } from './buildFlow';

const run = (events, s = BUILD_FLOW_CLOSED) => events.reduce((st, e) => buildFlowNext(st, e), s);

describe('build flow', () => {
  it('the hammer opens the sheet; its X closes the sheet only', () => {
    expect(run([{ type: 'open' }])).toEqual({ sheet: true, placing: null, from: null });
    expect(run([{ type: 'open' }, { type: 'close' }]).sheet).toBe(false);
    expect(run([{ type: 'toggle' }, { type: 'toggle' }]).sheet).toBe(false);
  });

  it('U13: picking hides the sheet, a placement reopens it once and arms nothing', () => {
    const placing = run([{ type: 'open' }, { type: 'pick', building: 'barracks' }]);
    expect(placing).toEqual({ sheet: false, placing: 'barracks', from: 'sheet' });
    const after = buildFlowNext(placing, { type: 'placed' });
    expect(after).toEqual({ sheet: true, placing: null, from: null });
    // a second "placed" (the same confirming tap seen twice) changes nothing more
    expect(buildFlowNext(after, { type: 'placed' })).toEqual({ sheet: false, placing: null, from: null });
  });

  it('cancelling returns to where the placement came from, without the sheet when it came from a panel', () => {
    expect(run([{ type: 'open' }, { type: 'pick', building: 'house' }, { type: 'cancel' }])).toEqual({ sheet: true, placing: null, from: null });
    expect(run([{ type: 'pick', building: 'house', from: 'panel' }, { type: 'cancel' }])).toEqual({ sheet: false, placing: null, from: null });
    expect(run([{ type: 'pick', building: 'house', from: 'panel' }, { type: 'placed' }]).sheet).toBe(false);
  });

  it('deselect clears placement and sheet; losing the laborers closes the sheet but keeps a placement', () => {
    expect(run([{ type: 'open' }, { type: 'pick', building: 'farm' }, { type: 'deselect' }])).toEqual(BUILD_FLOW_CLOSED);
    expect(run([{ type: 'open' }, { type: 'noWorkers' }]).sheet).toBe(false);
    expect(run([{ type: 'open' }, { type: 'pick', building: 'farm' }, { type: 'noWorkers' }]).placing).toBe('farm');
  });

  it('U05: the X cancels the armed action first, else clears the selection', () => {
    expect(closePrecedence({ armed: { type: 'place' } })).toBe('cancelArmed');
    expect(closePrecedence({ armed: 'attackMove' })).toBe('cancelArmed');
    expect(closePrecedence({ armed: null })).toBe('clearSelection');
  });
});
