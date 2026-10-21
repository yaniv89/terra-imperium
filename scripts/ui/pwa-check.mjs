// Checks the install setup in a production build: node scripts/ui/pwa-check.mjs <dist dir>
// (build with VITE_BASE=/ npx vite build --outDir <dir>). Serves the build at the site root,
// then checks the manifest, the icon sizes, the service worker and the Full screen button.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';

const dist = path.resolve(process.argv[2] || 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(dist)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };

const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await launchBrowser({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'allow' });
await ctx.addInitScript(() => {
  window.__fs = [];
  Element.prototype.requestFullscreen = function (opts) { window.__fs.push(opts); return Promise.resolve(); };
});
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });

const man = await (await page.request.get(base + '/manifest.webmanifest')).json();
check('manifest id/start_url/scope', man.id === '/' && man.start_url === '/' && man.scope === '/');
check('manifest display', man.display === 'fullscreen' && man.display_override.includes('standalone'));
for (const icon of man.icons) {
  const buf = Buffer.from(await (await page.request.get(base + '/' + icon.src)).body());
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  check(`icon ${icon.src} ${icon.purpose || ''}`, `${w}x${h}` === icon.sizes);
}
// The app registers the worker itself at start (production build). Wait for it without touching the busy page.
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 90000 }).catch(() => null);
const swUrl = sw?.url();
check('app registered the service worker', !!swUrl && swUrl.endsWith('/sw.js'), swUrl || '');
const swText = await (await page.request.get(base + '/sw.js')).text();
check('service worker has no cache calls', !/caches\./.test(swText.replace(/\/\/.*$/gm, '')));

// Start a game (same steps as hebrew-audit.mjs), open the Menu card and press Full screen.
const tid = (id) => page.getByTestId(id);
const hit = async (loc) => { await loc.first().dispatchEvent('click'); await page.waitForTimeout(450); };
await page.locator('[data-people]').first().waitFor({ timeout: 180000 });
const steps = await page.locator('[data-testid^="start-step-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
await hit(page.locator('[data-people]'));
for (const st of steps) await hit(tid(st));
await hit(tid('begin-game'));
await page.waitForTimeout(2000);
const nextB = page.getByRole('button', { name: 'Next' });
const startB = page.getByRole('button', { name: 'Start playing' });
for (let i = 0; i < 8; i += 1) {
  if (await startB.count()) { await hit(startB); break; }
  if (!(await nextB.count())) break;
  await hit(nextB);
}
await tid('world-top-bar').waitFor({ timeout: 120000 });
const n = await tid('landscape-rail').locator('nav button').count();
await hit(tid('landscape-rail').locator('nav button').nth(n - 1));
await hit(tid('menu-settings')); // the menu hub, then Settings
await tid('settings-sheet').waitFor({ timeout: 10000 });
await tid('settings-fullscreen').click();
let calls = await page.evaluate(() => window.__fs);
check('Menu button calls requestFullscreen with navigationUI hide', calls.length === 1 && calls[0].navigationUI === 'hide');
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
