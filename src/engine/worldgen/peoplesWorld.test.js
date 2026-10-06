import { describe, it, expect } from 'vitest';
import { pickMajors } from './peoplesWorld';
import { createInitialState } from '../gameReducer';
import { assertGameState } from '../stateAudit';
import { PEOPLES } from '../../data/peoples';
import { WORLD_SIZES, MAJOR_MIN_GAP_KM, EQUAL_START_SIZE } from '../../data/worldSizes';
import { getTiles } from '../../data/geo/tiles';
import { distanceKm } from '../../data/geo/geodesic';

const tiles = getTiles();
const km = (a, b) => distanceKm(tiles.centres[PEOPLES[a].tile], tiles.centres[PEOPLES[b].tile]);

describe('the peoples world: who becomes a major (phase W0)', () => {
  it('every world size gives its count, the player first, Israel always in, no late arrival', () => {
    Object.values(WORLD_SIZES).forEach((size) => [1, 2, 3, 99, 4242].forEach((seed) => {
      const majors = pickMajors('akkad', size.id, seed, { tiles });
      expect(majors, `${size.id} ${seed}`).toHaveLength(size.majors);
      expect(majors[0]).toBe('akkad');
      expect(majors).toContain('israel');
      expect(new Set(majors).size).toBe(majors.length);
      majors.slice(1).forEach((id) => expect(PEOPLES[id].arrives === undefined || id === 'akkad', id).toBe(true));
    }));
  });

  it('keeps the majors apart (the gap), the pinned people aside', () => {
    [5, 6, 7].forEach((seed) => {
      const majors = pickMajors('kemet', 'standard', seed, { tiles }).filter((id) => id !== 'israel');
      for (let i = 0; i < majors.length; i++) for (let j = i + 1; j < majors.length; j++) {
        expect(km(majors[i], majors[j]), `${majors[i]}-${majors[j]}`).toBeGreaterThanOrEqual(MAJOR_MIN_GAP_KM);
      }
    });
  });

  it('is deterministic in the seed, and different seeds draw different worlds', () => {
    expect(pickMajors('shang', 'large', 11, { tiles })).toEqual(pickMajors('shang', 'large', 11, { tiles }));
    expect(pickMajors('shang', 'large', 11, { tiles })).not.toEqual(pickMajors('shang', 'large', 12, { tiles }));
  });

  it('the player may be any people, a late arrival included', () => {
    expect(pickMajors('lapita', 'small', 3, { tiles })[0]).toBe('lapita');
    expect(() => pickMajors('fr', 'small', 3, { tiles })).toThrow();
  });
});

describe('a new game in a peoples world', () => {
  // Majors only (independents: false): the independents of phase W1 are tested in independents.test.js.
  const state = createInitialState({ playerNationId: 'akkad', rngSeed: 21, scenario: { mode: 'peoples', size: 'small', seed: 21, independents: false } });

  it('has the drawn majors as its nations, each with one equal city and one regiment', () => {
    expect(state.scenario).toMatchObject({ mode: 'peoples', start: 'dawn', worldSize: 'small', seed: 21, nationCount: 24 });
    const ids = Object.keys(state.nations);
    expect(ids).toHaveLength(24);
    expect(ids).toContain('israel');
    expect(state.playerNationId).toBe('akkad');
    ids.forEach((id) => {
      const nation = state.nations[id];
      expect(nation.people).toBe(id);
      const city = state.regions[nation.capitalRegionId];
      expect(city.owner).toBe(id);
      expect(city.size).toBe(EQUAL_START_SIZE);
      expect(city.name).toBe(PEOPLES[id].capital.name);
      expect(city.tile).toBe(PEOPLES[id].tile);
    });
    expect(Object.keys(state.regions)).toHaveLength(24);
    expect(Object.values(state.units).filter((u) => u.classId === 'settler')).toHaveLength(0);
    const regiments = Object.values(state.units).filter((u) => u.classId === 'infantry');
    expect(regiments).toHaveLength(24);
    regiments.forEach((u) => expect(u.strength).toBe(1000));
    assertGameState(state);
  });

  it('every nation starts with the same treasury and garrison', () => {
    const ai = Object.values(state.nations).filter((n) => n.id !== 'akkad');
    ai.forEach((n) => {
      expect(n.economy.gold).toBe(state.resources.gold);
      expect(n.militaryStrength).toBe(state.nations.akkad.militaryStrength);
    });
  });

  it('names nations by title, Israel by its full name', () => {
    expect(state.nations.akkad.name).toBe('The Akkadian tribes');
    expect(state.nations.israel.name).toBe('Kingdom of Israel');
  });

  it('an old country id for the player maps to the people of its land', () => {
    const s = createInitialState({ playerNationId: 'eg', rngSeed: 3, scenario: { mode: 'peoples', size: 'small', seed: 3 } });
    expect(s.playerNationId).toBe('kemet');
    expect(s.nations.kemet.isPlayer).toBe(true);
  });

  it('the world seed changes the world; the same seed rebuilds it', () => {
    const a = createInitialState({ playerNationId: 'akkad', rngSeed: 5, scenario: { mode: 'peoples', size: 'small', seed: 5 } });
    const b = createInitialState({ playerNationId: 'akkad', rngSeed: 5, scenario: { mode: 'peoples', size: 'small', seed: 5 } });
    const c = createInitialState({ playerNationId: 'akkad', rngSeed: 5, scenario: { mode: 'peoples', size: 'small', seed: 6 } });
    expect(Object.keys(a.nations)).toEqual(Object.keys(b.nations));
    expect(Object.keys(a.nations)).not.toEqual(Object.keys(c.nations));
  });
});
