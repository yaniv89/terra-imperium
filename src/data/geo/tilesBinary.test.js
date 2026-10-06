// src/data/geo/tilesBinary.test.js
// public/map/tiles.bin.gz (what the browser fetches) must be tiles.json exactly: rerun
// `npm run build:tiles-bin` after `npm run build:tiles` when this fails.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { encodeTiles, decodeTiles, columnsFromJson, COLUMN_TYPES } from './tilesCodec';
import { getTiles } from './tiles';

const json = JSON.parse(readFileSync('src/data/geo/tiles.json', 'utf8'));

describe('the world grid as a binary', () => {
  it('round-trips tiles.json exactly', () => {
    const back = decodeTiles(encodeTiles(json));
    Object.keys(json).forEach((k) => {
      if (COLUMN_TYPES[k]) expect(JSON.stringify(Array.from(back[k]))).toBe(JSON.stringify(json[k]));
      else expect(back[k]).toEqual(json[k]);
    });
  });

  it('the shipped public/map/tiles.bin.gz matches tiles.json', () => {
    const shipped = decodeTiles(gunzipSync(readFileSync('public/map/tiles.bin.gz')));
    const expected = columnsFromJson(json);
    // Columns compared as bytes (a deep compare of 600,000 numbers is very slow).
    const same = (a, b) => (ArrayBuffer.isView(a) ? Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0 && a.constructor === b.constructor : JSON.stringify(a) === JSON.stringify(b));
    Object.keys(expected).forEach((k) => expect(same(shipped[k], expected[k]), k).toBe(true));
  });

  it('the loaded grid uses typed columns', () => {
    expect(getTiles().land).toBeInstanceOf(Uint8Array);
    expect(getTiles().lat).toBeInstanceOf(Int32Array);
  });
});
