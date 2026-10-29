// The sack defence's goal line at 844x390: ?battleSandbox&raid=sack, Fight, Start, a few seconds in.
import { launchBrowser } from '/home/user/terra-imperium/scripts/lib/browserLaunch.mjs';
const [out, lang = 'en'] = process.argv.slice(2);
const browser = await launchBrowser({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
if (lang === 'he') await page.addInitScript(() => { try { localStorage.setItem('terra-imperium.language', 'he'); } catch {} });
await page.goto(`http://localhost:5199/terra-imperium/?battleSandbox&raid=sack&lang=${lang}`);
await page.locator('button').filter({ hasText: /Fight|קרב|הילחם|לקרב/ }).first().click();
await page.getByTestId('battle-start').first().waitFor({ timeout: 120000 });
await page.waitForTimeout(1500);
await page.getByTestId('battle-start').first().click();
await page.waitForTimeout(6000);
console.log('loot line:', await page.getByTestId('battle-loot').innerText().catch(() => 'none'));
console.log('html dir:', await page.evaluate(() => document.documentElement.dir));
await page.screenshot({ path: out, quality: 75 });
await browser.close();
