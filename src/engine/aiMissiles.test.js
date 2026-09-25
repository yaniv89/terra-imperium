import { describe, it, expect } from 'vitest';
import { processAIAbmDefense, AI_ABM_TARGET_LEVEL } from './aiMissiles';

const makeNation = (overrides = {}) => ({
  name: 'Test Nation',
  isPlayer: false,
  economy: { gold: 1000, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 10 },
  abmDefenseLevel: 0,
  missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 0 },
  ...overrides
});

describe('processAIAbmDefense (plan §M19)', () => {
  it('builds one ABM level for a nation at war with a nuclear-armed enemy', () => {
    const nations = {
      de: makeNation(),
      fr: makeNation({ missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 3 } })
    };
    const state = { wars: [{ aggressor: 'de', enemy: 'fr', active: true }] };
    const { nations: next } = processAIAbmDefense(state, nations);
    expect(next.de.abmDefenseLevel).toBe(1);
    expect(next.de.economy.gold).toBe(1000 - 500);
    expect(next.de.economy.mil).toBe(10 - 2);
  });

  it('does nothing for a nation not at war with anyone nuclear-armed', () => {
    const nations = { de: makeNation(), fr: makeNation() };
    const state = { wars: [{ aggressor: 'de', enemy: 'fr', active: true }] };
    const { nations: next } = processAIAbmDefense(state, nations);
    expect(next.de.abmDefenseLevel).toBe(0);
  });

  it('does nothing for an inactive (closed) war even against a nuclear power', () => {
    const nations = { de: makeNation(), fr: makeNation({ missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 3 } }) };
    const state = { wars: [{ aggressor: 'de', enemy: 'fr', active: false }] };
    const { nations: next } = processAIAbmDefense(state, nations);
    expect(next.de.abmDefenseLevel).toBe(0);
  });

  it('never builds past the AI\'s own target level (1-2), unlike the player\'s own higher cap', () => {
    const nations = {
      de: makeNation({ abmDefenseLevel: AI_ABM_TARGET_LEVEL }),
      fr: makeNation({ missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 3 } })
    };
    const state = { wars: [{ aggressor: 'de', enemy: 'fr', active: true }] };
    const { nations: next } = processAIAbmDefense(state, nations);
    expect(next.de.abmDefenseLevel).toBe(AI_ABM_TARGET_LEVEL);
  });

  it('never spends a nation into the negative — no-op when it cannot afford the cost', () => {
    const nations = {
      de: makeNation({ economy: { gold: 10, mil: 0 } }),
      fr: makeNation({ missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 3 } })
    };
    const state = { wars: [{ aggressor: 'de', enemy: 'fr', active: true }] };
    const { nations: next } = processAIAbmDefense(state, nations);
    expect(next.de.abmDefenseLevel).toBe(0);
    expect(next.de.economy.gold).toBe(10);
  });

  it('leaves the player nation and any nation without a real economy untouched', () => {
    const nations = {
      us: { ...makeNation({ missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 3 } }), isPlayer: true },
      legacy: { name: 'Legacy Fixture', abmDefenseLevel: 0 } // no `economy` field at all
    };
    const state = { wars: [{ aggressor: 'legacy', enemy: 'us', active: true }] };
    const { nations: next } = processAIAbmDefense(state, nations);
    expect(next.legacy.abmDefenseLevel).toBe(0);
  });
});
