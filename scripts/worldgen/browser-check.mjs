// scripts/worldgen/browser-check.mjs
// The world generator in a real browser worker (plans/MAP-VARIATIONS-PLAN.md 4.4 and 8.3): opens
// `/?worldLab` on a running dev server, reads each world's hash and time, compares the hashes with
// the Node golden hashes (src/worldgen/worldgen.test.js), runs again with the CPU slowed 4x, and
// can save screenshots at 844x390 and desktop size.
//   npx vite --port 5199 &   then
//   node scripts/worldgen/browser-check.mjs [--url http://localhost:5199] [--seeds 1,2,3] [--shots dir] [--browser chrome|msedge|chromium|webkit|firefox]
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, firefox } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : dflt; };
const url = arg('url', 'http://localhost:5199');
const seeds = arg('seeds', '1,2,3');
const shots = arg('shots', null);
const browserName = arg('browser', 'msedge');
const golden = JSON.parse(/GOLDEN_V1 = (\{[^}]*\})/.exec(readFileSync(path.join(root, 'src/worldgen/worldgen.test.js'), 'utf8'))[1].replace(/(\d+):/g, '"$1":').replace(/'/g, '"'));

const launch = () => {
  if (browserName === 'webkit') return webkit.launch();
  if (browserName === 'firefox') return firefox.launch();
  if (browserName === 'chromium') return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  return chromium.launch({ channel: browserName });
};

const runLab = async (page, throttle) => {
  if (throttle) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.goto(`${url}/?worldLab&seeds=${seeds}${throttle ? '&inline' : ''}`);
  await page.waitForFunction(() => Array.isArray(window.__worldLab), null, { timeout: 240000 });
  return page.evaluate(() => window.__worldLab);
};

const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const results = await runLab(page, 0);
  let ok = true;
  results.forEach((r) => {
    const want = golden[r.seed];
    const match = want ? r.hash === want : null;
    if (match === false) ok = false;
    console.log(`seed ${r.seed}: hash ${r.hash} ${want ? (match ? '= golden' : `!= golden ${want}`) : ''} ${Math.round(r.ms)} ms (worker, with the coast)${r.error ? ` ERROR ${r.error}` : ''}`);
  });
  if (shots) {
    mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'worldlab-desktop.jpg'), type: 'jpeg', quality: 85, fullPage: true, timeout: 180000 });
    const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    for (const seed of seeds.split(',')) {
      await phone.goto(`${url}/?worldLab&seeds=${seed}&big`);
      await phone.waitForFunction(() => Array.isArray(window.__worldLab), null, { timeout: 240000 });
      await phone.screenshot({ path: path.join(shots, `seed-${seed}-844x390.jpg`), type: 'jpeg', quality: 85, timeout: 180000 });
      await page.goto(`${url}/?worldLab&seeds=${seed}&big`);
      await page.waitForFunction(() => Array.isArray(window.__worldLab), null, { timeout: 240000 });
      await page.screenshot({ path: path.join(shots, `seed-${seed}-desktop.jpg`), type: 'jpeg', quality: 85, timeout: 180000 });
    }
  }
  if (browserName !== 'webkit' && browserName !== 'firefox' && !arg('noThrottle', null)) {
    const slow = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const r4 = await runLab(slow, 4);
    r4.forEach((r) => console.log(`seed ${r.seed} at CPU x4: ${Math.round(r.ms)} ms, hash ${r.hash}`));
  }
  console.log(ok ? 'BROWSER HASHES MATCH NODE' : 'BROWSER HASH MISMATCH');
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}
