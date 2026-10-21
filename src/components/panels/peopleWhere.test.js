// src/components/panels/peopleWhere.test.js
import { describe, it, expect } from 'vitest';
import { peoplesWorld } from '../../engine/testWorld';
import { peopleWhere } from './peopleWhere';
import { exploreHint } from '../map/armySheetModel';
import { supplyAtTile, SUPPLY_WILD_LOSS } from '../../engine/supplyMeter';
import { metNations, isExplored } from '../../engine/fog';
import { getTiles } from '../../data/geo/tiles';
import { unitTile } from '../../engine/armies';

const S = peoplesWorld({ size: 'standard', seed: 11 });
const ME = S.playerNationId;
const myUnit = Object.values(S.units).find((u) => u.ownerId === ME && u.domain === 'land');
const myTile = unitTile(S, myUnit);

describe('finding a fight (playtests of 21 October)', () => {
  it('a first contact is known by its capital, a place the camera may go, and the march starts from the player\'s army', () => {
    const near = metNations(S, ME)[0];
    expect(near).toBeTruthy();
    const w = peopleWhere(S, near);
    expect(w.cities.length).toBeGreaterThan(0);
    expect(w.cities[0].isCapital).toBe(true);
    expect(isExplored(S, w.places[0].tile)).toBe(true);
    expect(w.march).toMatchObject({ target: w.cities[0].id, unitIds: expect.arrayContaining([myUnit.id]) });
  });

  it('a people never seen has no places and no march', () => {
    const far = Object.keys(S.nations).find((id) => id !== ME && !metNations(S, ME).includes(id));
    const w = peopleWhere(S, far);
    expect(w).toMatchObject({ cities: [], armies: [], places: [], march: null });
  });

  it('an idle army is pointed at the unknown and at the nearest known foreign city', () => {
    const h = exploreHint(S, myTile);
    expect(h.city).toBeTruthy();
    expect(h.tile == null || !isExplored(S, h.tile)).toBe(true);
  });

  it('the march bar warning: free land drains the meter, own land does not', () => {
    expect(supplyAtTile(S, [myUnit], myTile)).toBeNull();
    const tiles = getTiles();
    const owner = S.world.tileOwner;
    const wild = [...Array(tiles.count).keys()].find((t) => tiles.land[t] === 1 && owner[t] == null && tiles.neighbors[t].every((n) => owner[n] == null));
    expect(supplyAtTile(S, [{ ...myUnit, supply: 100 }], wild)).toEqual({ change: -SUPPLY_WILD_LOSS, turns: 100 / SUPPLY_WILD_LOSS });
  });
});
