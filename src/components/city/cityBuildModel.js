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
import { unitName as unitDisplayName } from '../../i18n/gameText';
import { unitClassRole, navalLineRole, buildingTierName, buildingCategoryLabel, wonderName, wonderDescription, techName, improvementName, terrainWord } from '../../i18n/gameText';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { getAvailableClasses, UNIT_CLASSES } from '../../data/unitClasses';
import { IMPROVEMENTS, tileFacts, canImprove } from '../../data/tileYields';
import { NAVAL_LINES, navalLinesFor } from '../../data/navalLines';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { distanceKm } from '../../data/geo/geodesic';
import { canQueue, itemKey, hasSeaCoast, SETTLER_MIN_SIZE } from '../../engine/world/cities';
import { templatesOf, nextTemplateUnit, templateProgress } from '../../engine/armyTemplates';
import { wonderOptions, wonderItem } from '../../engine/wonders';
import { cityLive, queueView, buildQuote, worldOf, isLongBuild, longBuildTurns, focusPreview } from '../../engine/cityEconomy';
import { buildingEffect, improvementEffect } from '../../engine/cityEffects';
import { settlingOutlook } from '../../engine/settlers';
import { rushQuote, rushGold, RUSH_GOLD_PER_HAMMER } from '../../engine/spending';

export const GROUPS = ['Units', 'Armies', 'Buildings', 'Wonders', 'Improvements'];

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
  if (from == null || to == null || from === to) return { km: 0, dir: '', text: 'the centre' };
  const a = tiles.latLonOf(from); const b = tiles.latLonOf(to);
  let dLon = b.lon - a.lon; if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360;
  const east = dLon * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const angle = (Math.atan2(east, b.lat - a.lat) * 180 / Math.PI + 360) % 360;
  const dir = COMPASS[Math.round(angle / 45) % 8];
  const km = Math.round(distanceKm(tiles.centres[from], tiles.centres[to]) / 10) * 10;
  return { km, dir, text: `${km} km ${dir}` };
};

/** A tile of the city in words: "coast, fish, 80 km NE". */
export const tilePlace = (tiles, cityTile, tile, facts = tileFacts(tiles, tile)) => `${describeTile(facts)}${facts.resource ? `, ${facts.resource}` : ''}, ${tileBearing(tiles, cityTile, tile).text}`;

export const itemLabel = (item, tiles = getTiles(), ageId = 'bronze', cityTile = null) => {
  if (item.kind === 'unit' && item.explorer) return 'Scouts';
  if (item.kind === 'unit') return item.classId === 'naval' ? `${unitDisplayName(ageId, 'naval', item.navalLine)} (${navalLineRole(item.navalLine || 'warship', NAVAL_LINES[item.navalLine || 'warship'].role)})` : unitDisplayName(ageId, item.classId);
  if (item.kind === 'building') return buildingTierName(item.category, item.tier, BUILDING_CATEGORIES[item.category]?.tiers[item.tier]?.name);
  if (item.kind === 'improvement') return `${improvementName(item.improvement, IMPROVEMENTS[item.improvement]?.name)}: ${cityTile != null ? tilePlace(tiles, cityTile, item.tile) : describeTile(tileFacts(tiles, item.tile))}`;
  if (item.kind === 'settler') return 'Settlers';
  if (item.kind === 'wonder') return `${wonderName(item.projectId, GREAT_PROJECTS[item.projectId]?.name)} (tier ${item.tier})${item.tile != null && cityTile != null ? `, ${tileBearing(tiles, cityTile, item.tile).text}` : ''}`;
  if (item.kind === 'army') { const next = nextTemplateUnit(item); const p = templateProgress(item); return next ? `${item.name}: ${unitDisplayName(ageId, next)} (${p.done + 1} of ${p.total})` : `${item.name} (${p.total} units)`; }
  return item.kind;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const turnsText = (turns) => (turns == null ? 'no production' : plural(turns, 'turn'));

/** The queue rows: queueView plus the label and the rush quote (spending.js, I019: what the Buy
 * button shows is what RUSH_PRODUCTION charges). */
export const buildQueue = (state, cityId, live = cityLive(state, cityId)) => {
  if (!live) return [];
  const tiles = getTiles();
  return queueView(state, cityId, live).map((q) => ({
    ...q, label: itemLabel(q.item, tiles, live.ctx.ageId, live.city.tile), tile: q.item.kind === 'improvement' || q.item.kind === 'wonder' ? q.item.tile ?? null : null,
    rush: live.city.owner === state.playerNationId ? rushQuote(state, cityId, q.index) : null
  }));
};

/** The words of a rush offer: { button, title, text } ("Buy 312g"; what it buys and the wait it replaces). */
export const rushText = (q) => {
  const r = q?.rush;
  if (!r || r.gold == null) return null;
  const wait = r.turns == null ? 'the city makes no production now' : `instead of ${turnsText(r.turns)}`;
  const heat = r.heat > 0 ? ` The price is up ${Math.round((r.mult - 1) * 100)}% for this city's recent purchases; it falls back as turns pass.` : '';
  return {
    button: `Buy ${r.gold}g`,
    title: r.ok ? `Pay ${r.gold} gold for the ${r.hammers} production ${q.label} still needs` : r.reason,
    text: `${q.label}: ${r.hammers} production for ${r.gold} gold (${RUSH_GOLD_PER_HAMMER} gold each). Done next turn, ${wait}.${heat}`
  };
};

/** The catalogue: [{ id, item, group, ok, reason, needsTech, needsName, label, detail, note, tile,
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
  const add = (item, group, extra = {}) => {
    const check = extra.ok === undefined ? canQueue(city, tiles, world, item, { researched, ageId }) : { ok: extra.ok, reason: extra.reason };
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
  add({ kind: 'settler' }, 'Units', { fields: { noSite, detail: noSite ? 'No good site is known within reach: these settlers would have nowhere worth going. Explore first.' : 'Founds a new city. Takes one citizen from this one.', note: city.size < SETTLER_MIN_SIZE ? `The city must reach size ${SETTLER_MIN_SIZE} first` : null } });
  const coast = hasSeaCoast(tiles, city);
  getAvailableClasses(ageId).forEach((classId) => {
    if (classId === 'naval') {
      // Ships are listed only where they can be built: an inland city (river, oasis or lake) has
      // no ship rows at all (I039), instead of rows that look available.
      if (coast) navalLinesFor(ageId).forEach((navalLine) => add({ kind: 'unit', classId, navalLine }, 'Units', { fields: { detail: unitClassRole('naval', UNIT_CLASSES.naval?.role) || null } }));
      return;
    }
    add({ kind: 'unit', classId }, 'Units', { fields: { detail: unitClassRole(classId, UNIT_CLASSES[classId]?.role) || null } });
  });
  // Scouts (scouting.js): cheap, no supply, explore at peace, never fight.
  add({ kind: 'unit', classId: 'support', explorer: true }, 'Units', { fields: { detail: 'Cheap, fast and unarmed. Explores free land and meets other peoples; eats no supplies.' } });
  templatesOf(state.nations[city.owner]).forEach((t) => {
    add({ kind: 'army', templateId: t.id, name: t.name, composition: t.composition, built: {} }, 'Armies', { id: `army:${t.id}`, fields: { detail: 'Built one unit at a time; each joins the army as it is trained.' } });
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
      ...(queuedTier ? { ok: false, reason: 'Already in the queue' } : {}),
      fields: { detail: effect?.text || null, needsTech: need, needsName: need ? techName(need, TECH_TREE[need]?.name || 'a technology') : null, lineLabel: buildingCategoryLabel(category, BUILDING_CATEGORIES[category].label) }
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
      let label = `${effect.repair ? 'Repair ' : ''}${itemLabel(item, tiles, ageId, city.tile)}`;
      // Two tiles can share terrain, distance and direction: number the later ones.
      const n = (seen.get(label) || 0) + 1; seen.set(label, n);
      if (n > 1) label = `${label} (${n})`;
      const notes = [effect.replaces ? `replaces the ${effect.replaces}` : null, effect.worked ? null : 'no citizen works this tile now'].filter(Boolean);
      add(item, 'Improvements', {
        ...(queued ? { ok: false, reason: 'Already in the queue' } : { ok: true }),
        fields: { label, tile: t, detail: effect.text, note: notes.length ? notes.join('; ') : null }
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
  const buy = cheapest ? { label: cheapest.label, gold: rushGold(Math.max(0, cheapest.cost - cheapest.stored), 0, cheapest.item.kind) } : null;
  const buyText = buy ? ` Or queue it and buy it with gold (${buy.label}: about ${buy.gold} gold).` : '';
  const text = better
    ? `${slow === 1 ? 'One build takes' : `${slow} builds take`} over ${limit} turns at ${production} production a turn. Production focus would make ${better.production}${better.food < 0 ? ' (but the city would starve)' : ''}.${buyText}`
    : `${slow === 1 ? 'One build takes' : `${slow} builds take`} over ${limit} turns at ${production} production a turn. Focus cannot help here: ${preview.allSame ? 'every focus works the same land' : 'it already favours production'}. Mines, lumber camps or more citizens will.${buyText}`;
  // One line for the Build tab (BUILD-01); the full text opens on a tap.
  const short = `${slow === 1 ? 'One build is' : `${slow} builds are`} slow here: over ${limit} turns at ${production} production.`;
  return { production, limit, slow, better, buy, text, short };
};
