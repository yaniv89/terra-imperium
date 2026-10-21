import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runJob, PRICES, estimate, IMAGE_TOKENS_MAX } from './claudeJob.mjs';
import { job as hebrew } from './hebrew-review.mjs';
import { job as glossary } from './glossary-notes.mjs';
import { job as events, toEvent } from './event-cards.mjs';
import { job as factCheck } from './fact-check.mjs';
import { job as shotsQa } from './screenshot-qa.mjs';
import { job as playtester } from './playtester.mjs';
import { createDigest } from '../playtestDigest.mjs';
import { SCREENS, SIZES } from '../ui/qa-shots.mjs';

// Small local inputs, so the tests need no git branch, no screenshots and no 300-turn game.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'terra-ai-test-'));
const CARDS = path.join(TMP, 'cards.json');
fs.writeFileSync(CARDS, JSON.stringify({ cards: { ai_nile_flood: { id: 'ai_nile_flood', year: -1500, ageId: 'bronze', theme: 'nile', subject: { kind: 'city', name: 'Thebes' }, title: 'Flood', description: 'D', options: [{ label: 'a', effects: { gold: 5 } }, { label: 'b', effects: {} }] } }, he: { 'evt.ai_nile_flood.title': 'שיטפון' } }));
const DIGEST = path.join(TMP, 'digest.json');
fs.writeFileSync(DIGEST, JSON.stringify([{ game: 1, seed: 1000, player: { id: 'akkad', name: 'Akkad' }, finalTurn: 20, blocks: [{ turns: '1-10', gold: 500 }], notable: [{ turn: 4, kind: 'event', text: 'The Horse' }] }]));

const SECRET = 'sk-ant-test-DO-NOT-LEAK-0123456789';

describe('AI content jobs (dry run, no network)', () => {
  let fetchSpy;
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', SECRET);
    vi.stubEnv('CARDS_FILE', CARDS);
    vi.stubEnv('PLAYTEST_DIGEST', DIGEST);
    vi.stubEnv('SHOTS_DIR', path.join(TMP, 'no-shots'));
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in tests'));
  });
  afterEach(() => { vi.unstubAllEnvs(); fetchSpy.mockRestore(); });

  it.each([hebrew, glossary, events, factCheck, shotsQa, playtester])('$name builds priced requests and never puts the key in them', async (job) => {
    const lines = [];
    const { requests, est } = await runJob(job, { dryRun: true, limit: 0, maxUsd: 10 }, (l) => lines.push(l));
    expect(requests.length).toBeGreaterThan(0);
    expect(new Set(requests.map((r) => r.custom_id)).size).toBe(requests.length);
    requests.forEach((r) => {
      expect(PRICES[r.params.model]).toBeDefined();
      expect(r.params.max_tokens).toBe(job.maxTokens);
      expect(r.params.output_config.format.type).toBe('json_schema');
    });
    expect(est.worstUsd).toBeLessThanOrEqual(12); // each full run fits the default guard
    const out = JSON.stringify(requests) + lines.join('\n');
    expect(out).not.toContain(SECRET);
    expect(out).not.toMatch(/sk-ant-|x-api-key/);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 60_000);

  it('fact-check sends the hand-written events and the AI cards with their Hebrew', async () => {
    const { requests } = await runJob(factCheck, { dryRun: true, limit: 0, maxUsd: 10 }, () => {});
    const cards = requests.flatMap((r) => JSON.parse(r.params.messages[0].content));
    expect(cards.length).toBeGreaterThanOrEqual(41);
    expect(cards.find((c) => c.id === 'ai_nile_flood')).toMatchObject({ source: 'ai', theme: 'nile', title: { en: 'Flood', he: 'שיטפון' } });
    expect(cards.find((c) => c.id === 'the_horse').title.he).toBeTruthy();
    expect(requests[0].params.model).toBe('claude-opus-5-5');
  }, 60_000);

  it('screenshot-qa prices every screen and size at the image cap and refuses to spend without shots', async () => {
    const { requests, est } = await runJob(shotsQa, { dryRun: true, limit: 0, maxUsd: 10 }, () => {});
    expect(requests.length).toBe(SCREENS.length * SIZES.length);
    const images = requests.flatMap((r) => r.params.messages[0].content.filter((b) => b.type === 'image'));
    expect(images.length).toBe(2 * requests.length);
    expect(est.inTok).toBeGreaterThanOrEqual(images.length * IMAGE_TOKENS_MAX);
    await expect(runJob(shotsQa, { dryRun: false, limit: 0, maxUsd: 10 }, () => {})).rejects.toThrow(/qa-shots/);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 60_000);

  it('the spend guard refuses before any call', async () => {
    await expect(runJob(events, { dryRun: false, limit: 0, maxUsd: 0.01 }, () => {})).rejects.toThrow(/Refusing/);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 60_000);
});

describe('event card shape', () => {
  const cell = { ageId: 'bronze', theme: 'nile', age: { startYear: -2000, endYear: -800 } };
  const card = { id: 'Flood Year', year: -1500, subject: { kind: 'city', name: 'Thebes' }, title: 'T', description: 'D', options: [{ label: 'a', effects: [{ key: 'gold', value: -50 }] }, { label: 'b', effects: [] }], he: { title: 'ת', description: 'ד', options: ['א', 'ב'] } };
  it('turns a model card into an events.js entry and he.events.js keys', () => {
    const { event, he } = toEvent(card, cell);
    expect(event).toMatchObject({ id: 'ai_nile_flood_year', ageId: 'bronze', options: [{ label: 'a', effects: { gold: -50 } }, { label: 'b', effects: {} }] });
    expect(Object.keys(he)).toEqual(['evt.ai_nile_flood_year.title', 'evt.ai_nile_flood_year.desc', 'evt.ai_nile_flood_year.opt0', 'evt.ai_nile_flood_year.opt1']);
  });
  it('drops a card outside its age or with mismatched Hebrew options', () => {
    expect(toEvent({ ...card, year: 100 }, cell)).toBeNull();
    expect(toEvent({ ...card, he: { ...card.he, options: ['א'] } }, cell)).toBeNull();
  });
});

describe('estimates', () => {
  it('counts an image at the cap, not as base64 text', () => {
    const big = 'A'.repeat(400_000);
    const req = { custom_id: 'x', params: { system: 's', messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: big } }] }] } };
    const { inTok } = estimate({ model: 'claude-sonnet-5-5', maxTokens: 10, likelyOut: 5 }, [req]);
    expect(inTok).toBeGreaterThanOrEqual(IMAGE_TOKENS_MAX);
    expect(inTok).toBeLessThan(IMAGE_TOKENS_MAX + 200);
  });
});

describe('playtest digest', () => {
  const base = (over = {}) => ({ turnNumber: 1, year: -2000, gameStatus: 'ACTIVE', playerNationId: 'me', resources: { gold: 100 }, research: { current: 't1', queue: [] }, nations: { me: { name: 'Me' }, ai: { name: 'Ai' }, bi: { name: 'Bi' } }, regions: { c1: { owner: 'me', size: 3, name: 'Kish' }, c2: { owner: 'ai', size: 2, name: 'Ur' } }, units: {}, wars: [], battleReports: [], ...over });
  it('keeps one row per 10 turns and the notable moments with turns', () => {
    const d = createDigest({ playerId: 'me' });
    let prev = base();
    for (let t = 2; t <= 21; t++) {
      const next = base({ turnNumber: t });
      if (t === 5) Object.assign(next, { wars: [{ id: 'w', active: true, aggressor: 'ai', enemy: 'me' }], battleReportSeq: 1, battleReports: [{ id: 'battle-1', name: 'Siege of Kish', outcome: 'defender', playerSide: 'defender', fallen: { defender: 10 } }] });
      if (t > 5 && t < 9) Object.assign(next, { wars: [{ id: 'w', active: true, aggressor: 'ai', enemy: 'me' }], battleReportSeq: 1 });
      if (t === 9) Object.assign(next, { wars: [{ id: 'w', active: false, aggressor: 'ai', enemy: 'me' }], battleReportSeq: 1, regions: { ...prev.regions, c2: { owner: 'me', size: 2, name: 'Ur' } } });
      if (t > 9) Object.assign(next, { battleReportSeq: 1, regions: { ...prev.regions } });
      d.observe(prev, next, 50, t === 3 ? ['The Horse'] : []);
      prev = next;
    }
    const r = d.result(prev);
    expect(r.blocks.map((b) => b.turns)).toEqual(['2-11', '12-21']);
    expect(r.blocks[0]).toMatchObject({ battles: { won: 1, lost: 0, other: 0 }, events: 1, citiesTaken: 1 });
    expect(r.blocks[1].cities).toBe(2);
    expect(r.notable.map((n) => `${n.turn} ${n.kind}`)).toEqual(['3 event', '5 battle', '5 war', '9 peace', '9 city']);
  });
});
