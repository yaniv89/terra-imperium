// Real-browser check of the playtest era saves: each is loaded the way the playtester loads a slice (start screen,
// then window.__game.load, which runs migrateSave) and screenshotted. Needs a build with the QA hook served:
//   VITE_QA_HOOK=1 npm run build && npm run preview
//   node scripts/ai/era-saves-shots.mjs [--ages bronze,modern] [--size phone|desktop] [--url http://localhost:4173/terra-imperium/] [--out dir]
// Prints one line per age (loaded, or why not, and the page errors) and writes <out>/<age>.jpg.
import fs from 'node:fs';
import path from 'node:path';
import { SIZES, openGame, loadSlice, loadSlices } from './human-playtest.mjs';
import { DEFAULT_AGES } from './build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ages = arg('--ages', DEFAULT_AGES.join(',')).split(',');
const size = SIZES[arg('--size', 'phone')];
const url = arg('--url', 'http://localhost:4173/terra-imperium/');
const out = arg('--out', 'plans/ai-output/era-saves-shots');
fs.mkdirSync(out, { recursive: true });
const saves = loadSlices(ages, console.log);
const { launchBrowser } = await import('../lib/browserLaunch.mjs');
const browser = await launchBrowser({ args: ['--disable-dev-shm-usage'] });
let failed = 0;
try {
  for (const age of ages) {
    const g = await openGame(browser, { size, lang: 'en', url });
    const problem = await loadSlice(g, saves[age]).then(() => null, (err) => String(err.message).split('\n')[0]);
    const facts = await g.page.evaluate(() => { const s = window.__game?.state; return s && { turn: s.turnNumber, player: s.playerNationId, pending: (s.pendingDefenses || []).length }; });
    await g.page.screenshot({ path: path.join(out, `${age}.jpg`), type: 'jpeg', quality: 70 });
    if (problem || facts?.turn !== saves[age].turn) failed += 1;
    console.log(`${age}: ${problem || 'loaded'}; in the page turn ${facts?.turn} (save ${saves[age].turn}), ${facts?.player}, battles waiting ${facts?.pending}; page errors ${g.errors.length}${g.errors.length ? `: ${g.errors.slice(0, 2).join(' / ')}` : ''}`);
    await g.ctx.close();
  }
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
