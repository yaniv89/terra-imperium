// src/engine/playtest4Copy.test.js
// Playtest 4 copy findings: news of cities the player lost (P4-M3, a city record's `ownerId` stays
// its founder after it changes hands), and a raw "{name}" in the army sheet's pillage button (L2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { getTiles } from '../data/geo/tiles';
import { processCities, cityHolder } from './world/cities';
import { peoplesWorld, rivalOf, cap } from './testWorld';
import { pillageTarget } from '../components/map/armySheetModel';
import { translate } from '../i18n/core';

const FIXTURE = fileURLToPath(new URL('./__fixtures__/save-t202-ghost-city.json.gz', import.meta.url));

describe('a city that changed hands (P4-M3)', () => {
  it('reports its news and its finished items to whoever holds it now', () => {
    const s = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString('utf8')).state;
    const moved = Object.values(s.regions).filter((c) => c.ownerId && c.owner !== c.ownerId);
    expect(moved.length).toBeGreaterThan(0); // the save has them (Nubt and Zau among them)
    const ctx = { researched: [], ageId: 'kingdoms', turnNumber: s.turnNumber + 1, citiesOwned: 1, speedMult: 1, trainMult: 1, luxuries: 0, greatProjects: {} };
    const out = processCities({ cities: s.regions, tileOwner: s.world.tileOwner, tileState: s.world.tileState }, getTiles(), () => ctx);
    out.logs.forEach((l) => expect(l.nationId).toBe(s.regions[l.cityId].owner));
    out.completed.forEach((x) => expect(x.nationId).toBe(s.regions[x.city].owner));
  });

  it('cityHolder prefers the game record\'s owner', () => {
    expect(cityHolder({ owner: 'akkad', ownerId: 'kemet' })).toBe('akkad');
    expect(cityHolder({ ownerId: 'kemet' })).toBe('kemet');
    expect(cityHolder({ owner: null, ownerId: 'kemet' })).toBe(null);
  });
});

describe('the pillage button (L2)', () => {
  it('names a district, never a raw placeholder', () => {
    const base = peoplesWorld({ seed: 7 });
    const me = base.playerNationId; const foe = rivalOf(base);
    const city = base.regions[cap(foe)];
    const tile = city.tiles.find((t) => t !== city.tile);
    const state = {
      ...base,
      wars: [...(base.wars || []), { id: 'w1', aggressor: me, enemy: foe, active: true }],
      world: { ...base.world, tileState: { ...base.world.tileState, [tile]: { district: 'science' } } }
    };
    const p = pillageTarget(state, tile, [{ id: 'u', ownerId: me, movesLeft: 1 }]);
    expect(p.name).toBe('Campus');
    const line = translate('mx.army.pillage', { name: p.name, gold: p.gold }, 'en');
    expect(line).not.toMatch(/\{|undefined/);
  });
});
