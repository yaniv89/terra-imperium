import { describe, it, expect } from 'vitest';
import { getTiles } from '../../../data/geo/tiles';
import { cityHexOf, hexFitUnits, insideHex, hexTownPx, HEX_INSET, COAST_INSET } from './cityHex';
import { unitPx, TILT_CLOSE, TILT_SUPER } from './scale';
import { TOWN_TIERS } from './townTiers';

const tiles = getTiles();
// an equirectangular map, 2 units a degree (y down), as the d3 projections give
const proj = ([lon, lat]) => [lon * 2, -lat * 2];
const lean = Math.sin(TILT_CLOSE);
const find = (test) => [...Array(tiles.count).keys()].find(test);
const inland = find((t) => tiles.land[t] && Math.abs(tiles.latLonOf(t).lat) < 40 && tiles.neighbors[t].every((n) => tiles.land[n]));
const coastal = find((t) => tiles.land[t] && Math.abs(tiles.latLonOf(t).lat) < 40 && tiles.neighbors[t].filter((n) => !tiles.land[n]).length === 2);
// the ellipse's points round its rim, from the centre (radius a, squashed by lean on y)
const rim = (a, l = lean) => Array.from({ length: 72 }, (_, i) => [a * Math.cos((i / 72) * Math.PI * 2), a * l * Math.sin((i / 72) * Math.PI * 2)]);
// inside a convex polygon given by its corners round the origin
const inPoly = (corners, [x, y]) => {
  const sign = Math.sign(corners.reduce((s, p, i) => { const q = corners[(i + 1) % corners.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0));
  return corners.every((p, i) => { const q = corners[(i + 1) % corners.length]; return sign * ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])) >= -1e-9; });
};

describe('a town fills its hex', () => {
  it('projects the real cell round its centre, edge k shared with neighbour k, cached per projection', () => {
    const hex = cityHexOf(proj, tiles, inland);
    expect(hex.corners).toHaveLength(tiles.neighbors[inland].length);
    expect(hex.edges.every((e) => !e.water && e.d > 0 && Math.abs(Math.hypot(e.nx, e.ny) - 1) < 1e-9)).toBe(true);
    // about 77 km between neighbours: an apothem of about a third of a degree
    expect(hex.apothem * 0.5).toBeGreaterThan(0.25); expect(hex.apothem * 0.5).toBeLessThan(0.5);
    expect(cityHexOf(proj, tiles, inland)).toBe(hex);
    const water = cityHexOf(proj, tiles, coastal).edges.map((e, k) => e.water === !tiles.land[tiles.neighbors[coastal][k]]);
    expect(water.every(Boolean)).toBe(true);
  });
  it('fits the leaning ground inside the hex with a small inset, wider than the apothem', () => {
    const hex = cityHexOf(proj, tiles, inland);
    const a = hexFitUnits(hex, lean);
    // an ellipse squashed on y fits at least the inset apothem, never more than the corners
    expect(a).toBeGreaterThanOrEqual(hex.apothem * (1 - HEX_INSET) - 1e-9);
    expect(a).toBeLessThan(hex.apothem * 1.16);
    rim(a).forEach((p) => expect(inPoly(hex.corners, p)).toBe(true));
    // it touches the inset hex: 2% wider pokes out of it
    expect(rim(a * 1.02).some((p) => !insideHex(hex, p[0], p[1], 0, lean))).toBe(true);
    // a flatter lean leaves more room, never less
    expect(hexFitUnits(hex, Math.sin(TILT_SUPER))).toBeGreaterThanOrEqual(a - 1e-12);
    // seen from straight above (lean 1) the ground is a disc inside the apothem
    expect(hexFitUnits(cityHexOf(([lon, lat]) => [lon, -lat], tiles, inland), 1)).toBeCloseTo(cityHexOf(([lon, lat]) => [lon, -lat], tiles, inland).apothem * (1 - HEX_INSET));
  });
  it('keeps a coastal town off the sea: the edges with water beyond are moved in further', () => {
    const hex = cityHexOf(proj, tiles, coastal);
    const a = hexFitUnits(hex, lean);
    rim(a).forEach(([x, y]) => hex.edges.filter((e) => e.water).forEach((e) => {
      expect(e.nx * x + e.ny * y + e.d).toBeGreaterThanOrEqual(hex.apothem * (HEX_INSET + COAST_INSET) - 1e-9);
    }));
  });
  it('scales every tier to the hex: the tier art shows the size, a camp keeps its natural size', () => {
    const k = 20;
    const fitPx = hexFitUnits(cityHexOf(proj, tiles, inland), lean) * k;
    TOWN_TIERS.forEach((tier) => {
      const px = hexTownPx({ projection: proj, tiles, tile: inland, k, radius: tier.modelRadius, lean });
      expect(px * tier.modelRadius).toBeCloseTo(fitPx);
    });
    // with its wall ring the town's ground draws a little smaller, the wall on the inset line
    const walled = hexTownPx({ projection: proj, tiles, tile: inland, k, radius: 2.3, lean });
    expect(walled * 2.3).toBeCloseTo(fitPx);
    const camp = hexTownPx({ projection: proj, tiles, tile: inland, k, radius: 1, lean, fill: false });
    expect(camp).toBeCloseTo(Math.min(unitPx(k), fitPx));
    // behind the wrap (no hex): the old room rule
    const wrapped = hexTownPx({ projection: () => null, tiles, tile: inland, k, radius: 2, lean });
    expect(wrapped).toBeCloseTo(unitPx(k));
  });
  it('lets a landmark outside the wall stand only on its own hex', () => {
    const hex = cityHexOf(proj, tiles, inland);
    expect(insideHex(hex, 0, 0, hex.apothem * 0.5, lean)).toBe(true);
    expect(insideHex(hex, hex.apothem * 0.95, 0, hex.apothem * 0.2, lean)).toBe(false);
    expect(insideHex(null, 0, 0, 0, lean)).toBe(false);
    // on the hex but past the town's inset line: inside only when the inset is not asked
    const e = hex.edges.find((x) => x.d === hex.apothem);
    expect(insideHex(hex, -e.nx * e.d * 0.92, -e.ny * e.d * 0.92, 0, lean)).toBe(false);
    expect(insideHex(hex, -e.nx * e.d * 0.92, -e.ny * e.d * 0.92, 0, lean, false)).toBe(true);
  });
});
