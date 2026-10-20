import { describe, it, expect } from 'vitest';
import { migrateSave, saveProblem, SAVE_PROBLEM_TEXT, backfillDefaults, CURRENT_SAVE_VERSION, OLDEST_LOADABLE_SAVE_VERSION } from './saveMigrations';
import { createInitialState, gameReducer } from './gameReducer';
import { peoplesWorld } from './testWorld';
import { ActionTypes } from '../data/types';
import saveV1Fixture from './__fixtures__/save-v1.json';
import { TECH_TREE, getTechsForAge } from '../data/techTree';
import { AGE_ORDER, getAgeIndex } from '../data/ages';
import { ageOf } from './nationState';
import { auditGameState, assertGameState } from './stateAudit';

const P = peoplesWorld({ independents: true }).playerNationId; // the player's people in the shared test world
const capOf = (state, id = P) => state.nations[id].capitalRegionId;
const collectNumericLeaves = (value, out = []) => {
  if (typeof value === 'number') { out.push(value); return out; }
  if (Array.isArray(value)) { value.forEach((v) => collectNumericLeaves(v, out)); return out; }
  if (value && typeof value === 'object') { Object.values(value).forEach((v) => collectNumericLeaves(v, out)); }
  return out;
};

describe('backfillDefaults', () => {
  it('refuses a save of the retired 240-country world, keeping it out of the game', () => {
    const legacy = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    expect(migrateSave({ version: CURRENT_SAVE_VERSION, state: legacy })).toBeNull();
    expect(saveProblem({ version: CURRENT_SAVE_VERSION, state: legacy })).toBe('legacyWorld');
    expect(saveProblem({ version: CURRENT_SAVE_VERSION, state: peoplesWorld({ independents: true }) })).toBeNull();
    expect(SAVE_PROBLEM_TEXT.legacyWorld).toBeTruthy();
  });

  it('fills a missing top-level field without touching anything else', () => {
    const fresh = peoplesWorld({ independents: true });
    const { wars, ...withoutWars } = fresh; // eslint-disable-line no-unused-vars
    const result = backfillDefaults(withoutWars);
    expect(result.wars).toEqual([]);
    expect(result.playerNationId).toBe(P);
  });

  it('fills a missing nested region field without touching present ones', () => {
    const fresh = peoplesWorld({ independents: true });
    const capital = capOf(fresh);
    const { defenseLevel, ...regionWithoutDefense } = fresh.regions[capital]; // eslint-disable-line no-unused-vars
    const damaged = { ...fresh, regions: { ...fresh.regions, [capital]: { ...regionWithoutDefense, control: 42 } } };
    const result = backfillDefaults(damaged);
    expect(result.regions[capital].defenseLevel).toBe(0);
    expect(result.regions[capital].control).toBe(42);
  });

  it('never overwrites a present falsy value (0, false, null)', () => {
    const fresh = peoplesWorld({ independents: true });
    const state = { ...fresh, activeEventId: null, turnNumber: 0, resources: { ...fresh.resources, gold: 0 } };
    const result = backfillDefaults(state);
    expect(result.activeEventId).toBeNull();
    expect(result.turnNumber).toBe(0);
    expect(result.resources.gold).toBe(0);
  });

  it('never overwrites region identity fields (owner) from the fresh template', () => {
    const fresh = peoplesWorld({ independents: true });
    const capital = capOf(fresh);
    const conquered = { ...fresh, regions: { ...fresh.regions, [capital]: { ...fresh.regions[capital], owner: 'rivalx' } } };
    expect(backfillDefaults(conquered).regions[capital].owner).toBe('rivalx');
  });

  it('repairs a region record missing its own id field entirely', () => {
    const fresh = peoplesWorld({ independents: true });
    const capital = capOf(fresh);
    const { id, ...withoutId } = fresh.regions[capital]; // eslint-disable-line no-unused-vars
    const result = backfillDefaults({ ...fresh, regions: { ...fresh.regions, [capital]: withoutId } });
    expect(result.regions[capital].id).toBe(capital);
  });

  it('is idempotent: backfilling an already-complete state changes nothing', () => {
    const fresh = peoplesWorld({ independents: true });
    expect(backfillDefaults(fresh)).toEqual(fresh);
  });
});

describe('migrateSave (version 7: the tile world, a clean break with the region map)', () => {
  it('loads a current save and leaves it intact', () => {
    const fresh = peoplesWorld({ independents: true, seed: 3 });
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: fresh });
    expect(loaded.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded.state.playerNationId).toBe(P);
    expect(loaded.state.world.tileOwner).toEqual(fresh.world.tileOwner);
    expect(Object.keys(loaded.state.regions)).toEqual(Object.keys(fresh.regions));
  });

  it('a loaded save survives 5 more turns with no NaN/Infinity leaves', () => {
    let state = migrateSave({ version: CURRENT_SAVE_VERSION, state: peoplesWorld({ independents: true, seed: 5 }) }).state;
    for (let i = 0; i < 5; i++) state = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    const leaves = collectNumericLeaves(state);
    expect(leaves.every(Number.isFinite)).toBe(true);
  });

  it('is idempotent: migrating an already-current save changes nothing further', () => {
    const once = migrateSave({ version: CURRENT_SAVE_VERSION, state: peoplesWorld({ independents: true, seed: 5 }) });
    const twice = migrateSave(once);
    expect(twice.state).toEqual(once.state);
  });

  it('refuses every save from the region map (versions 1 to 6) and the older grids (7 to 9) rather than guessing', () => {
    // versions 7 (frequency 53), 8 and 9 (frequency 75) cannot be converted: every tile id changed
    expect(OLDEST_LOADABLE_SAVE_VERSION).toBe(10);
    expect(migrateSave(saveV1Fixture)).toBeNull();
    const fresh = peoplesWorld({ independents: true });
    [6, 7, 8, 9].forEach((v) => expect(migrateSave({ version: v, state: fresh }), `version ${v}`).toBeNull());
    expect(migrateSave(fresh)).toBeNull(); // a bare state without an envelope counts as version 1
  });

  it('loads a version 10 save that still carries succession and the estates, stripping them', () => {
    const fresh = peoplesWorld({ independents: true, seed: 4 });
    const cap = capOf(fresh);
    const fr = fresh.nations[P];
    const old = {
      ...fresh,
      nations: {
        ...fresh.nations,
        [P]: {
          ...fr,
          heir: { id: 'heir_1', name: 'Louis', claim: 60 },
          ruler: { ...fr.ruler, consort: { name: 'Anne' }, isRegency: false, claim: 70 },
          estates: { clergy: { loyalty: 50, influence: 10, privileges: [] } },
          crownLand: 40,
          estateInteractionCooldowns: { seizeLand: 12 },
          disasters: { estateTakeover: 30, economicCollapse: 20, successionWar: 10, revolution: 0 },
          modifiers: [{ id: 'm1', sourceId: 'estate_takeover', mods: { 'national.admBonus': -2 } }, { id: 'm2', sourceId: 'bankruptcy', mods: {} }],
          governors: { [cap]: { id: 'heir_1', name: 'Louis (heir)', skill: 2, heir: true, since: 1, ready: 3 } }
        }
      },
      units: { ...fresh.units, p1: { id: 'p1', ownerId: 'rebels', isPretender: true, regionId: cap, strength: 5 } },
      regions: { ...fresh.regions, [cap]: { ...fresh.regions[cap], occupiedBy: 'pretenders' } },
      pendingEventChains: [{ id: 'succession_crisis_2', dueTurn: 9 }, { id: 'tech_gamble_2', dueTurn: 9 }],
      activeEventId: 'succession_crisis_1'
    };
    const loaded = migrateSave({ version: 10, state: JSON.parse(JSON.stringify(old)) });
    expect(loaded.version).toBe(CURRENT_SAVE_VERSION);
    const n = loaded.state.nations[P];
    ['heir', 'estates', 'crownLand', 'estateInteractionCooldowns'].forEach((k) => expect(n, k).not.toHaveProperty(k));
    expect(n.ruler).not.toHaveProperty('consort');
    expect(n.ruler).not.toHaveProperty('claim');
    expect(n.ruler.name).toBe(fr.ruler.name);
    expect(n.disasters).toEqual({ economicCollapse: 20, revolution: 0 });
    expect(n.modifiers.map((m) => m.id)).toEqual(['m2']);
    expect(n.governors[cap]).not.toHaveProperty('heir');
    expect(n.governors[cap].name).toBe('Louis (heir)');
    expect(loaded.state.units.p1.isInsurgent).toBe(true);
    expect(loaded.state.units.p1).not.toHaveProperty('isPretender');
    expect(loaded.state.regions[cap].occupiedBy).toBe('insurgents');
    expect(loaded.state.pendingEventChains.map((c) => c.id)).toEqual(['tech_gamble_2']);
    expect(loaded.state.activeEventId).toBeNull();
  });

  it('returns null for a save from a newer build than this one knows how to read', () => {
    expect(migrateSave({ version: CURRENT_SAVE_VERSION + 1, state: peoplesWorld({ independents: true }) })).toBeNull();
  });

  it('returns null for garbage input, without throwing', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('nope')).toBeNull();
    expect(migrateSave({ version: CURRENT_SAVE_VERSION, state: { playerNationId: P } })).toBeNull();
  });

  it('backfills a fresh top-level field missing from an otherwise-valid save', () => {
    const fresh = peoplesWorld({ independents: true });
    const { wars, ...withoutWars } = fresh; // eslint-disable-line no-unused-vars
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: withoutWars });
    expect(loaded.state.wars).toEqual([]);
  });
});

describe('saveProblem (the save v7 screen)', () => {
  it('names why a save cannot load, and null when it can', async () => {
    const state = peoplesWorld({ independents: true, seed: 1 });
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

// Eight-ages plan U16 (KTD1, KTD10): a version 13 save re-derives every age from research, with
// nobody demoted below the old effective age max(calendar, min(tech, calendar + 1)).
describe('migrateSave v13 to v14: ages by tech without demotion', () => {
  const ids = (ageId) => getTechsForAge(ageId).map((t) => t.id);
  // A v13 save: the calendar age and year on the state, research of its own.
  const v13 = () => {
    const base = JSON.parse(JSON.stringify(peoplesWorld({ independents: true, seed: 5 })));
    const me = base.playerNationId;
    const techTree = { ...base.techTree };
    [...ids('bronze'), ...ids('classical').slice(0, 6), ...ids('kingdoms').slice(0, 4)].forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    const ai = Object.keys(base.nations).sort().find((id) => id !== me && base.nations[id].tech && base.nations[id].kind !== 'independent');
    const ahead = Object.keys(base.nations).sort().find((id) => id !== me && id !== ai && base.nations[id].tech && base.nations[id].kind !== 'independent');
    const nations = {
      ...base.nations,
      [ai]: { ...base.nations[ai], tech: { researched: ids('bronze').slice(0, 3), ageId: 'bronze' } },
      [ahead]: { ...base.nations[ahead], tech: { researched: [...ids('bronze'), ...ids('classical'), ...ids('kingdoms'), ...ids('gunpowder').slice(0, 6)], ageId: 'modern' } }
    };
    const outOfWindow = ids('modern')[0];
    return { me, ai, ahead, outOfWindow, state: { ...base, age: 'gunpowder', year: 1700, techAgeId: 'kingdoms', techTree, nations, research: { ...base.research, current: outOfWindow, queue: [ids('gunpowder')[0], outOfWindow] } } };
  };

  it('a calendar-Gunpowder player with 4 Kingdoms techs loads as Gunpowder, the Kingdoms techs granted', () => {
    const { me, state } = v13();
    const loaded = migrateSave({ version: 13, state });
    expect(loaded.version).toBe(CURRENT_SAVE_VERSION);
    expect(ageOf(loaded.state, me)).toBe('gunpowder');
    ids('kingdoms').forEach((id) => expect(loaded.state.techTree[id].researched, id).toBe(true));
    expect(loaded.state).not.toHaveProperty('age');
    expect(auditGameState(loaded.state).filter((i) => i.code === 'calendar_age')).toEqual([]);
  });

  it('no nation is younger after load than its old effective age', () => {
    const { ai, ahead, state } = v13();
    const loaded = migrateSave({ version: 13, state });
    const gunpowder = getAgeIndex('gunpowder');
    Object.keys(state.nations).forEach((id) => {
      if (!state.nations[id].tech) return;
      expect(getAgeIndex(ageOf(loaded.state, id)), id).toBeGreaterThanOrEqual(gunpowder);
    });
    expect(ageOf(loaded.state, ai)).toBe('gunpowder'); // a laggard is lifted to the calendar it had
    expect(ageOf(loaded.state, ahead)).toBe('modern'); // a leader keeps its lead (calendar + 1)
  });

  it('drops a current or queued tech outside the new window, keeps the rest; the year becomes the label', () => {
    const { me, outOfWindow, state } = v13();
    // A calendar-Bronze save whose research reached Kingdoms: the window is Kingdoms and Gunpowder.
    const loaded = migrateSave({ version: 13, state: { ...state, age: 'bronze', year: -1500 } });
    expect(ageOf(loaded.state, me)).toBe('kingdoms');
    expect(loaded.state.research.current).toBeNull();
    expect(loaded.state.research.queue).not.toContain(outOfWindow);
    expect(loaded.state.research.queue).toContain(ids('gunpowder')[0]);
    expect(loaded.state.year).toBe(900); // Kingdoms, 4 of its 10 techs: 500 + 1000 x 0.4
  });

  it('a current save loads with its ages unchanged', () => {
    const fresh = peoplesWorld({ independents: true, seed: 5 });
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: JSON.parse(JSON.stringify(fresh)) });
    expect(loaded.state.techAgeId).toBe(fresh.techAgeId);
    expect(AGE_ORDER).toContain(loaded.state.techAgeId);
    expect(Object.keys(TECH_TREE).filter((id) => loaded.state.techTree[id]?.researched)).toEqual(Object.keys(TECH_TREE).filter((id) => fresh.techTree[id]?.researched));
  });
});

// Eight-ages plan U21: a version 13 or 14 save loses the retired space and nuclear state, refunded nothing.
describe('migrateSave v14 to v15: space and nukes retired', () => {
  it('a save with satellites, missiles and a scarred city loads with none of those keys', () => {
    const base = JSON.parse(JSON.stringify(peoplesWorld({ independents: true, seed: 5 })));
    const me = base.playerNationId;
    const city = Object.keys(base.regions)[0];
    const state = {
      ...base,
      satellites: { satellite_0: { id: 'satellite_0', ownerId: me, typeId: 'recon' } }, nextSatelliteSeq: 1, orbitalDebrisLevel: 30,
      spaceMissionProgress: { first_satellite: 2 }, completedMissions: ['sounding_rocket'],
      resources: { ...base.resources, helium3: 40 },
      regions: { ...base.regions, [city]: { ...base.regions[city], nuclearScarred: true } },
      nations: { ...base.nations, [me]: { ...base.nations[me], missiles: { tactical: 2, nuclear: 1 }, abmDefenseLevel: 1, fusionGridActive: true, modifiers: [{ sourceType: 'nuclear', sourceId: 'nuclear_pariah', mods: {}, expiresTurn: 99 }] } }
    };
    const loaded = migrateSave({ version: 14, state }).state;
    ['satellites', 'nextSatelliteSeq', 'orbitalDebrisLevel', 'spaceMissionProgress', 'completedMissions'].forEach((k) => expect(loaded, k).not.toHaveProperty(k));
    ['missiles', 'abmDefenseLevel', 'fusionGridActive'].forEach((k) => expect(loaded.nations[me], k).not.toHaveProperty(k));
    expect(loaded.nations[me].modifiers).toEqual([]);
    expect(loaded.resources).not.toHaveProperty('helium3');
    expect(loaded.regions[city]).not.toHaveProperty('nuclearScarred');
    expect(() => assertGameState(loaded)).not.toThrow();
  });
});

describe('migrateSave v15 to v16: one ruler a game (differentiation plan U5)', () => {
  it('a v13 save with rolled rulers, houses, reigns and traits loads with the fixed ruler and a clean audit', () => {
    const base = JSON.parse(JSON.stringify(peoplesWorld({ independents: true, seed: 5 })));
    const majors = Object.keys(base.nations).filter((id) => base.nations[id].ruler);
    const nations = { ...base.nations };
    majors.forEach((id, i) => { nations[id] = { ...nations[id], sameDynastyStreak: 4, ruler: { id: `ruler_${id}_7`, name: `Old ${i}`, dynasty: 'Capet', adm: 6, dip: 0, mil: 2, traits: ['warrior', 'sickly'], reignStartTurn: 7, reignEndsTurn: 30 } }; });
    const loaded = migrateSave({ version: 13, state: { ...base, nations } }).state;
    majors.forEach((id) => {
      expect(loaded.nations[id].ruler).toEqual({ id: `ruler_${id}`, name: base.nations[id].ruler.name, adm: 3, dip: 3, mil: 3, cmd: 0, lrn: 0, maj: 0 });
      expect(loaded.nations[id]).not.toHaveProperty('sameDynastyStreak');
    });
    expect(() => assertGameState(loaded)).not.toThrow();
  });
});
