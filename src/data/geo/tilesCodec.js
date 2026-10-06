// src/data/geo/tilesCodec.js
// The world grid as a compact binary (plans/rts-world-review.md 6.4): the per-tile columns of
// tiles.json as typed arrays instead of an 8.2 MB JSON in the main bundle. Layout:
//   4 bytes  "TIB1"
//   4 bytes  header length H (uint32, little endian)
//   H bytes  UTF-8 JSON: every non-column field of tiles.json (names, ids, capitals, ...) and
//            `columns`: [{ name, type, length, offset }] (offset from the start of the data)
//   data     the columns, each aligned to 4 bytes
// Pure and synchronous both ways; scripts/geo/build-tiles-bin.mjs writes public/map/tiles.bin.gz
// and tiles.js fetches it. `columnsFromJson` gives the same typed arrays from the JSON (Node).
export const COLUMN_TYPES = {
  lat: 'Int32Array', lon: 'Int32Array', neighbors: 'Int32Array',
  land: 'Uint8Array', coastal: 'Uint8Array', country: 'Int16Array', elevation: 'Int16Array',
  roughness: 'Uint16Array', climate: 'Int8Array', terrain: 'Uint8Array', relief: 'Uint8Array',
  feature: 'Uint8Array', rivers: 'Uint8Array', resource: 'Int8Array'
};
const CTORS = { Int32Array, Uint8Array, Int16Array, Uint16Array, Int8Array };
const MAGIC = [0x54, 0x49, 0x42, 0x31]; // "TIB1"

/** tiles.json with its columns as typed arrays (the shape both loaders hand to tiles.js). */
export const columnsFromJson = (raw) => {
  const out = { ...raw };
  Object.entries(COLUMN_TYPES).forEach(([name, type]) => { if (Array.isArray(raw[name])) out[name] = CTORS[type].from(raw[name]); });
  return out;
};

/** tiles.json (plain arrays) -> the binary as a Uint8Array. */
export const encodeTiles = (raw) => {
  const meta = {}; const columns = [];
  Object.keys(raw).forEach((k) => { if (!COLUMN_TYPES[k]) meta[k] = raw[k]; });
  let offset = 0;
  const parts = [];
  Object.entries(COLUMN_TYPES).forEach(([name, type]) => {
    if (raw[name] == null) return;
    const arr = CTORS[type].from(raw[name]);
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    columns.push({ name, type, length: arr.length, offset });
    parts.push({ offset, bytes });
    offset += Math.ceil(bytes.length / 4) * 4;
  });
  const header = new TextEncoder().encode(JSON.stringify({ ...meta, columns }));
  const pad = (n) => Math.ceil(n / 4) * 4;
  const dataStart = 8 + pad(header.length);
  const out = new Uint8Array(dataStart + offset);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(4, header.length, true);
  out.set(header, 8);
  parts.forEach((p) => out.set(p.bytes, dataStart + p.offset));
  return out;
};

/** The binary -> tiles.json's shape with typed-array columns (views on one buffer, no copy). */
export const decodeTiles = (input) => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (MAGIC.some((b, i) => bytes[i] !== b)) throw new Error('Not a tiles binary (TIB1)');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(4, true);
  const { columns, ...meta } = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLength)));
  const dataStart = 8 + Math.ceil(headerLength / 4) * 4;
  // A fresh, aligned buffer: typed-array views need their offsets aligned to the element size.
  const data = new Uint8Array(bytes.subarray(dataStart)).buffer; // a copy (a Node Buffer's slice is a view)
  const out = { ...meta };
  columns.forEach(({ name, type, length, offset }) => { out[name] = new CTORS[type](data, offset, length); });
  return out;
};
