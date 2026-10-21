// scripts/ai/claudeJob.mjs
// The shared runner for the AI content jobs (plans/ai-output/README.md). Development only: it runs in
// GitHub Actions with the repository secret ANTHROPIC_API_KEY and is never part of the game build.
// A job is { name, model, maxTokens, effort, buildRequests(src), writeOutputs(results, src, outDir) }.
// Bulk work goes through the Message Batches API (half price), polled until it ends; the raw results
// land in <outDir>/results.jsonl and the job writes its review files next to them.
//   node scripts/ai/<job>.mjs --dry-run           request count and cost estimate, no network, no key
//   node scripts/ai/<job>.mjs --limit 5           a small trial run
//   node scripts/ai/<job>.mjs --max-usd 10        refuse to start if the worst case costs more
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { engineSources } from '../engineSources.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'https://api.anthropic.com/v1/messages/batches';

// Standard $ per million tokens, from the claude-api skill's model table (cached 2026-10-06).
// Haiku 5.5's price holds for prompts up to 100K tokens; every request here is far below that.
export const PRICES = Object.freeze({
  'claude-haiku-5-5': { in: 0.10, out: 0.50 },
  'claude-sonnet-5-5': { in: 2.00, out: 10.00 },
  'claude-opus-5-5': { in: 4.00, out: 20.00 }
});
export const BATCH_DISCOUNT = 0.5; // the Message Batches API bills every token at half price

const usd = (model, inTok, outTok) => {
  const p = PRICES[model];
  if (!p) throw new Error(`No price for ${model}: add it to PRICES`);
  return ((inTok * p.in + outTok * p.out) / 1e6) * BATCH_DISCOUNT;
};

// shortcut: a character-count guess (Hebrew costs more tokens a character), with a 25% margin;
// the exact count needs the API key (count_tokens), so upgrade if estimates and bills drift apart.
export const estTokens = (text) => {
  const s = String(text);
  const ascii = [...s].filter((c) => c.charCodeAt(0) < 128).length;
  return Math.ceil(1.25 * (ascii / 4 + (s.length - ascii) / 1.5));
};

// An image's input tokens: the claude-api skill's high-resolution tier (Opus 4.7 and later, Sonnet 5 and later)
// takes up to 2576 px on the long edge and about 4784 tokens an image. Every image is charged that cap
// (an 844x390 shot at DPR 2 is nearer 1,700), so the image part of the guard stays an upper bound.
export const IMAGE_TOKENS_MAX = 4784;
const requestInTok = (r) => {
  let images = 0;
  const text = JSON.stringify(r.params.messages, (k, v) => (v && v.type === 'image' ? (images += 1, null) : v));
  return estTokens(JSON.stringify(r.params.system) + text) + images * IMAGE_TOKENS_MAX;
};

/** Input tokens guessed, output capped at max_tokens (thinking counts toward it), so `worstUsd` is a bound. */
export const estimate = (job, requests) => {
  const inTok = requests.reduce((a, r) => a + requestInTok(r), 0);
  const outCap = requests.length * job.maxTokens;
  return { requests: requests.length, inTok, outCap, worstUsd: usd(job.model, inTok, outCap), likelyUsd: usd(job.model, inTok, requests.length * job.likelyOut) };
};

/** One request's params: JSON output through structured outputs, adaptive thinking at the job's effort. */
export const params = (job, system, user, schema) => ({
  model: job.model,
  max_tokens: job.maxTokens,
  system,
  messages: [{ role: 'user', content: user }], // a string, or content blocks (text and images)
  output_config: { effort: job.effort, format: { type: 'json_schema', schema } }
});

/** Bundles a few src/ exports (bundler-style imports) into a temp module and imports it. */
export const loadSrc = async (code) => {
  const outfile = path.join(os.tmpdir(), `terra-ai-src-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  await build({ stdin: { contents: code, resolveDir: ROOT, loader: 'js' }, outfile, plugins: [engineSources(ROOT)], bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', logLevel: 'error' });
  try { return await import(pathToFileURL(outfile).href); } finally { fs.rmSync(outfile, { force: true }); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with retries on 429, 5xx, 529 and network errors. Messages never include headers, so never the key. */
export const call = async (url, { key, method = 'GET', body, tries = 6 }) => {
  for (let i = 1; ; i++) {
    let res;
    try {
      res = await fetch(url, { method, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    } catch (e) {
      if (i >= tries) throw new Error(`${method} ${url} failed: ${e.message}`);
      await sleep(2000 * 2 ** i); continue;
    }
    if (res.ok) return res;
    const retry = res.status === 429 || res.status >= 500;
    const text = (await res.text()).slice(0, 500);
    if (!retry || i >= tries) throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
    await sleep((Number(res.headers.get('retry-after')) || 2 * 2 ** i) * 1000);
  }
};

/** Parses a succeeded result's JSON text, else null. */
export const resultJson = (r) => {
  if (r.result?.type !== 'succeeded') return null;
  const text = r.result.message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { return null; }
};

export const parseArgs = (argv) => {
  const val = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : dflt; };
  const limit = Number(val('--limit', 0)) || 0;
  const maxUsd = Number(val('--max-usd', 10));
  if (!(maxUsd > 0)) throw new Error('--max-usd must be a positive number');
  return { dryRun: argv.includes('--dry-run'), limit, maxUsd };
};

/** Builds the job's requests and prints the estimate; without --dry-run, runs the batch and writes the outputs. */
export const runJob = async (job, { dryRun, limit, maxUsd }, log = console.log) => {
  const src = await job.loadData();
  let requests = job.buildRequests(src);
  if (limit) requests = requests.slice(0, limit);
  const est = estimate(job, requests);
  log(`${job.name}: ${est.requests} requests on ${job.model} (batch), about ${est.inTok} input tokens, output capped at ${est.outCap}`);
  log(`${job.name}: likely $${est.likelyUsd.toFixed(2)}, worst case $${est.worstUsd.toFixed(2)} (guard $${maxUsd})`);
  if (dryRun) return { est, requests };
  job.check?.(src); // a job's own refusal before any spend (e.g. no screenshots to send)
  if (est.worstUsd > maxUsd) throw new Error(`Refusing: worst case $${est.worstUsd.toFixed(2)} is over --max-usd ${maxUsd}`);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');

  const created = await (await call(API, { key, method: 'POST', body: { requests } })).json();
  log(`${job.name}: batch ${created.id} created`);
  let batch = created;
  while (batch.processing_status !== 'ended') {
    await sleep(30_000);
    batch = await (await call(`${API}/${created.id}`, { key })).json();
    log(`${job.name}: ${batch.processing_status}, ${JSON.stringify(batch.request_counts)}`);
  }
  const jsonl = await (await call(batch.results_url, { key })).text();
  const results = jsonl.split('\n').filter(Boolean).map((l) => JSON.parse(l));

  const outDir = path.join(ROOT, 'plans/ai-output', job.name);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'results.jsonl'), jsonl);
  job.writeOutputs(results, src, outDir);

  const u = results.reduce((a, r) => {
    const m = r.result?.message?.usage || {};
    return { in: a.in + (m.input_tokens || 0) + (m.cache_creation_input_tokens || 0) + (m.cache_read_input_tokens || 0), out: a.out + (m.output_tokens || 0) };
  }, { in: 0, out: 0 });
  const failed = results.filter((r) => r.result?.type !== 'succeeded').length;
  log(`${job.name}: ${results.length - failed} succeeded, ${failed} failed; ${u.in} input + ${u.out} output tokens = $${usd(job.model, u.in, u.out).toFixed(2)} at batch prices`);
  return { est, results };
};

/** Runs the job when its file is the entry point. */
export const cli = (job, metaUrl) => {
  if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === metaUrl) {
    runJob(job, parseArgs(process.argv.slice(2))).catch((e) => { console.error(e.message); process.exit(1); });
  }
};
