// src/components/city/cityBuildModel.js
// The city sheet's Build tab as a pure model (playtest audits CB05: I041, I043 to I048): every
// row the panel draws with its words already made, so the tests can check them and the panel
// only lays them out. All numbers come from the engine's selectors (src/engine/cityEconomy.js,
// cityEffects.js): the cost and turns are the queue's own, the effect line is measured.
//   itemLabel / tileBearing   names; an improvement names its tile by terrain, resource, distance
//                             and compass direction from the city ("Fishing boats: coast, 80 km NE"),
//                             so seven boats on seven coast tiles are seven different rows
//   buildOptions              the catalogue. A row never leaves while the sheet is open: a queued
//                             improvement or building stays in place marked `queued`, so the list
//                             does not reflow under a second tap (I045)
//   buildQueue                the queue rows (queueView plus labels)
//   focusHint                 the long-build line and whether Production focus would help
import { getTiles } from '../../data/geo/tiles';
import { TECH_TREE } from '../../data/techTree';
import { reasonText } from '../../i18n/messageText';
import { t as tNow, dataText } from '../../i18n/core';
import { unitName as unitDisplayName } from '../../i18n/gameText';
import { robotUnitName, unitClassRole, navalLineRole, buildingTierName, buildingCategoryLabel, wonderName, wonderDescription, techName, improvementName, terrainWord, tileResourceName } from '../../i18n/gameText';
import { unitTagText } from '../../i18n/unitTags';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { getAvailableClasses, isUnitUnlocked, isRobotUnlocked, unitUnlockTech, UNIT_CLASSES } from '../../data/unitClasses';
import { IMPROVEMENTS, tileFacts, canImprove } from '../../data/tileYields';
import { NAVAL_LINES, navalLinesFor } from '../../data/navalLines';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { distanceKm } from '../../data/geo/geodesic';
import { canQueue, itemKey, hasSeaCoast } from '../../engine/world/cities';
import { templatesOf, nextTemplateUnit, templateProgress } from '../../engine/armyTemplates';
import { wonderOptions, wonderItem } from '../../engine/wonders';
import { cityLive, queueView, buildQuote, worldOf, isLongBuild, longBuildTurns, focusPreview } from '../../engine/cityEconomy';
import { buildingEffect, improvementEffect } from '../../engine/cityEffects';
import { settlingOutlook } from '../../engine/settlers';
import { rushQuote, rushGold, rushRate, RUSH_GOLD_PER_HAMMER } from '../../engine/spending';
import { FIRST_AGE_ID } from '../../data/ages';
import { techEta, techEtaText } from '../panels/researchView';

export const GROUPS = ['Units', 'Armies', 'Buildings', 'Wonders', 'Improvements'];
/** The words of a group id ('All' too). */
export const groupLabel = (g) => tNow(`cy.group.${g}`);
/** An army template's name: the two default templates have a Hebrew name; a name the player typed stays as typed. */
export const templateName = (templateId, name) => (templateId === 'tpl_legion' || templateId === 'tpl_siege_train' ? dataText(`tpl.${templateId}`, name) : name);

export const describeTile = (facts) => {
  const parts = [terrainWord(facts.terrain)];
  if (facts.relief !== 'flat') parts.push(terrainWord(facts.relief));
  if (facts.feature !== 'none') parts.push(terrainWord(facts.feature));
  if (facts.river) parts.push(terrainWord('river'));
  return parts.join(', ');
};

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Where `to` lies from `from`: { km, dir, text } ("150 km NE"). For labels only. */
export const tileBearing = (tiles, from, to) => {
  if (from == null || to == null || from === to) return { km: 0, dir: '', text: tNow('cy.theCentre') };
  const a = tiles.latLonOf(from); const b = tiles.latLonOf(to);
  let dLon = b.lon - a.lon; if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360;
  const east = dLon * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const angle = (Math.atan2(east, b.lat - a.lat) * 180 / Math.PI + 360) % 360;
  const dir = COMPASS[Math.round(angle / 45) % 8];
  const km = Math.round(distanceKm(tiles.centres[from], tiles.centres[to]) / 10) * 10;
  return { km, dir, text: tNow('cy.bearing', { km, dir: tNow(`cy.dir.${dir}`) }) };
};

/** A tile of the city in words: "coast, fish, 80 km NE". */
export const tilePlace = (tiles, cityTile, tile, facts = tileFacts(tiles, tile)) => `${describeTile(facts)}${facts.resource ? `, ${tileResourceName(facts.resource)}` : ''}, ${tileBearing(tiles, cityTile, tile).text}`;

export const itemLabel = (item, tiles = getTiles(), ageId = FIRST_AGE_ID, cityTile = null) => {
  if (item.kind === 'unit' && item.explorer) return tNow('cy.scouts');
  if (item.kind === 'unit' && item.robot) return robotUnitName(item.classId);
  if (item.kind === 'unit') return item.classId === 'naval' ? `${unitDisplayName(ageId, 'naval', item.navalLine)} (${navalLineRole(item.navalLine || 'warship', NAVAL_LINES[item.navalLine || 'warship'].role)})` : unitDisplayName(ageId, item.classId);
  if (item.kind === 'building') return buildingTierName(item.category, item.tier, BUILDING_CATEGORIES[item.category]?.tiers[item.tier]?.name);
  if (item.kind === 'improvement') return `${improvementName(item.improvement, IMPROVEMENTS[item.improvement]?.name)}: ${cityTile != null ? tilePlace(tiles, cityTile, item.tile) : describeTile(tileFacts(tiles, item.tile))}`;
  if (item.kind === 'settler') return tNow('cy.settlers');
  if (item.kind === 'wonder') return `${wonderName(item.projectId, GREAT_PROJECTS[item.projectId]?.name)} (${tNow('cy.tier', { n: item.tier })})${item.tile != null && cityTile != null ? `, ${tileBearing(tiles, cityTile, item.tile).text}` : ''}`;
  if (item.kind === 'army') { const next = nextTemplateUnit(item); const p = templateProgress(item); const nm = templateName(item.templateId, item.name); return next ? tNow('cy.armyNext', { name: nm, unit: unitDisplayName(ageId, next), i: p.done + 1, total: p.total }) : tNow('cy.armyDone', { name: nm, total: p.total }); }
  return item.kind;
};

export const turnsText = (turns) => (turns == null ? tNow('cy.noProduction') : tNow('cy.turns', { count: turns }));

/** The queue rows: queueView plus the label, `waitText` (why a held order waits) and the rush quote (spending.js, I019: what the Buy
 * button shows is what RUSH_PRODUCTION charges). */
export const buildQueue = (state, cityId, live = cityLive(state, cityId)) => {
  if (!live) return [];
  const tiles = getTiles();
  return queueView(state, cityId, live).map((q) => ({
    ...q, label: itemLabel(q.item, tiles, live.ctx.ageId, live.city.tile), waitText: q.wait ? reasonText(q.wait) : null, tile: q.item.kind === 'improvement' || q.item.kind === 'wonder' ? q.item.tile ?? null : null,
    rush: live.city.owner === state.playerNationId ? rushQuote(state, cityId, q.index) : null
  }));
};

/** The words of a rush offer: { button, title, text } ("Buy 312g"; what it buys and the wait it replaces). */
export const rushText = (q) => {
  const r = q?.rush;
  if (!r || r.gold == null) return null;
  const wait = r.turns == null ? tNow('cy.rush.noProd') : tNow('cy.rush.instead', { turns: turnsText(r.turns) });
  const heat = r.heat > 0 ? ` ${tNow('cy.rush.heat', { pct: Math.round((r.mult - 1) * 100) })}` : '';
  return {
    button: tNow('cy.rush.button', { gold: r.gold }),
    title: r.ok ? tNow('cy.rush.title', { gold: r.gold, hammers: r.hammers, label: q.label }) : r.reason,
    text: `${tNow('cy.rush.text', { label: q.label, hammers: r.hammers, gold: r.gold, each: Math.round(RUSH_GOLD_PER_HAMMER * rushRate(q.item) * 10) / 10, wait })}${heat}`
  };
};

/** The catalogue: [{ id, item, group, ok, reason, needsTech, needsName, needsEta, needsPlanned, label, detail, note, tile,
 * cost, stored, turns, long, queued }]. `id` is stable for the life of the item (React key). */
export const buildOptions = (state, cityId, live = cityLive(state, cityId)) => {
  if (!live) return [];
  const { city, ctx } = live;
  if (city.outpost || !city.tiles) return [];
  const tiles = getTiles();
  const world = worldOf(state);
  const { researched, ageId } = ctx;
  const inQueue = new Map();
  [city.production?.current, ...(city.production?.queue || [])].filter(Boolean).forEach((i) => inQueue.set(itemKey(i), (inQueue.get(itemKey(i)) || 0) + 1));
  const out = [];
  // A locked row names its tech and how far it is (researching, queued, or the research it would take).
  const locks = new Map();
  const lockOf = (need) => {
    if (!need) return { needsTech: null, needsName: null };
    if (!locks.has(need)) {
      const eta = techEta(state, need);
      locks.set(need, { needsTech: need, needsName: techName(need, TECH_TREE[need]?.name || tNow('cy.aTechnology')), needsEta: techEtaText(eta), needsPlanned: eta?.kind === 'current' || eta?.kind === 'queued' });
    }
    return locks.get(need);
  };
  const add = (item, group, extra = {}) => {
    const check = extra.ok === undefined ? canQueue(city, tiles, world, item, { researched, ageId, noRobots: ctx.noRobots }) : { ok: extra.ok, reason: extra.reason };
    const quote = buildQuote(state, cityId, item, live);
    const queued = inQueue.get(extra.key || itemKey(item)) || 0;
    out.push({
      id: extra.id || itemKey(item), item, group, ok: check.ok, reason: check.ok ? null : reasonText(check),
      label: itemLabel(item, tiles, ageId, city.tile), tile: null, detail: null, note: null, needsTech: null, needsName: null,
      cost: quote.cost, stored: quote.stored, turns: quote.turns, long: check.ok && isLongBuild(state, ageId, quote.turns), queued,
      ...extra.fields
    });
  };

  // No site worth a city in reach (settlers.js settlingOutlook: legal, explored): the row says so (I092).
  const noSite = !settlingOutlook(state, city.owner, city.tile, ageId).ok;
  add({ kind: 'settler' }, 'Units', { fields: { noSite, detail: noSite ? tNow('cy.settlerNoSite') : tNow('cy.settlerDetail') } }); // below size 2 the reason says so, with the size
  const coast = hasSeaCoast(tiles, city);
  getAvailableClasses(ageId).forEach((classId) => {
    // A unit whose tech is not known yet shows locked, with the tech's name (unitClasses.js UNIT_UNLOCKS).
    const need = isUnitUnlocked(ageId, classId, researched) ? null : unitUnlockTech(ageId, classId);
    const lock = need ? lockOf(need) : {};
    if (classId === 'naval') {
      // Ships are listed only where they can be built: an inland city (river, oasis or lake) has
      // no ship rows at all (I039), instead of rows that look available.
      if (coast) navalLinesFor(ageId).forEach((navalLine) => add({ kind: 'unit', classId, navalLine }, 'Units', { fields: { detail: unitClassRole('naval', UNIT_CLASSES.naval?.role) || null, ...lock } }));
      return;
    }
    add({ kind: 'unit', classId }, 'Units', { fields: { detail: unitClassRole(classId, UNIT_CLASSES[classId]?.role) || null, tag: unitTagText(city.owner, ageId, classId), ...lock } }); // the signature tag and the age's matchups (rank 16)
    // Its robot variant (robots.js): listed once Autonomous Warfare is known.
    if (isRobotUnlocked(ageId, classId, researched)) add({ kind: 'unit', classId, robot: true }, 'Units', { fields: { detail: tNow('cy.robotDetail') } });
  });
  // Scouts (scouting.js): cheap, no supply, explore at peace, never fight.
  add({ kind: 'unit', classId: 'support', explorer: true }, 'Units', { fields: { detail: tNow('cy.scoutDetail') } });
  templatesOf(state.nations[city.owner]).forEach((t) => {
    add({ kind: 'army', templateId: t.id, name: t.name, composition: t.composition, built: {} }, 'Armies', { id: `army:${t.id}`, fields: { detail: tNow('cy.armyDetail') } });
  });
  wonderOptions(state, city).forEach((w) => {
    const item = wonderItem(w.projectId, w.tier, w.tile);
    add(item, 'Wonders', { ok: true, fields: { detail: wonderDescription(w.projectId, GREAT_PROJECTS[w.projectId]?.description) || null, tile: w.tile ?? null } });
  });
  Object.keys(BUILDING_CATEGORIES).forEach((category) => {
    const standing = city.buildings?.categories?.[category] ?? -1;
    // A tier already queued keeps its row (marked queued) until it is built.
    const queuedTier = [city.production?.current, ...(city.production?.queue || [])].find((i) => i?.kind === 'building' && i.category === category);
    const tier = standing + 1;
    const def = BUILDING_CATEGORIES[category].tiers[tier];
    if (!def) return;
    if (BUILDING_CATEGORIES[category].coastalOnly && !coast) return; // no Harbor row inland (I040); the Buildings tab says why
    const item = { kind: 'building', category, tier };
    const need = def.requiresTech && !researched.includes(def.requiresTech) ? def.requiresTech : null;
    const effect = buildingEffect(state, cityId, category, tier);
    add(item, 'Buildings', {
      id: `building:${category}`,
      ...(queuedTier ? { ok: false, reason: tNow('cy.alreadyQueued') } : {}),
      fields: { detail: effect?.text || null, ...lockOf(need), lineLabel: buildingCategoryLabel(category, BUILDING_CATEGORIES[category].label) }
    });
  });
  const seen = new Map();
  city.tiles.forEach((t) => {
    if (t === city.tile) return;
    const facts = tileFacts(tiles, t, world.tileState[t]);
    Object.keys(IMPROVEMENTS).forEach((improvement) => {
      if (!canImprove(facts, improvement, researched) || (facts.improvement === improvement && !facts.pillaged)) return;
      const item = { kind: 'improvement', improvement, tile: t };
      const effect = improvementEffect(state, cityId, item, live);
      const queued = inQueue.get(itemKey(item)) || 0;
      let label = effect.repair ? tNow('cy.repair', { label: itemLabel(item, tiles, ageId, city.tile) }) : itemLabel(item, tiles, ageId, city.tile);
      // Two tiles can share terrain, distance and direction: number the later ones.
      const n = (seen.get(label) || 0) + 1; seen.set(label, n);
      if (n > 1) label = `${label} (${n})`;
      add(item, 'Improvements', {
        ...(queued ? { ok: false, reason: tNow('cy.alreadyQueued') } : { ok: true }),
        fields: { label, tile: t, detail: effect.text, note: effect.worked ? null : tNow('cy.notWorked'), replaces: effect.replaces }
      });
    });
  });
  return out;
};

/** The line above the build list when builds are slow here:
 * { production, limit, slow (count of long rows), better: { focus, production } | null, text }. */
export const focusHint = (state, cityId, options, live = cityLive(state, cityId)) => {
  if (!live) return null;
  // A wonder is meant to take long: it does not raise the warning on its own.
  const slow = options.filter((o) => o.long && o.group !== 'Wonders').length;
  if (!slow) return null;
  const production = live.yields.production;
  const limit = longBuildTurns(state, live.ctx.ageId);
  const preview = focusPreview(state, cityId);
  const best = preview.rows.find((r) => r.focus === 'production');
  const better = best && !best.current && best.production > production ? { focus: 'production', production: best.production, food: best.food } : null;
  // Gold is the other way out (I027): the cheapest slow build, bought outright once queued.
  const cheapest = options.filter((o) => o.long && o.group !== 'Wonders' && o.ok).sort((a, b) => (a.cost - a.stored) - (b.cost - b.stored))[0];
  const buy = cheapest ? { label: cheapest.label, gold: rushGold(Math.max(0, cheapest.cost - cheapest.stored), 0, cheapest.item) } : null;
  const buyText = buy ? ` ${tNow('cy.hint.buy', { label: buy.label, gold: buy.gold })}` : '';
  const text = better
    ? `${tNow('cy.hint.better', { count: slow, limit, production, better: better.production, starve: better.food < 0 ? ` ${tNow('cy.hint.starve')}` : '' })}${buyText}`
    : `${tNow('cy.hint.noBetter', { count: slow, limit, production, why: preview.allSame ? tNow('cy.hint.sameLand') : tNow('cy.hint.favoursProd') })}${buyText}`;
  // One line for the Build tab (BUILD-01); the full text opens on a tap.
  const short = tNow('cy.hint.short', { count: slow, limit, production });
  return { production, limit, slow, better, buy, text, short };
};
