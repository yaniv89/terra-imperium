// The Build tab's rows (playtest audits CB05): named tiles, measured effects, a list that does not
// reflow when something is queued, no ships inland, the long-build line.
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { getNationCapital } from '../../data/regions';
import { NEEDS_SEA_COAST } from '../../engine/world/cities';
import { buildingEffect } from '../../engine/cityEffects';
import { buildOptions, buildQueue, focusHint, tileBearing, itemLabel, rushText, goldWait } from './cityBuildModel';
import { cityBuildingsModel, crownActions, cityDevelopmentModel, populationPolicyPreview } from './cityPoliticsModel';
import { cityDefenseModel } from './cityDefenseModel';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

const S = peoplesWorld({ seed: 7 });
const paris = getNationCapital(FR);
const withTech = (s, ids) => ({ ...s, techTree: { ...s.techTree, ...Object.fromEntries(ids.map((t) => [t, { ...(s.techTree[t] || {}), researched: true }])) } });
const queue = (s, item, cityId = paris) => gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId, item } });

describe('build options', () => {
  it('lists no building tier more than one age ahead (no Coal Plant or Market in the Stone Age)', () => {
    const rows = buildOptions(S, paris).filter((o) => o.item.kind === 'building');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((o) => o.item.category)).not.toContain('energy');
    expect(rows.some((o) => o.label === 'Market')).toBe(false);
  });
  it('every improvement row names its own tile: no two rows read the same', () => {
    const s = withTech(S, ['economy_bronze_trade_routes', 'military_bronze_casting', 'infrastructure_mudbrick_roads', 'infrastructure_irrigation_canals']);
    const rows = buildOptions(s, paris).filter((o) => o.group === 'Improvements');
    expect(rows.length).toBeGreaterThan(3);
    expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    rows.forEach((r) => {
      expect(r.tile).toBe(r.item.tile);
      expect(r.label).toMatch(/\d+ km (N|NE|E|SE|S|SW|W|NW)/);
      expect(r.detail.length).toBeGreaterThan(0); // what it gives, measured
    });
    const farm = rows.find((r) => r.item.improvement === 'farm');
    if (farm) expect(farm.detail).toMatch(/\+1 food/);
  });

  it('a queued improvement or building keeps its row, marked queued, and a unit can be queued again', () => {
    const before = buildOptions(S, paris);
    const road = before.find((o) => o.item.kind === 'improvement');
    const granary = before.find((o) => o.id === 'building:food');
    const spear = before.find((o) => o.item.kind === 'unit' && o.item.classId === 'infantry');
    expect(road.ok && granary.ok && spear.ok).toBe(true);
    let s = queue(S, road.item); s = queue(s, granary.item); s = queue(s, spear.item); s = queue(s, spear.item);
    const after = buildOptions(s, paris);
    // The same rows, in the same order: nothing moves under the finger.
    expect(after.map((o) => o.id)).toEqual(before.map((o) => o.id));
    expect(after.find((o) => o.id === road.id)).toMatchObject({ ok: false, queued: 1 });
    expect(after.find((o) => o.id === 'building:food')).toMatchObject({ ok: false, queued: 1 });
    expect(after.find((o) => o.id === spear.id)).toMatchObject({ ok: true, queued: 2 });
    // And the reducer agrees: a second tap on the queued improvement adds nothing.
    const again = queue(s, road.item);
    expect(buildQueue(again, paris).length).toBe(buildQueue(s, paris).length);
    expect(again.logs[again.logs.length - 1].message).toBe('Already in the queue.');
  });

  it('a building row carries the measured effect of its next tier', () => {
    const rows = buildOptions(S, paris);
    const food = rows.find((o) => o.id === 'building:food');
    expect(food.detail).toBe(buildingEffect(S, paris, 'food', 0).text);
    expect(food.detail).toMatch(/\+1 food/);
    expect(food.cost).toBeGreaterThan(0);
    expect(food.turns).toBeGreaterThan(0);
    const locked = rows.find((o) => o.group === 'Buildings' && !o.ok && o.needsTech);
    expect(locked.needsName).toBeTruthy();
  });

  it('an inland city lists no harbor and one locked ship row naming the ports; a coastal one lists both', () => {
    const tiles = getTiles();
    const s = { ...S, age: 'classical', techAgeId: 'classical' };
    const mineOf = (pred) => Object.values(s.regions).find((c) => c.tile != null && !c.outpost && pred(c));
    const inland = mineOf((c) => tiles.coastal[c.tile] !== 1);
    const coastal = mineOf((c) => tiles.coastal[c.tile] === 1);
    const own = (c) => ({ ...s, playerNationId: c.owner });
    const inlandRows = buildOptions(own(inland), inland.id);
    expect(inlandRows.filter((o) => o.item.classId === 'naval').map((o) => ({ group: o.group, ok: o.ok }))).toEqual([{ group: 'Ships', ok: false }]);
    expect(inlandRows.some((o) => o.id === 'building:naval')).toBe(false);
    // with a port of the same owner, the row names it
    const both = { ...own(inland), regions: { ...s.regions, [coastal.id]: { ...coastal, owner: inland.owner } } };
    expect(buildOptions(both, inland.id).find((o) => o.item.classId === 'naval').reason).toContain(coastal.name);
    const coastRows = buildOptions(own(coastal), coastal.id);
    expect(coastRows.filter((o) => o.item.classId === 'naval').every((o) => o.group === 'Ships')).toBe(true);
    expect(coastRows.some((o) => o.item.classId === 'naval')).toBe(true);
    expect(coastRows.some((o) => o.id === 'building:naval')).toBe(true);
    // The Buildings tab keeps the line, says why, and offers nothing to tap.
    const naval = cityBuildingsModel(own(inland), inland.id).find((r) => r.category === 'naval');
    expect(naval.next).toMatchObject({ blocked: true, canBuild: false, needs: 'a sea coast' });
    expect(cityBuildingsModel(own(coastal), coastal.id).find((r) => r.category === 'naval').next.blocked).toBe(false);
    expect(NEEDS_SEA_COAST).toMatch(/sea coast/);
  });

  it('the queue rows carry labels, progress and turns counted down the queue', () => {
    let s = queue(S, { kind: 'building', category: 'food', tier: 0 });
    s = queue(s, { kind: 'unit', classId: 'infantry' });
    const q = buildQueue(s, paris);
    expect(q.map((r) => r.label)[0]).toBe('Storage Pits');
    expect(q[1].turns).toBeGreaterThanOrEqual(q[0].turns);
    const moved = gameReducer(s, { type: ActionTypes.MOVE_PRODUCTION, payload: { cityId: paris, index: 1, to: 0 } });
    expect(buildQueue(moved, paris).map((r) => r.label)[1]).toBe('Storage Pits');
  });

  it('buying a later order moves it to the front, keeps the rest in order and locks it with a reason', () => {
    let s = { ...S, resources: { ...S.resources, gold: 5000 } };
    s = queue(s, { kind: 'building', category: 'food', tier: 0 });
    s = queue(s, { kind: 'unit', classId: 'infantry' });
    s = queue(s, { kind: 'settler' });
    const before = buildQueue(s, paris);
    expect(before[0].locked).toBeNull();
    expect(before[1].rush.left).toBe(5000 - before[1].rush.gold); // gold after, on the row
    const bought = gameReducer(s, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: paris, index: 1 } });
    const after = buildQueue(bought, paris);
    expect(after.map((r) => r.item.classId || r.item.category || r.item.kind)).toEqual(['infantry', 'food', 'settler']);
    expect(after[0].progress).toBe(after[0].cost);
    expect(after[0].locked).toMatch(/cannot be removed or moved/);
    // no cancel, no reorder past it
    expect(gameReducer(bought, { type: ActionTypes.DEQUEUE_PRODUCTION, payload: { cityId: paris, index: 0 } }).regions[paris]).toBe(bought.regions[paris]);
    expect(gameReducer(bought, { type: ActionTypes.MOVE_PRODUCTION, payload: { cityId: paris, index: 2, to: 0 } }).regions[paris]).toBe(bought.regions[paris]);
    // a second buy goes right behind the paid head
    const again = buildQueue(gameReducer(bought, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: paris, index: 2 } }), paris);
    expect(again.map((r) => r.item.classId || r.item.category || r.item.kind)).toEqual(['infantry', 'settler', 'food']);
  });

  it('an unaffordable buy names the shortfall; a cheap one pays on the first tap', () => {
    let s = queue({ ...S, resources: { ...S.resources, gold: 3 } }, { kind: 'building', category: 'food', tier: 0 });
    const [poor] = buildQueue(s, paris);
    expect(rushText(poor).save).toContain(`${poor.rush.gold - 3} gold short.`);
    s = { ...s, resources: { ...s.resources, gold: 100000 } };
    expect(buildQueue(s, paris)[0].rush.quick).toBe(true);
    s = { ...s, resources: { ...s.resources, gold: buildQueue(s, paris)[0].rush.gold * 2 } };
    expect(buildQueue(s, paris)[0].rush.quick).toBe(false);
  });

  it('warns about long builds and points at Production focus only when it would help', () => {
    // A city that makes almost nothing: one citizen on its centre.
    const city = S.regions[paris];
    const poor = { ...S, regions: { ...S.regions, [paris]: { ...city, isCapital: false, size: 1, tiles: [city.tile], locked: [] } } };
    const options = buildOptions(poor, paris);
    const hint = focusHint(poor, paris, options);
    expect(hint.slow).toBeGreaterThan(0);
    expect(hint.better).toBeNull();
    expect(hint.text).toMatch(/Focus cannot help here/);
    expect(hint.short).toMatch(/slow here/); // the one line the Build tab shows before More (BUILD-01)
    expect(hint.short.length).toBeLessThan(hint.text.length);
    expect(options.filter((o) => o.long).every((o) => o.ok)).toBe(true);
    // each slow row says why and what gold would buy it (warmonger playtest: 6 to 150 turns, no reason)
    options.filter((o) => o.long).forEach((o) => { expect(o.production).toBe(Math.round(hint.production * 10) / 10); expect(o.buyGold).toBeGreaterThan(0); });
    expect(options.filter((o) => !o.long).every((o) => o.buyGold == null)).toBe(true);
    expect(focusHint(S, paris, [])).toBeNull();
    // With a food focus and hills to work, Production focus is the answer.
    const helped = focusHint({ ...poor, regions: { ...poor.regions, [paris]: { ...city, isCapital: false, size: 3, focus: 'food' } } }, paris, [{ long: true }]);
    if (helped.better) { expect(helped.text).toMatch(/Production focus would make/); expect(helped.better.production).toBeGreaterThan(helped.production); }
  });

  it('bearings read as distance and compass point', () => {
    const tiles = getTiles();
    const centre = S.regions[paris].tile;
    const b = tileBearing(tiles, centre, tiles.neighbors[centre][0]);
    expect(b.km).toBeGreaterThan(0);
    expect(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']).toContain(b.dir);
    expect(tileBearing(tiles, centre, centre).text).toBe('the centre');
    expect(itemLabel({ kind: 'settler' })).toBe('Settlers');
  });
});

describe('the other city tabs', () => {
  it('the Buildings tab shows what stands and what the next tier adds, with the queue\'s cost', () => {
    const s = { ...S, regions: { ...S.regions, [paris]: { ...S.regions[paris], buildings: { ...S.regions[paris].buildings, categories: { ...S.regions[paris].buildings.categories, food: 0 } } } } };
    const food = cityBuildingsModel(s, paris).find((r) => r.category === 'food');
    expect(food.standing).toBe('+1 food, +1 housing');
    expect(food.next.effect).toBe(buildingEffect(s, paris, 'food', 1).text);
    expect(food.next.cost).toBe(buildOptions(s, paris).find((o) => o.id === 'building:food').cost);
  });

  it('Invest in growth says what it buys and is off when the bank is full', () => {
    const rich = { ...S, resources: { ...S.resources, gold: 5000, adm: 50 }, regions: { ...S.regions, [paris]: { ...S.regions[paris], food: 0 } } };
    const p = populationPolicyPreview(rich, paris);
    expect(p.effective).toBe(true);
    expect(p.after).toBeGreaterThan(p.before);
    expect(p.text).toMatch(/food to the bank/);
    const bought = gameReducer(rich, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: paris } });
    expect(Math.floor(bought.regions[paris].food)).toBe(p.after); // the preview is the purchase
    const full = { ...rich, regions: { ...rich.regions, [paris]: { ...rich.regions[paris], food: p.threshold - 0.1 } } };
    const action = crownActions(full, paris).find((a) => a.id === 'populationPolicy');
    expect(action.enabled).toBe(false);
    expect(action.reason).toBe('the food bank is full');
  });

  it('the Develop rows say the point lasts and count what was bought', () => {
    const rich = { ...S, resources: { ...S.resources, adm: 9999, dip: 9999, mil: 9999 } };
    const row = cityDevelopmentModel(rich, paris).rows.find((r) => r.id === 'dev:production');
    expect(row.description).toMatch(/\+1 base production/);
    const after = gameReducer(rich, { type: row.actionType, payload: row.payload });
    const next = cityDevelopmentModel(after, paris).rows.find((r) => r.id === 'dev:production');
    expect(next.bought).toBe(1);
    expect(next.description).toMatch(/1 bought here so far/);
  });

  it('the Defense tab points at what can be done', () => {
    const m = cityDefenseModel(S, paris);
    expect(m.paths.map((p) => p.id)).toEqual(['walls', 'garrison', 'works']);
    expect(m.paths[0]).toMatchObject({ tab: 'build', action: 'Build Earthwork Ditch' });
    expect(cityDefenseModel(S, getNationCapital(DE)).paths).toEqual([]);
  });
});

describe('rush offer on the queue (CB04 I019, I027)', () => {
  it('each queue row carries the reducer\'s own quote, and its words name the gold and the wait', () => {
    let s = queue({ ...S, resources: { ...S.resources, gold: 99999 } }, { kind: 'building', category: 'food', tier: 0 });
    const [row] = buildQueue(s, paris);
    expect(row.rush.ok).toBe(true);
    const words = rushText(row);
    expect(words.button).toBe(`Buy ${row.rush.gold}g`);
    expect(words.text).toMatch(/Done next turn/);
    s = gameReducer(s, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: paris, index: 0 } });
    expect(s.resources.gold).toBe(99999 - row.rush.gold);
    expect(buildQueue(s, paris)[0].rush.ok).toBe(false);
  });
});

// An out-of-reach price says how many turns of income it takes (civ-veteran playtest step 28: 634 gold to buy, 99 in hand, +73 a turn).
describe('goldWait', () => {
  const needs = { ok: false, gold: 634, reasonMsg: { key: 'm.why.needsGold' } };
  it('turns of income to save the price', () => {
    expect(goldWait({ resources: { gold: 99 } }, needs, () => 73)).toEqual({ have: 99, saveTurns: 8 });
  });
  it('no income: no turn count', () => {
    expect(goldWait({ resources: { gold: 99 } }, needs, () => -5)).toEqual({ have: 99, saveTurns: null });
  });
  it('an affordable price or another refusal adds nothing', () => {
    expect(goldWait({ resources: { gold: 900 } }, { ...needs, ok: true }, () => 73)).toEqual({});
    expect(goldWait({ resources: { gold: 9 } }, { ok: false, gold: 634, reasonMsg: { key: 'm.why.rush.enemy' } }, () => 73)).toEqual({});
  });
});
