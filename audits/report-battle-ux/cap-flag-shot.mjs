// audits/report-battle-ux/cap-flag-shot.mjs
// The report's rank 9 stack-cap label: the own army banner (spriteArt.js armyArt) drawn in a real
// browser at phone pixel ratio 3, a small stack (count dot), near the cap (amber 9/12) and over it (red 13/12).
// Dev server first:  npx vite --port 5199 --strictPort --force
//   node audits/report-battle-ux/cap-flag-shot.mjs <out.png>
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';

const out = process.argv[2] || 'cap-flag.png';
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
const browser = await launchBrowser({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 160 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 240000 });
await page.waitForTimeout(8000); // the app's own module graph first: spriteArt alone hits an import cycle
await page.evaluate(async () => {
  const { armyArt } = await import('/terra-imperium/src/components/map/gl/spriteArt.js');
  document.body.innerHTML = '<div id="row" style="display:flex;gap:24px;padding:16px;background:#5d7a3a"></div>';
  const base = { own: true, ownerId: 'x', mainClass: 'infantry', men: 9000, morale: 80, canMove: true };
  for (const m of [{ ...base, count: 3 }, { ...base, count: 9, capUse: [9, 12] }, { ...base, count: 13, capUse: [13, 12] }]) {
    const art = armyArt(m, false, 3);
    const c = document.createElement('canvas'); c.width = art.w; c.height = art.h; c.style.width = `${art.w / 1.5}px`;
    art.draw(c.getContext('2d'));
    document.getElementById('row').appendChild(c);
  }
});
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(out);
await browser.close();
