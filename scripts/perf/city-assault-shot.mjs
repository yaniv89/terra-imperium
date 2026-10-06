// scripts/perf/city-assault-shot.mjs
// Screenshots of a city assault in a real browser (plans/MASTER-PLAN.md phase B): the battle
// sandbox loads a real city from its manifest (?battleSandbox&city=medium&ruined=4&damaged=4),
// shot once at the start (the town, its earlier ruins and damage, the wall ring) and once after the
// player's army has been ordered onto the keep and onto two houses (destruction, rubble).
// Start a dev server first (npx vite --port 5233 --strictPort), then:
//   CHROMIUM="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/perf/city-assault-shot.mjs <outDir> [query]
import { chromium } from '@playwright/test';

const outDir = process.argv[2] || '.';
const query = process.argv[3] || 'city=medium&ruined=4&damaged=4&age=classical&fort=2';
const url = `${process.env.URL || 'http://localhost:5233/terra-imperium/'}?battleSandbox&${query}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 720) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.getByRole('button', { name: 'Fight' }).click();
await page.getByTestId('battle-pause').waitFor({ timeout: 60000 });
await page.getByTestId('battle-pause').click(); // start (the field is shot in the first seconds)
await page.waitForTimeout(4000); // the town file loads
const info = await page.evaluate(() => {
  const r = window.__battleRenderer; const k = r.setup.structures[0];
  r.zoomBy(Number(new URLSearchParams(location.search).get('zoom') || 1.7)); r.centerOn(k.x / 256 - 3, k.y / 256); // zoom first: zoomBy keeps the old view's centre
  const kinds = {};
  r.setup.structures.forEach((s) => { kinds[s.kind] = (kinds[s.kind] || 0) + 1; });
  return { city: r.setup.city, kinds, town: !!r.cityLayer?.town };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/city-assault-start.png` });
// Orders: the army onto the keep, two squads onto the nearest two standing houses.
await page.evaluate(() => {
  const r = window.__battleRenderer; const k = r.setup.structures[0];
  const houses = r.setup.structures.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'house' && s.alive).sort((a, b) => a.s.x - b.s.x).slice(0, 2);
  window.__battleOrders([{ side: 0, type: 'attackMove', squads: Array.from({ length: 16 }, (_, i) => i).slice(2), x: k.x - 4 * 256, y: k.y }]);
  houses.forEach(({ i }, n) => window.__battleOrders([{ side: 0, type: 'attack', squads: [n], target: { kind: 'structure', index: i } }]));
});
for (let i = 0; i < 2; i++) await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^[123]×$/.test(x.textContent.trim())); b?.click(); }); // 3x
for (let s = 0; s < Number(process.env.SECONDS || 45); s += 5) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => { const r = window.__battleRenderer; return { rubble: r.cityLayer?.rubble?.count, frame: r.frameTimes?.slice(-30).reduce((a, b) => a + b, 0) / 30 }; });
  console.log(`t+${s + 5}s ${JSON.stringify(st)}`);
}
await page.evaluate(() => { const r = window.__battleRenderer; const k = r.setup.structures[0]; r.centerOn(k.x / 256 - 5, k.y / 256); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/city-assault-fight.png` });
console.log(`console errors/warnings (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
await browser.close();
