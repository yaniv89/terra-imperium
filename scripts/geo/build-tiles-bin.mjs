// scripts/geo/build-tiles-bin.mjs
// Writes public/map/tiles.bin.gz, the world grid the browser fetches (src/data/geo/tilesCodec.js),
// from src/data/geo/tiles.json. Run after `npm run build:tiles` (npm run build:tiles-bin);
// src/data/geo/tilesBinary.test.js fails when the two drift apart.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { gzipSync } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { encodeTiles } from '../../src/data/geo/tilesCodec.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const raw = JSON.parse(readFileSync(path.join(ROOT, 'src/data/geo/tiles.json'), 'utf8'));
const bin = encodeTiles(raw);
const gz = gzipSync(bin, { level: 9 });
mkdirSync(path.join(ROOT, 'public/map'), { recursive: true });
writeFileSync(path.join(ROOT, 'public/map/tiles.bin.gz'), gz);
console.log(`wrote public/map/tiles.bin.gz: ${(bin.length / 1024).toFixed(0)} KB binary, ${(gz.length / 1024).toFixed(0)} KB gzipped`);
