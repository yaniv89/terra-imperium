// scripts/audio/mix-levels.mjs
// Measures how loud every effect recording is (its loudest 400 ms, EBU R128 momentary, in LUFS) and
// writes src/audio/mixLevels.json ({ '<category>/<id>': mean of its variants }), which
// src/audio/mixLevels.test.js checks against the mix tiers. Needs ffmpeg on the PATH.
//   node scripts/audio/mix-levels.mjs                 measure and write the json
//   node scripts/audio/mix-levels.mjs --even-variants first bring any variant more than 3 dB from its
//                                                     folder's median back to it (re-encoded in place)
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../src/assets/audio/', import.meta.url).pathname;
const OUT = new URL('../../src/audio/mixLevels.json', import.meta.url).pathname;
const SPREAD_DB = 3;
const PEAK_CEIL = -1; // dBFS: a boost never pushes a variant's peak past this

const files = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : /\.(ogg|mp3)$/.test(n) && !n.includes('.tmp.') ? [p] : [];
});
const ffmpeg = (args) => execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-nostats', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
const ffmpegErr = (args) => spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-nostats', ...args], { encoding: 'utf8' }).stderr; // astats reports on stderr

/** The loudest momentary loudness (LUFS) and the sample peak (dBFS) of one file. */
const measure = (f) => {
  // A short one-shot is padded so the 400 ms window exists.
  const out = ffmpeg(['-i', f, '-af', 'apad=pad_dur=0.5,ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-', '-f', 'null', '-']);
  const m = Math.max(...out.split('\n').filter((l) => l.startsWith('lavfi.r128.M=')).map((l) => Number(l.split('=')[1])).filter(Number.isFinite));
  const err = ffmpegErr(['-i', f, '-af', 'astats=measure_perchannel=none:measure_overall=Peak_level', '-f', 'null', '-']);
  const peak = Number((err.match(/Peak level dB:\s*(-?[\d.]+)/) || [])[1]);
  return { m, peak };
};

// Effects only: the music folder (tracks, battle tracks, ambience beds) is measured by integrated loudness elsewhere.
const all = files(ROOT).filter((f) => !relative(ROOT, f).startsWith('music'));
const groupOf = (f) => relative(ROOT, f).split('/').slice(0, -1).join('/');
const groups = {};
all.forEach((f) => { (groups[groupOf(f)] ||= []).push(f); });

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const levels = {};
for (const [g, list] of Object.entries(groups).sort()) {
  let ms = list.map((f) => ({ f, ...measure(f) }));
  if (process.argv.includes('--even-variants') && ms.length > 1) {
    const mid = median(ms.map((x) => x.m));
    for (const x of ms) {
      const want = mid - x.m;
      if (Math.abs(want) <= SPREAD_DB) continue;
      const db = Math.min(want, PEAK_CEIL - x.peak);
      if (Math.abs(db) < 1) continue;
      const tmp = x.f.replace(/\.\w+$/, '.tmp.ogg');
      ffmpeg(['-y', '-i', x.f, '-af', `volume=${db.toFixed(2)}dB`, '-c:a', 'libvorbis', '-q:a', '3', tmp]);
      renameSync(tmp, x.f);
      console.log(`${relative(ROOT, x.f)}: ${x.m.toFixed(1)} -> ${(x.m + db).toFixed(1)} LUFS (${db > 0 ? '+' : ''}${db.toFixed(1)} dB)`);
    }
    ms = list.map((f) => ({ f, ...measure(f) }));
  }
  const vals = ms.map((x) => x.m);
  levels[g] = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  const spread = Math.max(...vals) - Math.min(...vals);
  if (spread > 2 * SPREAD_DB) console.log(`${g}: variants still ${spread.toFixed(1)} dB apart`);
}
writeFileSync(OUT, `${JSON.stringify(levels, null, 1)}\n`);
console.log(`${Object.keys(levels).length} folders, ${all.length} files -> ${relative(process.cwd(), OUT)}`);
