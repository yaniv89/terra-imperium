import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runJob, PRICES } from './claudeJob.mjs';
import { job as hebrew } from './hebrew-review.mjs';
import { job as glossary } from './glossary-notes.mjs';
import { job as events, toEvent } from './event-cards.mjs';

const SECRET = 'sk-ant-test-DO-NOT-LEAK-0123456789';

describe('AI content jobs (dry run, no network)', () => {
  let fetchSpy;
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', SECRET);
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in tests'));
  });
  afterEach(() => { vi.unstubAllEnvs(); fetchSpy.mockRestore(); });

  it.each([hebrew, glossary, events])('$name builds priced requests and never puts the key in them', async (job) => {
    const lines = [];
    const { requests, est } = await runJob(job, { dryRun: true, limit: 0, maxUsd: 10 }, (l) => lines.push(l));
    expect(requests.length).toBeGreaterThan(0);
    expect(new Set(requests.map((r) => r.custom_id)).size).toBe(requests.length);
    requests.forEach((r) => {
      expect(PRICES[r.params.model]).toBeDefined();
      expect(r.params.max_tokens).toBe(job.maxTokens);
      expect(r.params.output_config.format.type).toBe('json_schema');
    });
    expect(est.worstUsd).toBeLessThanOrEqual(10); // each full run fits the default guard
    const out = JSON.stringify(requests) + lines.join('\n');
    expect(out).not.toContain(SECRET);
    expect(out).not.toMatch(/sk-ant-|x-api-key/);
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
