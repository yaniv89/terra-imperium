// src/services/saveCodec.js
// Encodes/decodes the save payload for the `saves` table (supabase/migrations/0003) and extracts
// the small metadata columns cloud save LISTINGS read, so browsing slots never has to download
// (let alone decompress) the full game state — only saveCodec.decodeSave, called for an actual
// load, does that.
//
// Compression is gzip via the Compression Streams API, supported by every browser this app
// targets except Safari < 16.4 — encodeSave falls back to writing plain (uncompressed) `state`
// jsonb when `CompressionStream` isn't available, and decodeSave reads either column transparently
// so a slot written by one browser loads fine in another.
const bytesToBase64 = (bytes) => {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
};

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// { version, state } -> { state_gz, state, size_bytes } ready to spread into a `saves` row.
// size_bytes is always the UNCOMPRESSED json length (what saves_size_check actually limits),
// so the size shown in the UI/admin page means the same thing regardless of which column a
// particular row ended up using.
export const encodeSave = async ({ version, state }) => {
  const json = JSON.stringify({ version, state });
  const size_bytes = json.length;
  if (typeof CompressionStream === 'undefined') {
    return { state_gz: null, state: { version, state }, size_bytes };
  }
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const gzBuffer = await new Response(stream).arrayBuffer();
  return { state_gz: bytesToBase64(new Uint8Array(gzBuffer)), state: null, size_bytes };
};

// A `saves` row (or anything with `state_gz`/`state`) -> the { version, state } payload, the same
// shape saveMigrations.migrateSave expects. Every caller of decodeSave must still run the result
// through migrateSave before using it as live game state — this only reverses the storage
// transport, it doesn't migrate.
export const decodeSave = async (row) => {
  if (row.state_gz) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot open cloud saves (no gzip decompression support). Try a current Chrome, Firefox, or Safari.');
    }
    const bytes = base64ToBytes(row.state_gz);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const json = await new Response(stream).text();
    return JSON.parse(json);
  }
  return row.state;
};

// The handful of columns a save-slot LIST needs to render without decoding anything.
export const saveMetadata = (state) => ({
  nation_id: state.playerNationId,
  nation_name: state.nations?.[state.playerNationId]?.name ?? null,
  turn_number: state.turnNumber,
  game_year: Math.round(state.year),
  age_id: state.age,
  game_status: state.gameStatus
});
