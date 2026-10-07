// scripts/art/build-icons.mjs
// Renders the battle build menu's building icons from the battle's own models (rts-<age>.glb, the
// greyboxes where a role has no object yet) into src/assets/icons/battle/<icon>.webp, the ids of
// data/economy.js BUILDINGS[*].icon (build-house, build-town-hall ...). Rerun after new building art.
// Start the dev server first:  npx vite --port 5199 --strictPort
//   node scripts/art/build-icons.mjs [--size 144] [--age bronze] [--out src/assets/icons/battle]
// URL=<dev server base> picks another server; CHROME=<path> the browser.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const size = Number(opt('size', 144));
const age = opt('age', 'bronze');
const outDir = opt('out', 'src/assets/icons/battle');
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
const chrome = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page] ${m.text()}`); });
await page.goto(`${base}scripts/art/build-icons.html?size=${size}&age=${age}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__buildIcons || window.__buildIconsError, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__buildIconsError);
if (err) { console.error(err); process.exit(1); }
const { icons, sources } = await page.evaluate(() => ({ icons: window.__buildIcons, sources: window.__buildIconSources }));
for (const [id, url] of Object.entries(icons)) {
  const file = join(outDir, `${id}.webp`);
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${file}  ${sources[id]}`);
}
await browser.close();
