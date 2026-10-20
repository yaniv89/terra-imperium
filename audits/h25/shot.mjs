// node audits/h25/shot.mjs <out.png> "<query>"   (dev server on 5201) - a town battle at a phone size, camera on the keep
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';
const [out, query = ''] = process.argv.slice(2);
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
await page.goto(`http://localhost:5201/terra-imperium/?battleSandbox${query}`);
await page.getByRole('button', { name: 'Fight' }).click();
await page.getByTestId('battle-pause').waitFor({ timeout: 60000 });
await page.getByTestId('battle-pause').click();
await page.waitForTimeout(6000);
await page.evaluate(() => { const r = window.__battleRenderer; const k = r.setup.structures.find((s) => s.kind === 'keep') || r.setup.structures[0]; r.centerOn((k.x / 256), (k.y / 256)); });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log(`saved ${out}; messages:\n${errors.slice(0, 8).join('\n')}`);
await browser.close();
