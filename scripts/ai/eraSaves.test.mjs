import { describe, it, expect } from 'vitest';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { buildSlices, hasCoast, NEIGHBOURS_MET, SLICE_ENGINE } from './human-playtest.mjs';
import { buildSimEngine } from '../simulate.mjs';

describe('playtest era saves', () => {
  it('load on the current save version, pass the audit, and have a coast, met neighbours and a war', async () => {
    const file = await buildSimEngine(SLICE_ENGINE);
    const e = await import(pathToFileURL(file).href);
    fs.rmSync(file, { force: true });
    const saves = await buildSlices(['bronze', 'modern'], 3, () => {});
    for (const [age, { state }] of Object.entries(saves)) {
      const p = state.playerNationId;
      // as window.__game.load does
      const migrated = e.migrateSave({ version: e.CURRENT_SAVE_VERSION, state: JSON.parse(JSON.stringify(state)) });
      expect(migrated, `${age} loads`).not.toBeNull();
      expect(migrated.version, age).toBe(e.CURRENT_SAVE_VERSION);
      const loaded = migrated.state;
      expect(e.auditGameState(loaded), age).toEqual([]);
      expect(hasCoast(e, loaded, p), `${age} coast`).toBe(true);
      expect(e.metNations(loaded, p).length, `${age} met`).toBeGreaterThanOrEqual(NEIGHBOURS_MET);
      expect(loaded.wars.some((w) => w.active && (w.aggressor === p || w.enemy === p)), `${age} war`).toBe(true);
    }
  }, 600000);
});
