import { describe, it, expect } from 'vitest';
import { pickProceduralEvent } from './proceduralEvents';
import { createInitialState } from '../context/GameContext';
import { createRng } from '../utils/rng';
import { GamePhases } from './types';

const postStateBase = () => ({
  ...createInitialState(),
  phase: GamePhases.POST_STATE,
  year: 2050,
  turnNumber: 42
});

describe('pickProceduralEvent', () => {
  it('falls back to a nation-agnostic template when no non-player nations exist', () => {
    // tech_grant and refugee_crisis have no nation prerequisite, so they stay eligible even
    // with an empty world — only the nation-targeting templates (border_skirmish, trade
    // delegation, diplomatic_summit, espionage_scare) should ever be excluded here.
    const state = { ...postStateBase(), nations: { player: postStateBase().nations.player } };
    for (let seed = 0; seed < 30; seed++) {
      const event = pickProceduralEvent(state, createRng(seed));
      expect(event).not.toBeNull();
      expect(event.options.every(o => !o.effects.nationHostility)).toBe(true);
    }
  });

  it('returns a well-shaped event object when at least one template is eligible', () => {
    const state = postStateBase(); // default nations include several non-player, non-at-war nations
    const event = pickProceduralEvent(state, createRng(7));
    expect(event).not.toBeNull();
    expect(typeof event.id).toBe('string');
    expect(event.id.startsWith('procedural_')).toBe(true);
    expect(event.phase).toBe(GamePhases.POST_STATE);
    expect(event.mandatory).toBe(false);
    expect(event.procedural).toBe(true);
    expect(typeof event.title).toBe('string');
    expect(typeof event.description).toBe('string');
    expect(event.options.length).toBeGreaterThanOrEqual(2);
    event.options.forEach(opt => {
      expect(typeof opt.label).toBe('string');
      expect(typeof opt.effects).toBe('object');
    });
  });

  it('embeds the turn number in the id so repeated firings never collide', () => {
    const state = postStateBase();
    const a = pickProceduralEvent({ ...state, turnNumber: 10 }, createRng(3));
    const b = pickProceduralEvent({ ...state, turnNumber: 11 }, createRng(3));
    expect(a.id).not.toBe(b.id);
  });

  it('a border_skirmish/trade_delegation/diplomatic_summit/espionage_scare target nation always exists in state.nations', () => {
    const state = postStateBase();
    for (let seed = 0; seed < 50; seed++) {
      const event = pickProceduralEvent(state, createRng(seed));
      if (!event) continue;
      const hostilityEffect = event.options.map(o => o.effects.nationHostility).find(Boolean);
      if (!hostilityEffect) continue;
      const [nationId] = Object.keys(hostilityEffect);
      expect(state.nations[nationId]).toBeDefined();
    }
  });

  it('is deterministic given the same state and seed', () => {
    const state = postStateBase();
    const a = pickProceduralEvent(state, createRng(99));
    const b = pickProceduralEvent(state, createRng(99));
    expect(a).toEqual(b);
  });
});
