// scripts/ui/phone-pass-battle.mjs
// The phone pass, battle side: the attack card (defense sheet), the pre-battle card on an
// independent city, the battle HUD, the pause sheet and the result screen, at 844x390, 844x340 and
// 1600x900, English and Hebrew. Audits each shot as phone-pass-shots.mjs does.
//   node scripts/ui/phone-pass-battle.mjs [--out dir] [--only 844x390-en] [--swgl]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'audits/phone-pass'));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const PARTS = (arg('--parts', 'campaign,sandbox') || '').split(',');
fs.mkdirSync(OUT, { recursive: true });
const CONFIGS = [];
for (const [w, h] of [[844, 390], [844, 340], [1600, 900]]) for (const lang of ['en', 'he']) CONFIGS.push({ id: `${w}x${h}-${lang}`, w, h, lang, phone: w < 1000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  if (next) window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

const audit = (page, phone) => page.evaluate((phone) => {
  const W = innerWidth; const H = innerHeight; const out = [];
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  for (const el of document.querySelectorAll('button,a[href],input,select,[role=button],[role=switch]')) {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (!r.width || !r.height || s.visibility === 'hidden' || Number(s.opacity) < 0.05) continue;
    if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue;
    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(ps.overflow + ps.overflowX + ps.overflowY)) { const pr = p.getBoundingClientRect(); if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1 || r.right > pr.right + 1) { clipped = true; break; } }
    }
    if (clipped) continue;
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) out.push(`OFF  ${label(el)} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    const hit = document.elementFromPoint(Math.min(W - 1, (r.left + r.right) / 2), Math.min(H - 1, (r.top + r.bottom) / 2));
    const small = (r.height < 40 || r.width < 40) && !el.disabled;
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      const cover = hit.closest('button,a,[role=button]');
      if (cover && phone) out.push(`UNDER ${label(el)} <- ${label(cover)}`);
    } else if (phone && small) {
      const b = getComputedStyle(el, '::before');
      if (!(b.content !== 'none' && b.position === 'absolute')) out.push(`SMALL ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  const text = document.body.innerText;
  for (const m of text.matchAll(/\{[a-zA-Z_]+\}|\bNaN\b|\bundefined\b/g)) out.push(`TEXT ${m[0]} in "${text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ')}"`);
  if (document.scrollingElement.scrollWidth > W + 1) out.push('HSCROLL page');
  return [...new Set(out)];
}, phone);

const report = [];
const run = async (cfg) => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true, args: ['--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, isMobile: cfg.phone, hasTouch: cfg.phone, deviceScaleFactor: cfg.phone ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const shot = async (name) => {
    await wait(600);
    await page.screenshot({ path: path.join(OUT, `${cfg.id}-${name}.png`), timeout: 120000 }).catch(() => {});
    const issues = await audit(page, cfg.phone).catch((e) => [`audit failed ${e}`]);
    report.push({ cfg: cfg.id, name, issues });
    console.log(`${cfg.id} ${name}: ${issues.length ? `\n    ${issues.join('\n    ')}` : 'clean'}`);
  };
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, cfg.lang);
  if (PARTS.includes('campaign')) {
    await page.goto(URL_BASE);
    await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
    await page.locator('input').first().fill('Akkad').catch(() => {});
    await click(page.locator('[data-people]').first());
    await click(page.getByTestId('start-step-ready'));
    await click(page.getByTestId('begin-game'));
    await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
    await wait(2500);
    const skip = page.getByRole('button', { name: /^(Skip|דילוג)/ });
    if (await skip.first().isVisible().catch(() => false)) await click(skip.first());
    const advisor = page.getByTestId('research-let-advisor');
    if (await advisor.isVisible().catch(() => false)) await click(advisor);
    const idle = page.getByTestId('idle-chip'); const found = page.getByTestId('found-city');
    for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(idle).catch(() => {}); await wait(600); }
    if (await found.isVisible().catch(() => false)) { await click(found); await wait(1500); }
    // A war with the nearest major, their army on our capital: the attack card.
    await patch(page, `
      const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
      const others = Object.values(s.nations).filter((n) => n.id !== me && !n.isEliminated); const foe = others.find((n) => !n.indep && n.kind !== 'independent') || others[0];
      const added = m.addCity(s, foe.id, { near: capId }); s = added.state;
      const foeCapId = added.cityId; const foeCap = s.regions[foeCapId];
      const war = { id: 'war_pp', aggressor: foe.id, enemy: me, active: true, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: capId } };
      const u = (id, owner, regionId, tile, classId, strength) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null });
      const units = { ...s.units, g1: u('g1', me, capId, cap.tile, 'infantry', 70), g2: u('g2', me, capId, cap.tile, 'ranged', 50),
        e1: u('e1', foe.id, foeCapId, foeCap.tile, 'infantry', 100), e2: u('e2', foe.id, foeCapId, foeCap.tile, 'infantry', 90), e3: u('e3', foe.id, foeCapId, foeCap.tile, 'ranged', 70) };
      let st = { ...s, units, wars: [...s.wars, war], nations: { ...s.nations, [me]: { ...s.nations[me], isAtWar: true }, [foe.id]: { ...s.nations[foe.id], isAtWar: true } } };
      const def = m.createDefenseRecord(st, { war, regionId: capId, aggressorShare: 0.6, seed: 11, index: 1 });
      return { ...st, pendingDefenses: [def] };`, ['engine/defense.js', 'engine/testWorld.js']).catch((e) => console.log('war patch failed', String(e).slice(0, 200)));
    const sheet = page.getByTestId('defense-sheet');
    if (await sheet.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
      await shot('defense-sheet');
      const auto = page.getByTestId('defense-auto');
      if (await auto.isVisible().catch(() => false)) { await click(auto); await wait(2500); await shot('defense-after-auto'); }
    }
    // the battle report of that fight, if one was written
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-battle-report', { detail: window.__game.state.battleReports?.at(-1)?.id })));
    await wait(1200); await shot('battle-report');
  }
  if (PARTS.includes('sandbox')) {
    await page.goto(`${URL_BASE}?battleSandbox&terrain=plains&age=bronze&seed=11`);
    await wait(2500);
    await shot('sandbox-setup');
    const fight = page.getByRole('button', { name: /^(Fight|להילחם)/ }).first();
    await click(fight);
    await page.getByTestId('battle-pause').waitFor({ timeout: 120000 }).catch(() => {});
    await wait(4000);
    await shot('battle-hud');
    const all = page.getByTestId('battle-select-all');
    if (await all.count()) { await click(all); await wait(800); await shot('battle-hud-selected'); }
    const start = page.getByRole('button', { name: /^(Start the battle|התחילו את הקרב|התחלת הקרב)/ }).first();
    if (await start.isVisible().catch(() => false)) await click(start);
    await wait(3000); await shot('battle-running');
    await click(page.getByTestId('battle-pause'));
    await wait(1200); await shot('battle-pause');
    const leave = page.getByTestId('battle-leave');
    if (await leave.count()) {
      await click(leave); await wait(800); await shot('battle-leave');
      const all2 = page.getByTestId('battle-retreat-all');
      if (await all2.count()) await click(all2);
      const resume = page.getByTestId('battle-resume');
      if (await resume.count()) await click(resume);
      if (await page.getByTestId('battle-result').waitFor({ timeout: 240000 }).then(() => true).catch(() => false)) await shot('battle-result');
    }
  }
  if (errors.length) console.log(`${cfg.id} page errors:\n  ${[...new Set(errors)].join('\n  ')}`);
  await browser.close();
};
for (const cfg of CONFIGS) {
  if (ONLY.length && !ONLY.includes(cfg.id)) continue;
  try { await run(cfg); } catch (e) { console.log(`${cfg.id} FAILED: ${String(e).slice(0, 300)}`); }
}
fs.writeFileSync(path.join(OUT, 'audit-battle.json'), JSON.stringify(report, null, 1));
