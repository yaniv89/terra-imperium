import { describe, it, expect } from 'vitest';
import { migrateSave, backfillDefaults, CURRENT_SAVE_VERSION } from './saveMigrations';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import saveV1Fixture from './__fixtures__/save-v1.json';

// A quick, cheap check that every numeric leaf in a state tree is a finite number — used to catch
// a migration silently producing NaN/Infinity rather than asserting every field by name.
const collectNumericLeaves = (value, out = []) => {
  if (typeof value === 'number') { out.push(value); return out; }
  if (Array.isArray(value)) { value.forEach((v) => collectNumericLeaves(v, out)); return out; }
  if (value && typeof value === 'object') { Object.values(value).forEach((v) => collectNumericLeaves(v, out)); }
  return out;
};

describe('backfillDefaults', () => {
  it('fills a missing top-level field without touching anything else', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    // eslint-disable-next-line no-unused-vars -- destructured only to omit it from withoutTurnNumber
    const { turnNumber, ...withoutTurnNumber } = fresh;
    const result = backfillDefaults(withoutTurnNumber);
    expect(result.turnNumber).toBe(1);
    expect(result.year).toBe(fresh.year);
  });

  it('fills a missing nested region field without touching present ones', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const capital = 'fr-75';
    // eslint-disable-next-line no-unused-vars -- destructured only to omit it from regionWithoutDefense
    const { defenseLevel, ...regionWithoutDefense } = fresh.regions[capital];
    const damaged = { ...fresh, regions: { ...fresh.regions, [capital]: { ...regionWithoutDefense, control: 42 } } };
    const result = backfillDefaults(damaged);
    expect(result.regions[capital].defenseLevel).toBe(0);
    expect(result.regions[capital].control).toBe(42); // present value untouched
  });

  it('never overwrites a present falsy value (0, false, null)', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const capital = 'fr-75';
    const zeroed = { ...fresh, regions: { ...fresh.regions, [capital]: { ...fresh.regions[capital], control: 0, underInvasion: false } } };
    const result = backfillDefaults(zeroed);
    expect(result.regions[capital].control).toBe(0);
    expect(result.regions[capital].underInvasion).toBe(false);
  });

  it('never overwrites region identity fields (owner) from the fresh template', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const capital = 'fr-75';
    const conquered = { ...fresh, regions: { ...fresh.regions, [capital]: { ...fresh.regions[capital], owner: 'de' } } };
    const result = backfillDefaults(conquered);
    expect(result.regions[capital].owner).toBe('de');
  });

  it('is idempotent: backfilling an already-complete state changes nothing', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const once = backfillDefaults(fresh);
    const twice = backfillDefaults(once);
    expect(twice).toEqual(once);
  });
});

describe('migrateSave', () => {
  it('migrates the real, trimmed v1 fixture to a valid current-version state', () => {
    const result = migrateSave(saveV1Fixture);
    expect(result).not.toBeNull();
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.state.playerNationId).toBe('fr');
    expect(Object.keys(result.state.regions).length).toBeGreaterThan(0);
    expect(Object.keys(result.state.nations).length).toBeGreaterThan(0);
  });

  it('produces a state with no NaN/Infinity leaves', () => {
    const result = migrateSave(saveV1Fixture);
    const leaves = collectNumericLeaves(result.state);
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every(Number.isFinite)).toBe(true);
  });

  it('produces a state that survives 5 more turns with no NaN/Infinity leaves', () => {
    let state = migrateSave(saveV1Fixture).state;
    for (let i = 0; i < 5; i++) {
      state = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    }
    const leaves = collectNumericLeaves(state);
    expect(leaves.every(Number.isFinite)).toBe(true);
  });

  it('is idempotent: migrating an already-current save changes nothing further', () => {
    const once = migrateSave(saveV1Fixture);
    const twice = migrateSave(once);
    expect(twice.state).toEqual(once.state);
  });

  it('accepts a bare state object with no {version, state} envelope (a legacy raw import)', () => {
    const fresh = createInitialState({ playerNationId: 'de' });
    const result = migrateSave(fresh);
    expect(result).not.toBeNull();
    expect(result.state.playerNationId).toBe('de');
  });

  it('returns null for a save from a newer build than this one knows how to read', () => {
    const result = migrateSave({ version: CURRENT_SAVE_VERSION + 1, state: createInitialState() });
    expect(result).toBeNull();
  });

  it('returns null for garbage input, without throwing', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave(undefined)).toBeNull();
    expect(migrateSave('not an object')).toBeNull();
    expect(migrateSave({})).toBeNull();
    expect(migrateSave({ version: 1, state: { not: 'a real state' } })).toBeNull();
  });

  it('backfills a fresh top-level field missing from an otherwise-valid save', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    // eslint-disable-next-line no-unused-vars -- destructured only to omit it from trimmed
    const { orbitalDebrisLevel, ...trimmed } = fresh;
    const result = migrateSave({ version: 1, state: trimmed });
    expect(result.state.orbitalDebrisLevel).toBe(0);
  });
});
