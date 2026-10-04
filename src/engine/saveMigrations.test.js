import { describe, it, expect } from 'vitest';
import { migrateSave, backfillDefaults, CURRENT_SAVE_VERSION, OLDEST_LOADABLE_SAVE_VERSION } from './saveMigrations';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import saveV1Fixture from './__fixtures__/save-v1.json';

const collectNumericLeaves = (value, out = []) => {
  if (typeof value === 'number') { out.push(value); return out; }
  if (Array.isArray(value)) { value.forEach((v) => collectNumericLeaves(v, out)); return out; }
  if (value && typeof value === 'object') { Object.values(value).forEach((v) => collectNumericLeaves(v, out)); }
  return out;
};

describe('backfillDefaults', () => {
  it('does not resurrect destroyed emergent starting armies on reload', () => {
    const fresh = createInitialState({ playerNationId: 'fr', rngSeed: 7, scenario: { mode: 'emergent', nationCount: 15, seed: 7 } });
    const { start_fr, ...units } = fresh.units; // eslint-disable-line no-unused-vars
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: { ...fresh, units } }).state;
    expect(loaded.units.start_fr).toBeUndefined();
    expect(Object.keys(loaded.nations)).toHaveLength(15);
  });

  it('fills a missing top-level field without touching anything else', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const { wars, ...withoutWars } = fresh; // eslint-disable-line no-unused-vars
    const result = backfillDefaults(withoutWars);
    expect(result.wars).toEqual([]);
    expect(result.playerNationId).toBe('fr');
  });

  it('fills a missing nested region field without touching present ones', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const capital = getNationCapital('fr');
    const { defenseLevel, ...regionWithoutDefense } = fresh.regions[capital]; // eslint-disable-line no-unused-vars
    const damaged = { ...fresh, regions: { ...fresh.regions, [capital]: { ...regionWithoutDefense, control: 42 } } };
    const result = backfillDefaults(damaged);
    expect(result.regions[capital].defenseLevel).toBe(0);
    expect(result.regions[capital].control).toBe(42);
  });

  it('never overwrites a present falsy value (0, false, null)', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const state = { ...fresh, activeEventId: null, turnNumber: 0, resources: { ...fresh.resources, gold: 0 } };
    const result = backfillDefaults(state);
    expect(result.activeEventId).toBeNull();
    expect(result.turnNumber).toBe(0);
    expect(result.resources.gold).toBe(0);
  });

  it('never overwrites region identity fields (owner) from the fresh template', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const capital = getNationCapital('fr');
    const conquered = { ...fresh, regions: { ...fresh.regions, [capital]: { ...fresh.regions[capital], owner: 'de' } } };
    expect(backfillDefaults(conquered).regions[capital].owner).toBe('de');
  });

  it('repairs a region record missing its own id field entirely', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const capital = getNationCapital('fr');
    const { id, ...withoutId } = fresh.regions[capital]; // eslint-disable-line no-unused-vars
    const result = backfillDefaults({ ...fresh, regions: { ...fresh.regions, [capital]: withoutId } });
    expect(result.regions[capital].id).toBe(capital);
  });

  it('is idempotent: backfilling an already-complete state changes nothing', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    expect(backfillDefaults(fresh)).toEqual(fresh);
  });
});

describe('migrateSave (version 7: the tile world, a clean break with the region map)', () => {
  it('loads a current save and leaves it intact', () => {
    const fresh = createInitialState({ playerNationId: 'de', rngSeed: 3 });
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: fresh });
    expect(loaded.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded.state.playerNationId).toBe('de');
    expect(loaded.state.world.tileOwner).toEqual(fresh.world.tileOwner);
    expect(Object.keys(loaded.state.regions)).toHaveLength(240);
  });

  it('a loaded save survives 5 more turns with no NaN/Infinity leaves', () => {
    let state = migrateSave({ version: CURRENT_SAVE_VERSION, state: createInitialState({ playerNationId: 'fr', rngSeed: 5 }) }).state;
    for (let i = 0; i < 5; i++) state = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    const leaves = collectNumericLeaves(state);
    expect(leaves.every(Number.isFinite)).toBe(true);
  });

  it('is idempotent: migrating an already-current save changes nothing further', () => {
    const once = migrateSave({ version: CURRENT_SAVE_VERSION, state: createInitialState({ playerNationId: 'fr', rngSeed: 5 }) });
    const twice = migrateSave(once);
    expect(twice.state).toEqual(once.state);
  });

  it('refuses every save from the region map (versions 1 to 6) and the older grids (7 to 9) rather than guessing', () => {
    // versions 7 (frequency 53), 8 and 9 (frequency 75) cannot be converted: every tile id changed
    expect(OLDEST_LOADABLE_SAVE_VERSION).toBe(10);
    expect(migrateSave(saveV1Fixture)).toBeNull();
    const fresh = createInitialState({ playerNationId: 'fr' });
    [6, 7, 8, 9].forEach((v) => expect(migrateSave({ version: v, state: fresh }), `version ${v}`).toBeNull());
    expect(migrateSave(fresh)).toBeNull(); // a bare state without an envelope counts as version 1
  });

  it('returns null for a save from a newer build than this one knows how to read', () => {
    expect(migrateSave({ version: CURRENT_SAVE_VERSION + 1, state: createInitialState({ playerNationId: 'fr' }) })).toBeNull();
  });

  it('returns null for garbage input, without throwing', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('nope')).toBeNull();
    expect(migrateSave({ version: CURRENT_SAVE_VERSION, state: { playerNationId: 'fr' } })).toBeNull();
  });

  it('backfills a fresh top-level field missing from an otherwise-valid save', () => {
    const fresh = createInitialState({ playerNationId: 'fr' });
    const { wars, ...withoutWars } = fresh; // eslint-disable-line no-unused-vars
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: withoutWars });
    expect(loaded.state.wars).toEqual([]);
  });
});

describe('saveProblem (the save v7 screen)', () => {
  it('names why a save cannot load, and null when it can', async () => {
    const { saveProblem, CURRENT_SAVE_VERSION, SAVE_PROBLEM_TEXT } = await import('./saveMigrations');
    const { createInitialState } = await import('./gameReducer');
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 1 });
    expect(saveProblem({ version: CURRENT_SAVE_VERSION, state })).toBeNull();
    expect(saveProblem({ version: 6, state })).toBe('tooOld');
    [7, 8, 9].forEach((v) => expect(saveProblem({ version: v, state }), `version ${v}`).toBe('oldGrid'));
    expect(saveProblem({ version: CURRENT_SAVE_VERSION + 1, state })).toBe('tooNew');
    expect(saveProblem({ version: CURRENT_SAVE_VERSION, state: { hello: 1 } })).toBe('corrupt');
    expect(saveProblem(null)).toBe('corrupt');
    expect(saveProblem('text')).toBe('corrupt');
    ['tooOld', 'oldGrid', 'tooNew', 'corrupt'].forEach((k) => expect(SAVE_PROBLEM_TEXT[k]).toBeTruthy());
  });
});
