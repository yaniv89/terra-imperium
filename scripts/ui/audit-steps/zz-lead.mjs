// scripts/ui/audit-steps/zz-lead.mjs
// The lead's extra screens: the campaign cards (capture, independent city, nation sheet at war, peace
// deal, defense sheet, region card) and several played turns (turn reports, logs, events, notices).
export default async ({ step, record, click, tid, has, wait, patch, gs, evalMod, closeAllCards, getPage, skipped }) => {
  const page = () => getPage();
  const TAKE = `
    const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
    const ind = Object.values(s.nations).filter((n) => n.indep && !n.isEliminated && s.regions[n.capitalRegionId]);
    const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
    const pick = ind.sort((a, b) => d(a) - d(b))[0];
    const cityId = pick.capitalRegionId;
    window.__indep = pick.id;
    const r = m.conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: s.turnNumber }, cityId, me, null);
    return m.openCapture({ ...s, regions: r.regions, nations: r.nations }, { opId: 'audit1', cityId, by: me, from: pick.id, source: 'battle' });`;

  await step('cards', async () => {
    await closeAllCards();
    await patch(TAKE, ['engine/conquest.js', 'engine/capture.js']);
    await tid('capture-card').waitFor({ timeout: 15000 });
    await record('capture card');
    await click(tid('capture-choice-tributary'));
    await record('capture card: tributary');
    const indepId = await page().evaluate(() => window.__indep);
    await click(tid('capture-go'));
    await wait(800);
    if (indepId) {
      await evalMod('components/independents/independentEvents.js', 'openIndependent', indepId);
      await tid('independent-sheet').waitFor({ timeout: 8000 });
      await record('independent city sheet');
      await closeAllCards();
    }
    // a major nation: nation sheet, then war, the peace deal, the defense sheet
    const nid = await gs('return Object.values(s.nations).find((n) => !n.indep && n.id !== s.playerNationId && !n.isEliminated)?.id;');
    await page().evaluate(async (id) => {
      const s = window.__game.state;
      window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, fog: { ...(s.fog || {}), met: { ...(s.fog?.met || {}), [s.playerNationId]: { ...(s.fog?.met?.[s.playerNationId] || {}), [id]: 1 } } } } });
    }, nid);
    await evalMod('components/map/marchEvents.js', 'selectNation', nid);
    await wait(800);
    await record('nation sheet (met)');
    await page().evaluate((id) => {
      const s0 = window.__game.state;
      window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s0, resources: { ...s0.resources, gold: 99999, adm: 999, dip: 999, mil: 999 } } });
      window.__game.dispatch({ type: 'DECLARE_WAR', payload: { nationId: id } });
    }, nid);
    await wait(600);
    await evalMod('components/map/marchEvents.js', 'selectNation', nid);
    await wait(800);
    await record('nation sheet (at war)');
    const peaceTile = page().getByText('הסכם שלום').first();
    if (await peaceTile.count()) {
      await click(peaceTile);
      await tid('peace-deal').waitFor({ timeout: 8000 }).catch(() => {});
      await record('peace deal');
      await closeAllCards();
    } else skipped('peace deal', 'no peace tile');
    await patch(`
      const me = s.playerNationId; const nid = ${JSON.stringify(nid)}; const cap = s.nations[me].capitalRegionId;
      const war = (s.wars || []).find((w) => w.active);
      if (!war) return s;
      const rec = m.createDefenseRecord(s, { war: { ...war, aggressor: nid }, regionId: cap, aggressorShare: 1, seed: 5, index: 0 });
      return { ...s, pendingDefenses: [rec] };`, ['engine/defense.js']).catch(() => {});
    await wait(1000);
    if (await has(tid('defense-sheet'))) { await record('defense sheet'); } else skipped('defense sheet', 'did not open');
    await closeAllCards();
  });

  // Several played turns: each report and the log it leaves. Events and cards are answered.
  await step('turns', async () => {
    const P = page();
    for (let i = 0; i < 12; i += 1) {
      await closeAllCards();
      // answer whatever blocks the turn
      for (let k = 0; k < 4; k += 1) {
        const opt = P.locator('[data-testid^="event-option-"]').first();
        if (await has(opt)) { await opt.dispatchEvent('click'); await wait(500); continue; }
        const rc = P.locator('[data-testid^="research-option-"]').first();
        if (await has(rc)) { await rc.dispatchEvent('click'); await wait(500); continue; }
        break;
      }
      const before = await gs('return s.turnNumber;');
      for (let k = 0; k < 8; k += 1) {
        const end = tid('end-turn');
        if (!(await has(end))) break;
        await end.first().dispatchEvent('click');
        await wait(1500);
        if ((await gs('return s.turnNumber;')) > before) break;
        // a blocker took us somewhere: answer it (build something, pick research, take the event's first option)
        const qi = P.locator('[data-testid="queue-item"]:not([disabled])').first();
        if (await has(qi)) { await qi.dispatchEvent('click'); await wait(500); }
        const opt = P.locator('[data-testid^="event-option-"]').first();
        if (await has(opt)) { await opt.dispatchEvent('click'); await wait(500); }
        const rc = P.locator('[data-testid^="research-option-"]').first();
        if (await has(rc)) { await rc.dispatchEvent('click'); await wait(500); }
        const decline = P.locator('[data-testid="battle-choice-calloff"], [data-testid="capture-go"]').first();
        if (await has(decline)) { await decline.dispatchEvent('click'); await wait(500); }
      }
      await wait(1500);
      const turnNo = await gs('return s.turnNumber;');
      if (await has(P.locator('[data-testid^="event-option-"]').first())) await record(`turn ${i + 1}: event`, `turn ${turnNo}`);
      else await record(`turn ${i + 1}: report`, `turn ${turnNo}`);
    }
    await closeAllCards();
    // the log those turns left
    const nav = tid('landscape-rail').locator('nav button');
    const n = await nav.count();
    await nav.nth(n - 2).dispatchEvent('click'); await wait(800);
    await record('log after 12 turns');
    await nav.nth(n - 2).dispatchEvent('click'); await wait(300);
    await closeAllCards();
  });
};
