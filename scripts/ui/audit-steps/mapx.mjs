// scripts/ui/audit-steps/mapx.mjs
// Extra Hebrew audit screens for the map sheets that the standard run does not reach (area mapx):
// a fleet's army sheet and the landing button, a besieging army, an army with a route and merge
// buttons, a foreign army at peace (declare war), march bar attack lines, settlers with a chosen
// target, the settle mode with a good site, a blocked site and the settle lens.
//   node scripts/ui/hebrew-audit.mjs --url http://localhost:5199/terra-imperium/ --only start,mapx
// Every audit unit has an id starting with mx_; each step removes them first.
export default async ({ step, record, click, tid, has, wait, patch, gs, closeAllCards, selTile, selArmy, skipped, getPage }) => {
  const clean = () => patch('const units = Object.fromEntries(Object.entries(s.units).filter(([id]) => !id.startsWith(\'mx_\'))); return { ...s, units };');
  const page = () => getPage();
  const lens = (id) => page().evaluate((x) => window.dispatchEvent(new CustomEvent('ti:set-map-lens', { detail: x })), id);
  // a land unit of the player (or another nation) for the audit
  const UNIT = `const mk = (id, ownerId, regionId, tile, extra = {}) => ({ id, ownerId, regionId, homeRegionId: regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...extra });`;
  // tiles around the capital by distance: { land: [...], free: [...], own: [...], water: [...] } with rings
  const around = () => page().evaluate(async () => {
    const m = await import('/terra-imperium/src/data/geo/tiles.js'); const t = m.getTiles(); const s = window.__game.state;
    const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId]; const owner = s.world.tileOwner;
    const seen = new Map([[cap.tile, 0]]); let f = [cap.tile]; const out = { capId: cap.id, capTile: cap.tile, rings: [] };
    for (let d = 1; d <= 12; d += 1) {
      const nx = [];
      f.forEach((x) => t.neighbors[x].forEach((y) => { if (!seen.has(y)) { seen.set(y, d); nx.push(y); } }));
      f = nx.sort((a, b) => a - b);
      out.rings.push(f.map((x) => ({ tile: x, land: t.land[x] === 1, owner: owner[x] ?? null, mine: owner[x] != null && s.regions[owner[x]]?.owner === me, lake: t.terrainOf(x) === 'lake', nb: t.neighbors[x] })));
    }
    return out;
  });

  await step('mapx-fleet', async () => {
    await closeAllCards(); await clean();
    const a = await around();
    // a sea tile with a free land tile beside it: the fleet stands there, the landing is offered on the land
    let spot = null;
    const all = a.rings.flat(); const byTile = new Map(all.map((x) => [x.tile, x]));
    for (const x of all) {
      if (x.land || x.lake) continue;
      const l = x.nb.map((n) => byTile.get(n)).find((n) => n && n.land && n.owner == null);
      if (l) { spot = { sea: x.tile, land: l.tile }; break; }
    }
    if (!spot) { skipped('mapx: fleet army sheet', 'no sea tile beside free land near the capital'); return; }
    await patch(`${UNIT}
      const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
      const fleet = { ...mk('mx_fleet', me, cap.id, ${spot.sea}), domain: 'naval', classId: 'naval', navalLine: 'warship', transportCapacity: 2 };
      const cargo = mk('mx_cargo', me, cap.id, ${spot.sea}, { embarkedOn: 'mx_fleet' });
      return { ...s, units: { ...s.units, mx_fleet: fleet, mx_cargo: cargo } };`);
    await wait(600);
    await selArmy(spot.sea); await wait(900);
    await record('mapx: fleet army sheet');
    await click(tid('army-march')); await wait(900);
    await record('mapx: fleet march bar (start)');
    await closeAllCards();
    await selTile(spot.land); await wait(1000);
    await record('mapx: tile sheet with the landing button');
    await closeAllCards(); await clean();
  });

  await step('mapx-siege', async () => {
    await closeAllCards(); await clean();
    const info = await page().evaluate(async () => {
      const m = await import('/terra-imperium/src/data/geo/tiles.js'); const t = m.getTiles(); const s = window.__game.state; const me = s.playerNationId;
      const ind = Object.values(s.nations).find((n) => n.indep && !n.isEliminated && s.regions[n.capitalRegionId]);
      if (!ind) return null;
      const c = s.regions[ind.capitalRegionId];
      const side = t.neighbors[c.tile].find((n) => t.land[n] === 1 && s.world.tileOwner[n] == null) ?? t.neighbors[c.tile].find((n) => t.land[n] === 1);
      return { cityId: c.id, cityTile: c.tile, side, capId: s.nations[me].capitalRegionId };
    });
    if (!info || info.side == null) { skipped('mapx: besieging army', 'no independent city with a land side'); return; }
    await patch(`${UNIT}
      const me = s.playerNationId;
      return { ...s, units: { ...s.units, mx_s1: mk('mx_s1', me, ${JSON.stringify(info.capId)}, ${info.side}), mx_s2: mk('mx_s2', me, ${JSON.stringify(info.capId)}, ${info.side}, { classId: 'siege' }) } };`);
    await wait(600);
    await selArmy(info.side); await wait(900);
    await record('mapx: army sheet beside an independent city (siege order, assault)');
    const order = tid('army-siege-order');
    if (await has(order)) {
      await click(order); await wait(900);
      await record('mapx: army sheet, siege laid (lift the siege)');
    } else skipped('mapx: army sheet, siege laid', 'no siege order button');
    await closeAllCards(); await clean();
  });

  await step('mapx-route', async () => {
    await closeAllCards(); await clean();
    const a = await around();
    const flat = a.rings.flat();
    const byTile = new Map(flat.map((x) => [x.tile, x]));
    const near = a.rings[0].filter((x) => x.land);
    const far = a.rings[3]?.find((x) => x.land && x.mine) || a.rings[3]?.find((x) => x.land) || a.rings[2]?.find((x) => x.land);
    if (!near.length || !far) { skipped('mapx: army with a route', 'no land around the capital'); return; }
    // stack A on the capital (it will march), stack B on a neighbour (offered as a merge)
    await patch(`${UNIT}
      const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
      return { ...s, units: { ...s.units, mx_a1: mk('mx_a1', me, cap.id, cap.tile), mx_a2: mk('mx_a2', me, cap.id, cap.tile), mx_b1: mk('mx_b1', me, cap.id, ${near[0].tile}) } };`);
    await wait(600);
    await selArmy(a.capTile); await wait(900);
    await record('mapx: army sheet with a merge button');
    await page().evaluate(({ fromRegionId, toTile }) => window.__game.dispatch({ type: 'SET_ROUTE', payload: { fromRegionId, toTile, unitIds: ['mx_a1', 'mx_a2'] } }), { fromRegionId: a.capId, toTile: far.tile });
    await wait(700);
    const routed = await gs('return !!(s.units.mx_a1 && s.units.mx_a1.route && s.units.mx_a1.route.length);');
    if (routed) {
      await closeAllCards(); await selArmy(a.capTile); await wait(900);
      await record('mapx: army sheet, marching (route, halt the march)');
    } else skipped('mapx: army sheet, marching', 'the route order was refused');
    await closeAllCards(); await clean();
    byTile.clear();
  });

  await step('mapx-peace', async () => {
    await closeAllCards(); await clean();
    const a = await around();
    const free = a.rings.flat().find((x) => x.land && x.owner == null);
    const other = await gs('const me = s.playerNationId; const n = Object.values(s.nations).find((x) => x.id !== me && !x.indep && !x.isEliminated && x.capitalRegionId && s.regions[x.capitalRegionId]); return n ? { id: n.id, cap: n.capitalRegionId } : null;');
    if (!free || !other) { skipped('mapx: foreign army at peace', 'no free tile or no other nation'); return; }
    await patch(`${UNIT}
      return { ...s, units: { ...s.units, mx_f1: mk('mx_f1', ${JSON.stringify(other.id)}, ${JSON.stringify(other.cap)}, ${free.tile}) } };`);
    await wait(600);
    await selTile(free.tile); await wait(1000);
    await record('mapx: tile sheet, foreign army at peace (declare war card)');
    // an own army beside a major's city: the army sheet offers the war
    const city = await gs(`const c = s.regions[${JSON.stringify(other.cap)}]; return { tile: c.tile };`);
    const side = await page().evaluate(async (tile) => { const m = await import('/terra-imperium/src/data/geo/tiles.js'); const t = m.getTiles(); return t.neighbors[tile].find((n) => t.land[n] === 1) ?? null; }, city.tile);
    if (side != null) {
      await patch(`${UNIT}
        const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
        return { ...s, units: { ...s.units, mx_p1: mk('mx_p1', me, cap.id, ${side}) } };`);
      await wait(600);
      await closeAllCards(); await selArmy(side); await wait(900);
      await record('mapx: army sheet beside a city at peace (declare war button)');
    } else skipped('mapx: army sheet, declare war', 'no land beside the city');
    await closeAllCards(); await clean();
  });

  await step('mapx-marchbar', async () => {
    await closeAllCards(); await clean();
    const pair = await page().evaluate(async () => {
      const m = await import('/terra-imperium/src/data/geo/tiles.js'); const t = m.getTiles(); const s = window.__game.state; const owner = s.world.tileOwner;
      const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
      const ind = Object.values(s.nations).find((n) => n.indep && !n.isEliminated && !(n.indep.truceWith || {})[me]);
      if (!ind) return null;
      const seen = new Set([cap.tile]); let f = [cap.tile];
      for (let d = 0; d < 10; d += 1) {
        const nx = []; f.forEach((x) => t.neighbors[x].forEach((y) => { if (!seen.has(y)) { seen.add(y); nx.push(y); } })); f = nx.sort((a, b) => a - b);
        for (const x of f) { if (t.land[x] !== 1 || owner[x] != null) continue; const o = t.neighbors[x].find((y) => t.land[y] === 1 && owner[y] == null); if (o != null) return { mine: x, theirs: o, ind: ind.id, indCap: ind.capitalRegionId, capId: cap.id }; }
      }
      return null;
    });
    if (!pair) { skipped('mapx: march bar attack lines', 'no clash site'); return; }
    await patch(`${UNIT}
      const me = s.playerNationId;
      return { ...s, units: { ...s.units, mx_m1: mk('mx_m1', me, ${JSON.stringify(pair.capId)}, ${pair.mine}), mx_e1: mk('mx_e1', ${JSON.stringify(pair.ind)}, ${JSON.stringify(pair.indCap)}, ${pair.theirs}) } };`);
    await wait(600);
    await selArmy(pair.mine); await wait(900);
    await click(tid('army-march')); await wait(900);
    await selTile(pair.theirs); await wait(1000);
    await record('mapx: march bar, enemy army beside (attack it now)');
    await closeAllCards();
    // an enemy army further away
    const away = await page().evaluate(async ({ mine }) => {
      const m = await import('/terra-imperium/src/data/geo/tiles.js'); const t = m.getTiles(); const s = window.__game.state; const owner = s.world.tileOwner;
      const seen = new Set([mine]); let f = [mine];
      for (let d = 0; d < 4; d += 1) { const nx = []; f.forEach((x) => t.neighbors[x].forEach((y) => { if (!seen.has(y)) { seen.add(y); nx.push(y); } })); f = nx.sort((a, b) => a - b); }
      return f.find((x) => t.land[x] === 1 && owner[x] == null) ?? null;
    }, { mine: pair.mine });
    if (away != null) {
      await patch(`${UNIT}
        return { ...s, units: { ...s.units, mx_e2: mk('mx_e2', ${JSON.stringify(pair.ind)}, ${JSON.stringify(pair.indCap)}, ${away}) } };`);
      await wait(600);
      await selArmy(pair.mine); await wait(900);
      await click(tid('army-march')); await wait(900);
      await selTile(away); await wait(1000);
      await record('mapx: march bar, enemy army further away');
    }
    // the independent's city as the target (march to attack / attack now)
    await closeAllCards();
    await selArmy(pair.mine); await wait(900);
    await click(tid('army-march')); await wait(900);
    await page().evaluate(async (id) => (await import('/terra-imperium/src/components/map/marchEvents.js')).selectRegion(id), pair.indCap);
    await wait(1000);
    await record('mapx: march bar, enemy city as the target');
    await closeAllCards(); await clean();
  });

  await step('mapx-settle', async () => {
    await closeAllCards(); await clean();
    const a = await around();
    await patch(`const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId]; return { ...s, units: { ...s.units, mx_settler: m.makeSettler('mx_settler', cap, me) } };`, ['engine/settlers.js']);
    await wait(600);
    const sites = await page().evaluate(async () => {
      const m = await import('/terra-imperium/src/components/map/settleMode.js'); const s = window.__game.state;
      return m.settleSites(s, { unitId: 'mx_settler' }).map((x) => x.tile);
    });
    // selecting the settler's tile starts the settle mode; the bar's next-site button walks the good sites
    await selTile(a.capTile); await wait(1200);
    await record('mapx: settle mode, settler tile sheet');
    const next = tid('settle-next-site');
    if (await has(next)) {
      await click(next); await wait(1500);
      await record('mapx: settle mode, best site (bar and site card)');
      await click(next); await wait(1500);
      await record('mapx: settle mode, next good site');
    } else skipped('mapx: settle mode, next good site', 'no next-site button (no known site in reach)');
    await lens('settle'); await wait(1200);
    await record('mapx: settle lens legend');
    // a blocked site: a land tile beside the capital, and a foreign tile
    const close = a.rings[0].find((x) => x.land && x.owner != null);
    if (close) { await selTile(close.tile); await wait(1000); await record('mapx: settle mode, blocked site (too close)'); }
    else skipped('mapx: blocked site', 'no land beside the capital');
    const foreign = await gs('const me = s.playerNationId; const c = Object.values(s.regions).find((r) => r.owner !== me && r.tile != null); return c ? c.tile : null;');
    if (foreign != null) { await selTile(foreign); await wait(1000); await record('mapx: settle mode, foreign land (no city here)'); }
    await lens('political'); await closeAllCards();
    // the settler with a chosen target: "arrive in N turns", Cancel, and the status line
    if (sites.length) {
      await page().evaluate((tile) => window.__game.dispatch({ type: 'SET_SETTLER_TARGET', payload: { unitId: 'mx_settler', tile } }), sites[0]);
      await wait(800);
      await selTile(sites[0]); await wait(1000);
      await record('mapx: tile sheet, settlers on their way (arrive, Cancel)');
      await closeAllCards();
      await selTile(a.capTile); await wait(1000);
      await record('mapx: tile sheet, settler status line (heading for)');
      await closeAllCards();
    } else skipped('mapx: settlers with a target', 'no good site known');
    // wait / disband confirm
    await page().evaluate(() => window.__game.dispatch({ type: 'SET_SETTLER_TARGET', payload: { unitId: 'mx_settler', tile: null } }));
    await wait(600);
    await selTile(a.capTile); await wait(1000);
    const hold = tid('settler-hold');
    if (await has(hold)) { await click(hold); await wait(600); await record('mapx: settler waiting here on order'); }
    const dis = tid('settler-disband');
    if (await has(dis)) { await click(dis); await wait(600); await record('mapx: settler disband confirm'); }
    await closeAllCards(); await clean();
  });
};
