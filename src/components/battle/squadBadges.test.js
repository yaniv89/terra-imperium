import { describe, it, expect } from 'vitest';
import { badgesFor, BADGE_MAX_ZOOM, HIT_FLASH_TICKS } from './squadBadges';
import { TILE } from '../../battle/setup/mapgen';

const sq = (idx, over = {}) => ({ idx, side: 0, alive: true, onField: true, fled: false, visible: true, x: 256 * 2.5, y: 256 * 2.5, strength: 50, maxStrength: 100, striking: false, ...over });
const map = { w: 4, h: 4, tiles: new Array(16).fill(TILE.OPEN) };
const opts = (over = {}) => ({ zoom: 1, playerSide: 0, map, selected: new Set(), ...over });

describe('squad flags', () => {
  it('show on every squad at the default zoom and wider, none closer in on open ground', () => {
    const cur = { squads: [sq(0), sq(1, { side: 1 })] };
    expect(badgesFor(null, cur, 1, opts())).toHaveLength(2);
    expect(badgesFor(null, cur, 1, opts({ zoom: BADGE_MAX_ZOOM + 0.5 }))).toHaveLength(0);
  });
  it('stay up close for a squad hidden in a wood or among houses', () => {
    const tiles = map.tiles.slice(); tiles[2 * 4 + 2] = TILE.FOREST;
    const cur = { squads: [sq(0)] };
    expect(badgesFor(null, cur, 1, opts({ zoom: 2, map: { ...map, tiles } }))).toHaveLength(1);
  });
  it('skip the dead, the fled and an enemy out of sight; carry strength share and striking', () => {
    const cur = { squads: [sq(0, { alive: false }), sq(1, { fled: true }), sq(2, { side: 1, visible: false }), sq(3, { striking: true })] };
    const out = badgesFor(null, cur, 1, opts());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ share: 0.5, striking: true, side: 'you' });
  });
  it('carry morale, the rout and a hit that fades over HIT_FLASH_TICKS', () => {
    const cur = { tick: 100, squads: [sq(0, { morale: 30, lastHitTick: 100 }), sq(1, { routed: true, lastHitTick: 100 - HIT_FLASH_TICKS })] };
    const [a, b] = badgesFor(null, cur, 0, opts());
    expect(a).toMatchObject({ morale: 0.3, routed: false, hit: 1 });
    expect(b).toMatchObject({ routed: true, hit: 0 });
  });
});
