// scripts/ui/audit-steps/city.mjs
// Extra Hebrew audit screens for the city sheet: every Build tab group, a queue with items and the
// rush offer, the army template editor, a city with buildings, unrest / governor notes on Politics,
// and a siege on Defense. Run: --only start,city
export default async ({ step, record, click, tid, has, wait, patch, gs, manage, capitalId, closeAllCards, getPage }) => {
  const page = () => getPage();

  await step('city-build', async () => {
    await closeAllCards();
    const cap = await capitalId();
    await patch('return { ...s, resources: { ...s.resources, gold: 5000, adm: 50, dip: 50, mil: 50 } };');
    await manage(cap, 'build');
    await wait(1200);
    for (const g of ['units', 'armies', 'improvements', 'buildings', 'wonders', 'all']) {
      const b = tid(`build-group-${g}`);
      if (await has(b)) { await click(b); await record(`city build group ${g}`); }
    }
    // queue the first few buildable rows, open the queue and the rush offer
    for (let i = 0; i < 4; i += 1) {
      const btn = page().locator('[data-testid="queue-item"]:not([disabled])').nth(i);
      if (await btn.count()) await click(btn);
    }
    await record('city build: after queueing');
    const toggle = tid('city-queue-toggle');
    if (await has(toggle)) { await click(toggle); await record('city build: queue open'); }
    const rush = tid('city-rush-open');
    if (await has(rush)) { await click(rush); await record('city build: rush offer'); }
    const row = page().locator('[data-testid="build-row"] [role="button"]').first();
    if (await has(row)) { await click(row); await record('city build: row details'); }
    // a refused add (the same thing again) shows the reason line
    const dup = page().locator('[data-testid="queue-item"]').first();
    if (await dup.count()) { await dup.dispatchEvent('click'); await wait(300); await record('city build: refused add'); }
    // army template editor
    const tpl = tid('army-templates');
    if (await has(tpl)) {
      await tpl.locator('button').first().dispatchEvent('click'); await wait(400);
      await record('city build: template editor new');
      const plus = tid('army-template-editor').locator('button', { hasText: '+' }).first();
      if (await plus.count()) await plus.dispatchEvent('click');
      await wait(300);
      await record('city build: template editor filled');
      await tid('army-template-editor').locator('button').last().dispatchEvent('click'); await wait(300);
      const edit = tpl.locator('ul button').first();
      if (await edit.count()) { await edit.dispatchEvent('click'); await wait(300); await record('city build: template editor edit'); }
    }
  });

  await step('city-buildings', async () => {
    await closeAllCards();
    const cap = await capitalId();
    await patch(`const id = s.nations[s.playerNationId].capitalRegionId; const c = s.regions[id];
      const cats = Object.keys(m.BUILDING_CATEGORIES).slice(0, 4);
      const categories = { ...(c.buildings?.categories || {}) }; cats.forEach((k) => { categories[k] = 0; });
      return { ...s, regions: { ...s.regions, [id]: { ...c, buildings: { ...(c.buildings || {}), categories } } } };`, ['data/buildings.js']);
    await manage(cap, 'buildings');
    await wait(1000);
    await record('city buildings: with buildings built');
    // develop buttons, to reach a log line or a refusal
    const btns = page().locator('[data-testid="city-development"] button');
    if (await btns.count()) { await btns.first().dispatchEvent('click'); await wait(300); await record('city buildings: after a develop tap'); }
  });

  await step('city-politics', async () => {
    await closeAllCards();
    const cap = await capitalId();
    await patch(`const id = s.nations[s.playerNationId].capitalRegionId; const c = s.regions[id];
      return { ...s, regions: { ...s.regions, [id]: { ...c, unrest: 40, control: 30, devastation: 20, loyalty: 20 } } };`);
    await manage(cap, 'politics');
    await wait(1000);
    await record('city politics: unrest, devastation, low loyalty');
    const crown = tid('city-crown').locator('button');
    if (await crown.count()) { await crown.first().dispatchEvent('click'); await wait(300); await record('city politics: after a crown tap'); }
  });

  await step('city-defense', async () => {
    await closeAllCards();
    const cap = await capitalId();
    const other = await gs('return Object.values(s.nations).find((n) => !n.indep && n.id !== s.playerNationId && !n.isEliminated)?.id;');
    await patch(`const id = s.nations[s.playerNationId].capitalRegionId; const c = s.regions[id];
      return { ...s, regions: { ...s.regions, [id]: { ...c, siege: { by: ${JSON.stringify(other)}, hp: 120, maxHp: 240, encircled: true }, cityDamage: { ruined: {}, damaged: {} } } } };`);
    await manage(cap, 'defense');
    await wait(1000);
    await record('city defense: under siege');
    await manage(cap, 'overview');
    await wait(800);
    await record('city overview: under siege');
    await patch(`const id = s.nations[s.playerNationId].capitalRegionId; const c = s.regions[id]; return { ...s, regions: { ...s.regions, [id]: { ...c, siege: null } } };`);
  });

  await step('city-tiles', async () => {
    await closeAllCards();
    const cap = await capitalId();
    await manage(cap, 'tiles');
    await wait(1000);
    const lock = page().locator('button[aria-label]').filter({ has: page().locator('svg') }).first();
    await record('city citizens: tiles');
    const buy = tid('buy-tile');
    if (await has(buy)) { await buy.first().dispatchEvent('mouseover'); }
    if (await lock.count()) { /* tap a lock to show the locked state */ }
    const lockBtn = page().locator('[data-testid="city-tiles"] li button.fa-icon-btn').first();
    if (await lockBtn.count()) { await lockBtn.dispatchEvent('click'); await wait(300); await record('city citizens: one tile locked'); }
  });
};
