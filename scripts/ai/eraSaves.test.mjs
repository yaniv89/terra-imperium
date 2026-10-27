import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { AGE_ORDER } from '../../src/data/ages.js';
import { migrateSave, CURRENT_SAVE_VERSION } from '../../src/engine/saveMigrations.js';
import { auditGameState } from '../../src/engine/stateAudit.js';
import { gameReducer } from '../../src/engine/gameReducer.js';
import { ActionTypes } from '../../src/data/types.js';
import { syncWorldRegistry } from '../../src/engine/world/registry.js';
import { metNations } from '../../src/engine/fog.js';
import { getTiles } from '../../src/data/geo/tiles.js';
import { getTechAgeId } from '../../src/engine/nationState.js';
import { isIndependentNation } from '../../src/data/independents.js';
import { eraSaveFile, readEraSave, ENEMY_REACH_KM } from './build-era-saves.mjs';

// The playtester's era saves (scripts/ai/build-era-saves.mjs): each loads as window.__game.load does and keeps its promises.
const AGES = AGE_ORDER.filter((a) => fs.existsSync(eraSaveFile(a)));

describe('playtest era saves', () => {
  it('there is one for every age from bronze', () => {
    expect(AGES).toEqual(expect.arrayContaining(AGE_ORDER.slice(1)));
  });

  it.each(AGES)('%s loads, passes the audit and has an empire, contacts, a coast with a ship and a war in reach', (age) => {
    const { state, facts } = readEraSave(age);
    const migrated = migrateSave({ version: CURRENT_SAVE_VERSION, state });
    expect(migrated, 'migrateSave refused it').not.toBeNull();
    // migrateSave leaves the registry as it found it (keepWorldRegistry); the running game syncs it to the loaded cities
    const s = syncWorldRegistry(gameReducer(migrated.state, { type: ActionTypes.LOAD_GAME, payload: migrated.state }));
    expect(auditGameState(s)).toEqual([]);
    const p = s.playerNationId;
    expect(getTechAgeId(s, p)).toBe(age);
    const mine = Object.values(s.regions).filter((c) => c.owner === p && !c.outpost);
    expect(mine.length).toBe(facts.cities);
    // an empire of the age: as many cities as the median major at least, from the classical age on several
    expect(mine.length).toBeGreaterThanOrEqual(Math.min(facts.aiMedianCities, AGE_ORDER.indexOf(age) >= 2 ? 3 : 1));
    expect(facts.researchTurns ?? 0).toBeLessThan(60);
    const met = metNations(s, p).filter((id) => id !== p && s.nations[id] && !s.nations[id].isEliminated && !isIndependentNation(s.nations[id]));
    expect(met.length).toBeGreaterThanOrEqual(3);
    expect(mine.some((c) => getTiles().coastal[c.tile] === 1)).toBe(true);
    expect(Object.values(s.units).some((u) => u.ownerId === p && u.domain === 'naval')).toBe(true);
    const enemies = s.wars.filter((w) => w.active && (w.aggressor === p || w.enemy === p)).map((w) => (w.aggressor === p ? w.enemy : w.aggressor));
    expect(enemies.length).toBeGreaterThan(0);
    expect((s.pendingDefenses || []).length > 0 || facts.nearestEnemyArmyKm <= ENEMY_REACH_KM).toBe(true);
  }, 60000);
});
