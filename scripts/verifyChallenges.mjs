// scripts/verifyChallenges.mjs
// U36 (KTD16): the challenge verifier. Reads pending submissions with the `verifier` role key,
// replays each in its own child process (time budget, then killed), and writes the verdict and the
// leaderboard row. Env: SUPABASE_URL, CHALLENGE_VERIFIER_KEY (never service_role).
//   node scripts/verifyChallenges.mjs            verify the queue
//   node scripts/verifyChallenges.mjs --file f   verify one local submission JSON, print the verdict
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { engineSources } from './engineSources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bundle = async () => {
  const outfile = path.join(os.tmpdir(), `terra-challenge-verify-${process.pid}.mjs`);
  await build({
    stdin: { contents: "export { verifyChallenge } from '../src/engine/challenges.js'; export { REPLAY_BUDGET_MS, MAX_LOG_BYTES } from '../src/data/challenges.js';", resolveDir: path.join(root, 'scripts'), loader: 'js' },
    outfile, plugins: [engineSources(root)], bundle: true, tsconfigRaw: {}, format: 'esm', platform: 'neutral', target: 'es2022'
  });
  return outfile;
};

/** Verdict of one submission, replayed in a child process so a slow or hostile log is killed. */
export const verifyInChild = (file, sub, budgetMs, maxBytes) => {
  const input = JSON.stringify(sub);
  if (input.length > maxBytes + 1000) return { status: 'rejected', reason: 'size' };
  const code = `import { verifyChallenge } from ${JSON.stringify(pathToFileURL(file).href)}; import fs from 'node:fs'; process.stdout.write(JSON.stringify(verifyChallenge(JSON.parse(fs.readFileSync(0, 'utf8')))));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { input, timeout: budgetMs, maxBuffer: 1 << 20, encoding: 'utf8' });
  if (r.error || r.status !== 0) return { status: 'rejected', reason: r.error?.code === 'ETIMEDOUT' ? 'time budget' : 'replay crashed' };
  try { return JSON.parse(r.stdout); } catch { return { status: 'rejected', reason: 'replay crashed' }; }
};

const main = async () => {
  const file = await bundle();
  const { REPLAY_BUDGET_MS, MAX_LOG_BYTES } = await import(pathToFileURL(file).href);
  const fileArg = process.argv.indexOf('--file');
  if (fileArg > 0) { console.log(JSON.stringify(verifyInChild(file, JSON.parse(readFileSync(process.argv[fileArg + 1], 'utf8')), REPLAY_BUDGET_MS, MAX_LOG_BYTES))); return; }

  const { SUPABASE_URL: url, CHALLENGE_VERIFIER_KEY: key } = process.env;
  if (!url || !key) throw new Error('SUPABASE_URL and CHALLENGE_VERIFIER_KEY are required');
  const rest = async (method, pathAndQuery, body, prefer) => {
    const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, body: body && JSON.stringify(body) });
    if (!res.ok) throw new Error(`${method} ${pathAndQuery.split('?')[0]} ${res.status}`);
    return method === 'GET' ? res.json() : null;
  };
  const rows = await rest('GET', 'challenge_submissions?status=eq.pending&order=created_at.asc&limit=10&select=id,user_id,display_name,week_id,build,claimed_hash,claimed_score,log');
  for (const row of rows) {
    const v = verifyInChild(file, { weekId: row.week_id, build: row.build, hash: row.claimed_hash, score: row.claimed_score, log: row.log }, REPLAY_BUDGET_MS, MAX_LOG_BYTES);
    if (v.status === 'verified') {
      await rest('POST', 'challenge_leaderboard', { submission_id: row.id, user_id: row.user_id, display_name: row.display_name, week_id: row.week_id, score: v.score }, 'resolution=ignore-duplicates,return=minimal');
    }
    await rest('PATCH', `challenge_submissions?id=eq.${row.id}`, { status: v.status, reason: (v.reason || '').slice(0, 200) || null }, 'return=minimal');
    console.log(`${row.id} ${v.status}${v.reason ? ` (${v.reason})` : ''}`);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
