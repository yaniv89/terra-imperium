// scripts/ui/audit-steps/pnl1.mjs
// Extra Hebrew audit screens for the Empire tab (lane B1): a rich empire with every section open, the
// government change dialog, a law change, hiring an advisor, the Legacy tab, the game over
// modal and the age / elimination banners. Run: --only start,pnl1
export default async ({ step, record, tid, has, wait, esc, patch, railTab, closeAllCards, getPage }) => {
  const page = () => getPage();
  const richPatch = `
    const me = s.playerNationId;
    const techTree = Object.fromEntries(Object.entries(s.techTree).map(([k, v]) => [k, { ...v, researched: true }]));
    const nations = { ...s.nations, [me]: { ...s.nations[me], stability: -2, warExhaustion: 20, hasBeenBankrupt: true, laws: { ...(s.nations[me].laws || {}) } } };
    return { ...s, techTree, nations, resources: { ...s.resources, gold: 90000, adm: 2000, dip: 2000, mil: 2000, techPoints: 500 } };`;

  const clickText = async (re, scopeSel = '[data-testid="landscape-dock"]') => {
    const buttons = page().locator(`${scopeSel} button`);
    const n = await buttons.count();
    for (let i = 0; i < n; i += 1) {
      const b = buttons.nth(i);
      const txt = (await b.innerText().catch(() => '')).trim();
      if (re.test(txt) && !(await b.isDisabled().catch(() => true))) { await b.dispatchEvent('click'); await wait(700); return txt; }
    }
    return null;
  };

  await step('pnl1-empire', async () => {
    await closeAllCards();
    await patch(richPatch);
    await wait(600);
    await railTab(0);
    // the audit only opens sections that are on screen: open every one, scrolled or not
    await page().evaluate(async () => { for (const b of document.querySelectorAll('[data-testid="landscape-dock"] [aria-expanded="false"]')) { b.click(); await new Promise((r) => setTimeout(r, 60)); } });
    await wait(400);
    await record('pnl1 empire: rich empire, all sections');
    const hired = await clickText(/^\s*(Hire|שכירת)/);
    if (hired) await record('pnl1 empire: after hiring an advisor');
    const law = await clickText(/\(\d+ (ADM|ניהול)\)/);
    if (law) await record('pnl1 empire: after a law change');
    await page().evaluate(() => document.querySelector('[data-testid="goal-tracker-chip"][aria-expanded="true"]')?.click());
    await wait(300);
    const gov = await clickText(/^\s*(Become|מעבר ל)/);
    await wait(600);
    if (gov && await page().locator('[data-testid="government-change-dialog"]').count()) {
      await record('pnl1 government change dialog');
      const reform = page().locator('[data-testid^="gov-reform-"]');
      if (await reform.count()) { await reform.last().dispatchEvent('click'); await wait(400); await record('pnl1 government change dialog: reform picked'); }
      await esc();
    } else console.log('  no enabled government button');
    await railTab(0);
  });

  await step('pnl1-legacy', async () => {
    await closeAllCards();
    const labels = await tid('landscape-rail').locator('nav button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.innerText));
    const ix = labels.findIndex((l) => /מורשת|Legacy/.test(l));
    if (ix < 0) throw new Error('no Legacy button on the rail');
    await railTab(ix);
    await record('pnl1 legacy tab');
    await railTab(ix);
  });

  await step('pnl1-overview', async () => {
    await closeAllCards();
    await page().evaluate(async () => (await import('/terra-imperium/src/components/ui/uiEvents.js')).openNationOverview());
    await wait(900);
    await record('pnl1 nation overview (rich empire)');
    await closeAllCards();
  });

  await step('pnl1-banners', async () => {
    await closeAllCards();
    await patch('return { ...s, turnNumber: s.turnNumber + 1, age: "classical", playerEliminatedNationId: Object.keys(s.nations).find((id) => id !== s.playerNationId) };');
    await wait(900);
    if (await has(tid('age-banner'))) await record('pnl1 age advance banner'); else console.log('  no age banner');
    if (await has(tid('eliminated-banner'))) await record('pnl1 nation eliminated banner'); else console.log('  no eliminated banner');
    await wait(500);
  });

  await step('pnl1-gameover', async () => {
    await closeAllCards();
    await patch('return { ...s, gameStatus: "VICTORY", victoryConditionId: "domination" };');
    await wait(900);
    await record('pnl1 game over: victory');
    await patch('return { ...s, gameStatus: "COMPLETE", finalRank: 3 };');
    await wait(600);
    await record('pnl1 game over: complete');
    await patch('return { ...s, gameStatus: "DEFEAT" };');
    await wait(600);
    await record('pnl1 game over: defeat');
    await patch('return { ...s, gameStatus: "ACTIVE" };');
    await wait(400);
  });
};
