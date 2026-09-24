import { describe, it, expect, afterEach } from 'vitest';
import { registerNationAction, applyNationAction, _resetForTests } from './index';

describe('registerNationAction / applyNationAction', () => {
  afterEach(() => _resetForTests());

  it('calls the registered handler with (ctx, actorId, payload) and returns its result', () => {
    let received = null;
    registerNationAction('TEST_ACTION', (ctx, actorId, payload) => {
      received = { ctx, actorId, payload };
      return true;
    });
    const ctx = { some: 'ctx' };
    const result = applyNationAction(ctx, 'fr', { type: 'TEST_ACTION', payload: { foo: 1 } });
    expect(result).toBe(true);
    expect(received).toEqual({ ctx, actorId: 'fr', payload: { foo: 1 } });
  });

  it('returns false for an action type with no registered handler', () => {
    expect(applyNationAction({}, 'fr', { type: 'NOT_REGISTERED' })).toBe(false);
  });

  it('propagates a handler returning false (a rejected/guarded action)', () => {
    registerNationAction('TEST_REJECT', () => false);
    expect(applyNationAction({}, 'fr', { type: 'TEST_REJECT' })).toBe(false);
  });
});
