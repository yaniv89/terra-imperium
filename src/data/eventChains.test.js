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

  it('never spawns a follow-up that points at a nonexistent chain entry', () => {
    Object.values(EVENT_CHAINS).forEach(event => {
      event.options.forEach(option => {
        const followUp = option.effects.spawnFollowUp;
        if (followUp) expect(EVENT_CHAINS[followUp.id]).toBeDefined();
      });
    });
  });

  it('never references a specific nation or region — spawnFollowUp carries no per-instance payload, so a chain step can\'t know who triggered it', () => {
    const identitySpecificKeys = ['captureRegions', 'returnRegion', 'peaceWith', 'tradeWith', 'warWith', 'nationHostility'];
    Object.values(EVENT_CHAINS).forEach(event => {
      event.options.forEach(option => {
        identitySpecificKeys.forEach(key => expect(option.effects).not.toHaveProperty(key));
      });
    });
  });

  it('spans at least 3 distinct multi-step storylines (plan §9.5\'s "3-5")', () => {
    const chainRoots = new Set(Object.keys(EVENT_CHAINS).map(id => id.replace(/_\d+$/, '')));
    expect(chainRoots.size).toBeGreaterThanOrEqual(3);
  });
});
