import { describe, it, expect } from 'vitest';
import { EVENT_CHAINS } from './eventChains';

describe('EVENT_CHAINS', () => {
  it('every entry is shaped like a playable event', () => {
    Object.entries(EVENT_CHAINS).forEach(([key, event]) => {
      expect(event.id).toBe(key);
      expect(typeof event.title).toBe('string');
      expect(typeof event.description).toBe('string');
      expect(Array.isArray(event.options)).toBe(true);
      expect(event.options.length).toBeGreaterThan(0);
      event.options.forEach(option => {
        expect(typeof option.label).toBe('string');
        expect(option.effects).toBeTruthy();
      });
    });
  });

  it('has no fixed calendar year, since it fires on a turn delay rather than a date', () => {
    Object.values(EVENT_CHAINS).forEach(event => {
      expect(event.year).toBeUndefined();
    });
  });
});
