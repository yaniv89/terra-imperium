import { describe, it, expect } from 'vitest';
import { immutableCtx, draftCtx } from './ctx';
import { LogTypes } from '../../data/types';
import { peoplesWorld, rivalOf } from '../testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 11 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

const withAiEconomy = (state, nationId, economy) => ({
  ...state,
  nations: { ...state.nations, [nationId]: { ...state.nations[nationId], economy } }
});

describe('immutableCtx', () => {
  it('commit() returns the exact same state reference when nothing was read or written', () => {
    const state = peoplesWorld();
    const ctx = immutableCtx(state);
    ctx.readRegion('fr-75'); // reads never trigger a copy
    ctx.readNation(DE_ID);
    expect(ctx.commit()).toBe(state);
  });

  it('writeRegion copies the regions bucket once, leaving untouched regions\' own references intact', () => {
    const state = peoplesWorld();
    const untouchedRegion = state.regions['fr-62'];
    const ctx = immutableCtx(state);
    ctx.writeRegion('fr-75', { ...ctx.readRegion('fr-75'), control: 42 });
    const next = ctx.commit();
    expect(next).not.toBe(state);
    expect(next.regions['fr-75'].control).toBe(42);
    expect(next.regions['fr-62']).toBe(untouchedRegion); // shallow copy, not a deep clone
  });

  it('writePool for the player updates state.resources directly', () => {
    const state = peoplesWorld();
    const ctx = immutableCtx(state);
    ctx.writePool(FR_ID, { ...ctx.readPool(FR_ID), gold: 12345 });
    const next = ctx.commit();
    expect(next.resources.gold).toBe(12345);
  });

  it('writePool for an AI nation updates nations[id].economy, not state.resources', () => {
    const state = peoplesWorld();
    const ctx = immutableCtx(state);
    ctx.writePool(DE_ID, { gold: 500 });
    const next = ctx.commit();
    expect(next.nations[DE_ID].economy).toEqual({ gold: 500 });
    expect(next.resources).toBe(state.resources); // the player's own pool is untouched
  });

  it('appends log() entries on commit, dated to the state\'s current year', () => {
    const state = peoplesWorld();
    const ctx = immutableCtx(state);
    ctx.log('Something happened', LogTypes.ACTION);
    const next = ctx.commit();
    expect(next.logs[next.logs.length - 1]).toEqual({ year: state.year, message: 'Something happened', type: LogTypes.ACTION });
  });

  it('writeNation copies the nations bucket once, leaving untouched nations\' own references intact', () => {
    const state = peoplesWorld();
    const untouchedNation = state.nations.es;
    const ctx = immutableCtx(state);
    ctx.writeNation(DE_ID, { ...ctx.readNation(DE_ID), hostility: 99 });
    const next = ctx.commit();
    expect(next.nations[DE_ID].hostility).toBe(99);
    expect(next.nations.es).toBe(untouchedNation);
  });
});

describe('draftCtx', () => {
  it('mutates the exact regions/nations buckets it was given, in place', () => {
    const state = peoplesWorld();
    const regions = { ...state.regions };
    const nations = { ...state.nations };
    const ctx = draftCtx(state, regions, nations);
    ctx.writeRegion('de-sn', { ...ctx.readRegion('de-sn'), control: 7 });
    expect(regions['de-sn'].control).toBe(7); // the caller's own object was mutated directly
  });

  it('throws if a handler tries to write the player\'s own pool', () => {
    const state = peoplesWorld();
    const ctx = draftCtx(state, { ...state.regions }, { ...state.nations });
    expect(() => ctx.writePool(FR_ID, { gold: 1 })).toThrow();
  });

  it('writePool for an AI nation updates the nations bucket it was given', () => {
    const state = peoplesWorld();
    const nations = { ...state.nations };
    const ctx = draftCtx(state, { ...state.regions }, nations);
    ctx.writePool(DE_ID, { gold: 250 });
    expect(nations[DE_ID].economy).toEqual({ gold: 250 });
  });

  it('getResearched/getTechAgeId route to state.techTree for the player and to nation.tech for AI', () => {
    const base = peoplesWorld();
    const state = withAiEconomy(base, DE_ID, { gold: 0 });
    const withTech = { ...state, nations: { ...state.nations, [DE_ID]: { ...state.nations[DE_ID], tech: { researched: ['de_x'], ageId: 'classical' } } } };
    const ctx = draftCtx(withTech, { ...withTech.regions }, { ...withTech.nations });
    expect(ctx.getResearched(DE_ID)).toEqual(['de_x']);
    expect(ctx.getTechAgeId(DE_ID)).toBe('classical');
    expect(ctx.getTechAgeId(FR_ID)).toBe(withTech.techAgeId);
  });

  it('log() is a no-op (the AI phase logs notable actions itself, not every micro-decision)', () => {
    const state = peoplesWorld();
    const ctx = draftCtx(state, { ...state.regions }, { ...state.nations });
    expect(() => ctx.log('anything', 'action')).not.toThrow();
  });
});
