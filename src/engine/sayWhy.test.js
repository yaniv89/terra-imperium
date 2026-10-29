// Playtest lane "say why it is blocked" (plans/ai-output/human-playtest/SUMMARY.md issues 2, 7, 9, 10):
// held orders bank no more than their cost and say why, blocked actions carry a reason, the virtue
// pick confirms with its cost.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from '../data/geo/tiles';
import { emptyWorld, foundCity, processCity, queueItem, productionCost } from './world/cities';
import { orderWait, queueView } from './cityEconomy';
import { validateTemplate } from './armyTemplates';
import { getNationCapital } from '../data/regions';
import { peoplesWorld, rivalOf } from './testWorld';
import { buildOptions, buildQueue } from '../components/city/cityBuildModel';
import { cityRailModel } from '../components/city/cityRailModel';
import { declareWarModel } from '../components/panels/warActions';
import { virtueConfirm } from '../components/ui/confirmSpecs';
import { rulerSheetModel } from '../components/ruler/rulerSheetModel';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });
const ctx = (over = {}) => ({ researched: [], ageId: 'bronze', turnNumber: 1, citiesOwned: 1, luxuries: 0, ...over });

describe('held orders', () => {
  it('settlers in a size 1 city stop at their cost and say "Needs size 2"', () => {
    let { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'eg', tile: tiles.capitals.eg, size: 1 });
    city = queueItem(city, { kind: 'settler' });
    const cost = productionCost({ kind: 'settler' }, { ageId: 'bronze' });
    for (let i = 0; i < 40; i++) {
      const r = processCity(world, tiles, city, ctx({ maxSize: 1 })); // no growth: the city stays size 1
      world = r.world; city = r.city;
      expect(city.production.progress).toBeLessThanOrEqual(cost);
    }
    expect(city.production.current.kind).toBe('settler');
    expect(city.production.progress).toBe(cost);
    expect(orderWait(city, city.production.current, ctx()).reason).toBe('Needs size 2 (now 1).');
    expect(orderWait({ ...city, size: 2 }, city.production.current, ctx())).toBeNull();
  });

  it('a unit waiting for its tech banks no more than its cost and names the tech', () => {
    let { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'eg', tile: tiles.capitals.eg, size: 4 });
    const item = { kind: 'unit', classId: 'cavalry' };
    city = queueItem(city, item);
    const c = ctx({ ageId: 'modern' });
    const cost = productionCost(item, { ageId: 'modern' });
    for (let i = 0; i < 40; i++) { const r = processCity(world, tiles, city, c); world = r.world; city = r.city; }
    expect(city.production.progress).toBeLessThanOrEqual(cost);
    const w = orderWait(city, item, c);
    expect(w.reason).toMatch(/^Waits for .+\.$/);
    expect(w.reasonMsg.key).toBe('m.why.waitsTech');
  });

  it('the queue and the build list show the size rule, not a turn count', () => {
    const S = peoplesWorld({ seed: 7 });
    const cap = getNationCapital(S.playerNationId);
    const city = S.regions[cap];
    const s = { ...S, regions: { ...S.regions, [cap]: { ...city, size: 1, production: { current: { kind: 'settler' }, queue: [], progress: 456 } } } };
    expect(queueView(s, cap)[0].wait.reason).toBe('Needs size 2 (now 1).');
    expect(buildQueue(s, cap)[0].waitText).toBe('Needs size 2 (now 1).');
    const row = buildOptions(s, cap).find((o) => o.item.kind === 'settler');
    expect(row.ok).toBe(false);
    expect(row.reason).toBe('Needs size 2 (now 1).');
    const rail = cityRailModel(s).find((r) => r.id === cap);
    expect(rail.buildWait).toBe('Needs size 2 (now 1).');
    expect(rail.buildTurns).toBeNull();
  });
});

describe('blocked actions say why', () => {
  it('an army template of units that need a tech names the tech', () => {
    const r = validateTemplate({ name: 'Legion', composition: { infantry: 2, cavalry: 1 } }, 'modern', []);
    expect(r.ok).toBe(false);
    expect(r.reasonMsg.key).toBe('m.why.templateTech');
    expect(r.reason).toMatch(/^Needs .+ for this age's units\.$/);
    expect(validateTemplate({ name: 'Legion', composition: { infantry: 2 } }, 'modern', []).ok).toBe(true);
    expect(validateTemplate({ name: 'Wings', composition: { air: 1 } }, 'bronze', []).reasonMsg.key).toBe('m.why.templateAge');
  });

  it('declare war carries its block or its shortfall, and says what gives a cause', () => {
    const s0 = peoplesWorld({ seed: 3 });
    const s = { ...s0, fog: s0.fog && { ...s0.fog, on: false } }; // a people you have seen (an unseen one is blocked first: warActions.js)
    const foe = rivalOf(s, 0);
    const poor = { ...s, resources: { ...s.resources, gold: 0 } };
    const m = declareWarModel(poor, foe);
    if (!m.affordable) expect(m.why).toMatch(/Not enough resources/);
    const vassal = { ...s, nations: { ...s.nations, [s.playerNationId]: { ...s.nations[s.playerNationId], vassalOf: foe } } };
    expect(declareWarModel(vassal, foe).why).toBeTruthy();
    if (!m.justified) expect(m.note).toMatch(/tribute demand they refuse/);
  });

  it('a virtue asks first with its cost; a tier locked by age names the age', () => {
    const s = peoplesWorld({ seed: 7 });
    const m = rulerSheetModel(s);
    const open = m.branches[0].cells[0];
    const spec = virtueConfirm(s, open.id);
    expect(spec.title).toMatch(/^Take .+\?$/);
    expect(spec.rows[0].value).toBe(`${open.virtue.cost} of 1, ${1 - open.virtue.cost} left`);
    const locked = m.branches[0].cells.find((c) => c.block === 'Opens in a later age');
    expect(locked.opensAge).toBeTruthy();
    expect(virtueConfirm(s, locked.id)).toBeNull();
  });
});
