import { describe, it, expect } from 'vitest';
import { scrollHintOf } from './useScrollHint';

describe('scroll hint', () => {
  it('names the edges with chips hidden past them, left to right and right to left', () => {
    expect(scrollHintOf({ scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })).toBe('');
    expect(scrollHintOf({ scrollWidth: 500, clientWidth: 300, scrollLeft: 0 })).toBe('end');
    expect(scrollHintOf({ scrollWidth: 500, clientWidth: 300, scrollLeft: 100 })).toBe('start end');
    expect(scrollHintOf({ scrollWidth: 500, clientWidth: 300, scrollLeft: 200 })).toBe('start');
    expect(scrollHintOf({ scrollWidth: 500, clientWidth: 300, scrollLeft: -200 })).toBe('start');
  });
});
