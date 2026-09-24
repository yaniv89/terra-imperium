import { describe, it, expect, vi, afterEach } from 'vitest';
import { encodeSave, decodeSave, saveMetadata } from './saveCodec';

const samplePayload = () => ({
  version: 1,
  state: {
    playerNationId: 'fr',
    turnNumber: 42,
    year: 1523.7,
    age: 'kingdoms',
    gameStatus: 'ACTIVE',
    nations: { fr: { name: 'France' } },
    // A real state has thousands of region/unit entries; padding here just makes gzip's size win
    // over plain JSON actually observable rather than noise-level on a tiny payload.
    regions: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`r${i}`, { owner: 'fr', control: 100, unrest: 0 }]))
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('encodeSave / decodeSave round-trip', () => {
  it('round-trips through gzip when CompressionStream is available', async () => {
    const payload = samplePayload();
    const encoded = await encodeSave(payload);
    expect(encoded.state_gz).toBeTruthy();
    expect(encoded.state).toBeNull();
    expect(encoded.size_bytes).toBe(JSON.stringify(payload).length);

    const decoded = await decodeSave({ state_gz: encoded.state_gz, state: null });
    expect(decoded).toEqual(payload);
  });

  it('gzip is meaningfully smaller than the raw JSON for a realistic payload', async () => {
    const payload = samplePayload();
    const encoded = await encodeSave(payload);
    // base64 inflates gzip's raw byte count by ~4/3, so this is a conservative bound, not gzip's
    // real ratio — the point is proving compression happened, not pinning an exact ratio.
    expect(encoded.state_gz.length).toBeLessThan(encoded.size_bytes * 0.6);
  });

  it('falls back to plain state jsonb when CompressionStream is unavailable', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const payload = samplePayload();
    const encoded = await encodeSave(payload);
    expect(encoded.state_gz).toBeNull();
    expect(encoded.state).toEqual(payload);
    expect(encoded.size_bytes).toBe(JSON.stringify(payload).length);
  });

  it('decodeSave reads the plain state column when there is no state_gz', async () => {
    const payload = samplePayload();
    await expect(decodeSave({ state_gz: null, state: payload })).resolves.toEqual(payload);
  });

  it('decodeSave throws a friendly error for a gzip row when decompression is unavailable', async () => {
    const payload = samplePayload();
    const encoded = await encodeSave(payload);
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(decodeSave({ state_gz: encoded.state_gz, state: null })).rejects.toThrow(/cannot open cloud saves/);
  });
});

describe('saveMetadata', () => {
  it('extracts the listing columns from a state', () => {
    const { state } = samplePayload();
    expect(saveMetadata(state)).toEqual({
      nation_id: 'fr',
      nation_name: 'France',
      turn_number: 42,
      game_year: 1524,
      age_id: 'kingdoms',
      game_status: 'ACTIVE'
    });
  });

  it('falls back to null nation_name when the nation record is missing', () => {
    expect(saveMetadata({ playerNationId: 'xx', nations: {}, turnNumber: 1, year: 0, age: 'bronze', gameStatus: 'ACTIVE' }).nation_name).toBeNull();
  });
});
