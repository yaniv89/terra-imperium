#!/usr/bin/env node
// Portable adapter for the unchanged capture-battle-art CLI. No browser in --plan.
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2); const flags = new Set(); const values = {};
const valued = ['--repo', '--out', '--source', '--base', '--scenario', '--profiles', '--qa-raf-ms'];
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (['--run', '--plan', '--help'].includes(key)) flags.add(key);
  else if (valued.includes(key)) {
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    values[key] = value;
  } else throw new Error(`Unknown argument ${key}`);
}
if (flags.has('--help')) {
  console.log('node scripts/art/far-view/capture-far.mjs --plan\n' +
    'node scripts/art/far-view/capture-far.mjs --run --out ../battle-art-far [--base <existing dev URL>]\n' +
    'Optional: --repo <path> --source <capture CLI> --scenario river-bronze,nature-conifer --profiles phone,desktop --qa-raf-ms 200');
  process.exit(0);
}
const run = flags.has('--run') && !flags.has('--plan');
if (run && !values['--out']) throw new Error('--run requires explicit --out outside the repository');
const here = dirname(fileURLToPath(import.meta.url));
const repo = realpathSync(resolve(values['--repo'] || process.cwd()));
const source = resolve(values['--source'] || join(repo, 'scripts/art/capture-battle-art.mjs'));
const canonical = (path) => existsSync(path) ? realpathSync(path) : join(canonical(dirname(path)), relative(dirname(path), path));
const outsideRepo = (path) => { const rel = relative(repo, canonical(path)); return rel !== '' && (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)); };
const out = values['--out'] ? resolve(values['--out']) : null;
if (out && !outsideRepo(out)) throw new Error('--out must be outside the repository, including through symlinks');
if (!existsSync(join(repo, 'package.json'))) throw new Error('Repository package.json not found');
const code = readFileSync(source, 'utf8');
const lodCode = readFileSync(join(repo, 'src/battle/art/kitInstances.js'), 'utf8');
const vegetationCode = readFileSync(join(repo, 'src/battle/art/vegetationProps.js'), 'utf8');
const cameraCode = readFileSync(join(repo, 'src/battle/render/BattleRenderer.js'), 'utf8');
const selector = (text, name) => {
  const match = text.match(new RegExp(`export const ${name} = (.+);`));
  if (!match) throw new Error(`Inspect changed ${name} before capturing`);
  return new Function(`return (${match[1]});`)();
};
const terrainLod = selector(lodCode, 'kitLodForZoom');
const vegetationLod = selector(vegetationCode, 'vegetationLodForZoom');
if (terrainLod(0.5) !== 1 || terrainLod(0.45) !== 2 || vegetationLod(1) !== 1 || vegetationLod(0.5) !== 2 ||
    !cameraCode.includes('Math.max(0.45, Math.min(')) throw new Error('Native zoom/LOD contract changed; revise the far capture plan');
const startAnchor = '        await page.evaluate(() => {\n          const r = window.__battleRenderer;\n          r.centerOn(r.map.w / 2, r.map.h / 2);';
const endAnchor = '        await Promise.all(bodies);\n      } catch (e) {';
const start = code.indexOf(startAnchor); const end = code.indexOf(endAnchor, start);
if (start < 0 || end < 0 || code.indexOf(startAnchor, start + 1) >= 0)
  throw new Error('Capture CLI changed: inspect the adapter anchors before running');
const includes = ['far-terrain.mjs', 'far-conifer.mjs'].map((file) => readFileSync(join(here, file), 'utf8'));
const replacement = '        if (scenario.vegetation) await captureConiferFar({ page, row, scenario, base, shoot });\n' +
  '        else await captureTerrainFar({ page, row, scenario, base, shoot });\n';
const derivedCode = code.slice(0, start) + replacement + code.slice(end) + '\n' + includes.map((s) => s.replace(/^export /gm, '')).join('\n');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const manifest = { status: 'prepared-not-captured', source, repo, out, sourceSha256: hash(code), includeSha256: includes.map(hash),
  nativeZooms: { terrain: [{ zoom: 0.5, LOD: 1 }, { zoom: 0.45, LOD: 2 }], conifer: [{ zoom: 1, LOD: 1 }, { zoom: 0.5, LOD: 2 }] },
  sourceSnapshots: { kitInstances: hash(lodCode), vegetationProps: hash(vegetationCode), BattleRenderer: hash(cameraCode) },
  defaultFrames: 8, scope: 'Bronze terrain and conifer, two native LODs, phone and desktop; other river ages optional.',
  limitation: 'Parent visual review required. Compare live UVs to preservation-only parse; independent packed-file audit remains separate. No forced LOD or synthetic sim state.' };
const forwarded = [run ? '--run' : '--plan', '--repo', repo, '--scenario', values['--scenario'] || 'river-bronze,nature-conifer',
  '--profiles', values['--profiles'] || 'phone,desktop', '--qa-raf-ms', values['--qa-raf-ms'] || '200'];
if (out) forwarded.push('--out', out);
if (values['--base']) forwarded.push('--base', values['--base']);
// Generated code is outside the repository and removed even after a failed capture.
if (!outsideRepo(tmpdir())) throw new Error('OS temporary directory is inside repo; use a repository outside it');
const temporary = mkdtempSync(join(tmpdir(), 'battle-far-qa-'));
try {
  const derived = join(temporary, 'capture-far-derived.mjs'); writeFileSync(derived, derivedCode);
  const check = spawnSync(process.execPath, ['--check', derived], { stdio: 'inherit' });
  if (check.error) throw check.error;
  if (check.status !== 0) throw new Error('Derived capture syntax check failed');
  if (run) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, 'far-plan.json'), JSON.stringify(manifest, null, 2) + '\n'); }
  const planOutput = join(temporary, 'native-plan.json');
  const planFd = run ? null : openSync(planOutput, 'w');
  let result;
  try { result = spawnSync(process.execPath, [derived, ...forwarded], { cwd: repo, stdio: run ? 'inherit' : ['inherit', planFd, 'inherit'] }); }
  finally { if (planFd !== null) closeSync(planFd); }
  if (result.error) throw result.error;
  if (!run) {
    if (result.status !== 0) throw new Error('Capture CLI plan failed');
    console.log(JSON.stringify({ ...manifest, nativeCLIPlan: JSON.parse(readFileSync(planOutput, 'utf8')) }, null, 2));
  }
  process.exitCode = result.status ?? 1;
} finally { rmSync(temporary, { recursive: true, force: true }); }
