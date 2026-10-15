// scripts/ui/audit-steps/pnl2.mjs
// Extra Hebrew audit screens for Research and Peoples (lane B2): a tech under way with a queue, the web with
// nodes clicked, a met nation expanded, at war, at peace / trade, the pending demand, tribute, join and map
// offer cards, and the first contact card. Run: --only start,pnl2
export default async ({ step, record, click, tid, has, wait, esc, patch, gs, evalMod, railTab, closeAllCards, getPage }) => {
  const page = () => getPage();
  const dispatch = (type, payload) => page().evaluate(({ type, payload }) => window.__game.dispatch({ type, payload }), { type, payload });

  await step('pnl2-research', async () => {
    await closeAllCards();
    const techs = await page().evaluate(async () => {
      const m = await import('/terra-imperium/src/engine/research.js');
      const s = window.__game.state;
      return m.suggestTechs(s, s.playerNationId, 3);
    });
    await dispatch('RESEARCH_TECH', { techId: techs[0] });
    if (techs[1]) await dispatch('QUEUE_RESEARCH', { techId: techs[1] });
    if (techs[2]) await dispatch('QUEUE_RESEARCH', { techId: techs[2] });
    await patch('return { ...s, resources: { ...s.resources, techPoints: 37, gold: 5000, adm: 50, dip: 50, mil: 50 }, researchFocus: "science" };');
    await wait(500);
    await railTab(2);
    await record('pnl2 tech: current and queue');
    await click(tid('research-web-toggle'));
    const avail = page().locator('[data-testid^="web-"][data-status="available"]');
    if (await avail.count()) { await avail.first().dispatchEvent('click'); await wait(400); }
    const locked = page().locator('[data-testid^="web-"][data-status="locked"]');
    if (await locked.count()) { await locked.first().dispatchEvent('click'); await wait(400); }
    await record('pnl2 tech: web after clicks');
    await click(tid('research-web-toggle'));
    await railTab(2);
    // a calendar ahead of the techs: the "ages behind" notice
    await patch('return { ...s, age: "gunpowder" };');
    await railTab(2);
    await record('pnl2 tech: ages behind');
    await railTab(2);
    await patch('return { ...s, age: "bronze" };');
  });

  await step('pnl2-peoples', async () => {
    await closeAllCards();
    const ids = await gs('return Object.values(s.nations).filter((n) => !n.isPlayer && n.id !== s.playerNationId && !n.isEliminated && !n.indep && n.kind !== "independent").slice(0, 4).map((n) => n.id);');
    await patch(`const me = s.playerNationId; const ids = ${JSON.stringify(ids)}; const met = { ...(s.fog?.met?.[me] || {}) }; ids.forEach((i) => { met[i] = 1; }); return { ...s, resources: { ...s.resources, gold: 5000, adm: 50, dip: 50, mil: 50 }, fog: { ...(s.fog || {}), met: { ...(s.fog?.met || {}), [me]: met } } };`);
    await wait(700);
    // first contact: needs a new contact while no other card is up
    await closeAllCards();
    if (await has(tid('first-contact'))) { await record('pnl2 first contact'); await esc(); } else console.log('  first contact card not shown (queued or fog off)');
    await railTab(3);
    await record('pnl2 peoples: list');
    const rows = page().locator('[data-testid="peoples-list"] button');
    const n = await rows.count();
    console.log('  peoples rows:', n);
    if (n) { await click(rows.first()); const more = page().getByText(/עוד פעולות|More actions/); if (await has(more)) await click(more); await record('peoples: first expanded'); }
    // at war with the second, trade with the third, peace with the fourth
    if (ids[1]) await dispatch('DECLARE_WAR', { nationId: ids[1] });
    await patch(`const t = ${JSON.stringify(ids[2] || '')}; const p = ${JSON.stringify(ids[3] || '')}; const nations = { ...s.nations }; if (nations[t]) nations[t] = { ...nations[t], hasTradeAgreement: true }; if (nations[p]) nations[p] = { ...nations[p], hasPeaceTreaty: true }; return { ...s, nations };`);
    await wait(500);
    for (let i = 0; i < Math.min(n, 4); i += 1) { await click(rows.nth(i)); await record(`peoples: row ${i} (war / trade / peace)`); }
    // pending cards
    const indep = await gs('return Object.values(s.nations).find((n) => n.kind === "independent" && !n.isEliminated)?.id || null;');
    await patch(`const me = s.playerNationId; const from = ${JSON.stringify(ids[0] || '')}; const ind = ${JSON.stringify(indep)}; const turn = s.turnNumber || 1;
      const out = { ...s, pendingDemand: from ? { from, kind: "tribute", amount: 120, turn, until: turn + 5 } : null, pendingMapOffer: ${JSON.stringify(ids[3] || '')} ? { from: ${JSON.stringify(ids[3] || '')}, turn, until: turn + 4 } : null };
      if (ind) { out.tributeDemands = [{ id: "td1", indepId: ind, gold: 40, turns: 10, turn, expires: turn + 5 }]; out.joinOffers = [{ id: "jo1", indepId: ind, turn, expires: turn + 5 }]; }
      return out;`);
    await wait(700);
    await record('pnl2 peoples: pending demand, tribute, join, map offer');
    await patch('return { ...s, pendingPeaceOffer: null };');
    await railTab(3);
    // the nation sheet and its tabs
    if (ids[0]) {
      await evalMod('components/map/marchEvents.js', 'selectNation', ids[0]);
      await wait(800);
      await record('pnl2 nation sheet');
      const tabs = page().locator('[data-testid="nation-sheet"] [role="tab"]:visible');
      for (let i = 0; i < await tabs.count(); i += 1) { await tabs.nth(i).dispatchEvent('click'); await wait(500); await record(`pnl2 nation sheet tab ${i}`); }
    }
    await closeAllCards();
  });
};
