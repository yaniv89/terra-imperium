// The lead's steps at 844x390: Fight, Start, 3x, then each game minute All, Enemy, Attack, tap the field centre.
import { launchBrowser } from '/home/user/terra-imperium/scripts/lib/browserLaunch.mjs';
const out = process.argv[2]; const minutes = Number(process.argv[3] || 5); const lang = process.env.LANG_UI || 'en';
const browser = await launchBrowser({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  window.__sent = [];
  const pm = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (m, ...r) { try { if (m && JSON.stringify(m).includes('"squads"')) window.__sent.push(JSON.stringify(m).slice(0, 600)); } catch {} return pm.call(this, m, ...r); };
});
if (lang === 'he') await page.addInitScript(() => { try { localStorage.setItem('terra-imperium.language', 'he'); } catch {} });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:5199/terra-imperium/?battleSandbox${lang === 'he' ? '&lang=he' : ''}`);
await page.getByRole('button', { name: /Fight|קרב|הילחם/ }).first().click();
await page.getByTestId('battle-start').first().waitFor({ timeout: 90000 });
await page.waitForTimeout(1500);
await page.getByTestId('battle-start').first().click();
await page.waitForTimeout(800);
for (let k = 0; k < 3; k++) { const b = page.locator('button').filter({ hasText: /^(Skip|דלג|דילוג)$/ }); if (await b.count()) await b.first().click().catch(() => {}); await page.waitForTimeout(300); }
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
const hud = () => page.evaluate(() => { const v = window.__battleView?.(); if (!v) return null; const s = (side) => v.squads.filter((q) => q.side === side && !q.worker).reduce((a, q) => a + Math.max(0, q.strength), 0); return { t: (v.tick / 20).toFixed(0), you: s(0), them: s(1), keep: v.structures?.[0]?.hp, ended: !!v.ended }; });
for (let m = 0; m < minutes; m++) {
  await page.getByTestId('battle-select-all').click().catch(() => {});
  await page.waitForTimeout(150);
  await page.getByTestId('battle-objective').first().click().catch((e) => console.log('no enemy btn', e.message.slice(0, 80)));
  await page.waitForTimeout(400);
  await page.getByTestId('battle-attack-move').click().catch((e) => console.log('no attack btn', e.message.slice(0, 80)));
  await page.waitForTimeout(150);
  await page.mouse.click(422, 200);
  await page.waitForTimeout(300);
  if (m === 0 || m === 3) await page.screenshot({ path: `${out}-m${m}.jpg`, quality: 70 });
  console.log('min', m, JSON.stringify(await hud()), 'sent:', (await page.evaluate(() => window.__sent.splice(0))).filter((x) => !x.includes('"autoRebuild"')).join(' | ').slice(0, 900));
  for (let k = 0; k < 4; k++) { await page.waitForTimeout(5000); console.log('  ', JSON.stringify(await hud())); }
  if ((await hud())?.ended) break;
}
await page.screenshot({ path: `${out}-end.jpg`, quality: 70 });
console.log('errors', errors.slice(0, 5));
await browser.close();
