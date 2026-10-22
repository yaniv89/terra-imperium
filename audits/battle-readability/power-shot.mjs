// Fire Rally Cry and Arrow Storm in the sandbox and shoot the result. node power-shot.mjs <outDir> [w h lang]
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';
import fs from 'fs';
const [outDir, W = '844', H = '390', lang = 'en'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const b = await launchBrowser({ executablePath: process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, hasTouch: true });
await ctx.addInitScript((l) => { localStorage.setItem('ti.coach.firstBattle', '1'); localStorage.setItem('terra-imperium.language', l); }, lang);
const p = await ctx.newPage();
await p.goto(`${process.env.URL || 'http://localhost:5231/terra-imperium/'}?battleSandbox&autostart&age=kingdoms`, { waitUntil: 'domcontentloaded', timeout: 240000 });
await p.getByTestId('battle-pause').waitFor({ timeout: 120000 }); await p.waitForTimeout(2000);
await p.getByTestId('battle-pause').click(); await p.getByTestId('battle-speed-3').click(); await p.waitForFunction(() => window.__battleView().supply[0] >= 280, null, { timeout: 120000 }); await p.getByTestId('battle-speed-1').click(); await p.waitForTimeout(500);
const pos = await p.evaluate(() => { const v = window.__battleView(); const m = v.squads.filter((q) => q.side === 0 && q.alive && q.onField && q.classId !== 'worker'); const x = m.reduce((s, q) => s + q.x, 0) / m.length / 256; const z = m.reduce((s, q) => s + q.y, 0) / m.length / 256; const r = window.__battleRenderer; r.centerOn(x, z); r.updateCamera(); return { x, z, pw: v.powers.map((q) => q.id) }; });
console.log('powers', pos.pw);
await p.evaluate(({ x, z }) => { window.__battleOrders([{ type: 'power', power: 'rallyCry', x: 0, y: 0 }, { type: 'power', power: 'arrowStorm', x: Math.round((x + 5) * 256), y: Math.round(z * 256) }]); }, pos);
await p.waitForTimeout(900);
await p.screenshot({ path: `${outDir}/${W}x${H}-${lang}-power.png` });
await b.close();
