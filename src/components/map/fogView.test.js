// src/components/map/fogView.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../../data/regions';
import { updateFog, hasMet, isExplored } from '../../engine/fog';
import { visibleTiles } from '../../engine/sight';
import { fogView, exploredFeatures, visibleFeatures } from './fogView';

const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
const capTile = (s, id) => s.regions[getNationCapital(id)]?.tile;
const unit = (id, tile) => ({ id, ownerId: 'fr', tile, regionId: getNationCapital('fr'), domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [] });
const farAway = (s) => Object.keys(s.nations).filter((id) => id !== 'fr' && capTile(s, id) != null && !hasMet(s, 'fr', id) && !isExplored(s, capTile(s, id), 'fr')).sort()[0];

describe('the map as the player knows it', () => {
  it('shows what is in sight as it is and nothing unexplored', () => {
    const v = fogView(S);
    expect(v.on).toBe(true);
    const vis = visibleTiles(S, 'fr');
    Object.keys(S.world.tileOwner).forEach((k) => { if (vis.has(+k)) expect(v.state.world.tileOwner[k]).toBe(S.world.tileOwner[k]); });
    const far = farAway(S);
    expect(v.state.regions[getNationCapital(far)]).toBeUndefined();
    expect(v.state.world.tileOwner[capTile(S, far)]).toBeUndefined();
    expect(v.state.regions[getNationCapital('fr')]).toBe(S.regions[getNationCapital('fr')]);
    expect(fogView(S)).toBe(v); // cached per state
  });

  it('keeps a city seen once as a greyed ghost, as it was', () => {
    const far = farAway(S);
    const id = getNationCapital(far);
    const scouted = updateFog({ ...S, units: { ...S.units, scout: unit('scout', capTile(S, far)) } }, { onlyPlayer: true });
    expect(fogView(scouted).state.regions[id]).toBe(scouted.regions[id]);
    const left = { ...scouted, units: S.units, regions: { ...scouted.regions, [id]: { ...scouted.regions[id], size: 12 } } };
    const ghost = fogView(left).state.regions[id];
    expect(ghost.ghost).toBe(true);
    expect(ghost.size).toBe(scouted.regions[id].size || 1);
    expect(fogView(left).state.world.tileOwner[capTile(S, far)]).toBe(id);
  });

  it('keeps the same objects when moving reveals nothing new', () => {
    const a = fogView({ ...S, units: { ...S.units } });
    const b = fogView({ ...S, units: { ...S.units } });
    expect(b.state.world.tileOwner).toBe(a.state.world.tileOwner);
    expect(b.state.regions).toBe(a.state.regions);
  });

  it('is the state itself with the explored world option', () => {
    const open = createInitialState({ playerNationId: 'fr', rngSeed: 7, fog: false });
    const v = fogView(open);
    expect(v.state).toBe(open);
    expect(v.isExplored(0)).toBe(true);
  });

  it('builds the explored and visible shapes once per map', () => {
    const v = fogView(S);
    const shapes = exploredFeatures(v.explored);
    expect(shapes.length).toBeGreaterThan(0);
    expect(exploredFeatures(v.explored)).toBe(shapes);
    expect(visibleFeatures(v.visible).length).toBeGreaterThan(0);
  });
});
