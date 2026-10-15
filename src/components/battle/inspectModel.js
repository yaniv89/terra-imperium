// src/components/battle/inspectModel.js
// What the battle's info card says about anything tapped on the field (plans/UI-DESIGN.md section 8,
// B09): a building of the battle economy (either side's, the camp, the town hall), a structure of
// the town (keep, towers, wall segments, the gate, houses, the region's buildings, the palace) or a
// resource node. Pure: from the HUD frame (render/view.js), the setup and who the player is.
//   inspectInfo(hud, setup, target, playerSide) -> { title, owner, ownerLabel, hp, maxHp, alive,
//     built, progress, icon: { group, id } | { url } | null, glyph, lines: [string], node? } | null
import { BUILDINGS, RESOURCES } from '../../battle/data/economy';
import { t } from '../../i18n/core';
import { ecoLabel, roleLabel, buildingEffect, nodeLabel, structureLabel, resourceWord } from './battleText';
import { isBaseType } from '../../battle/sim/base';
import { buildingIconUrl, iconUrl } from '../../data/icons';
import { categoryTierName, wonderName } from '../../i18n/gameText';

// A node's picture: the resource art (src/assets/icons/resources).
const NODE_ICON = { tree: 'timber', stone: 'stone', gold: 'gold', herd: 'sheep', cattle: 'cattle', fish: 'fish', farm: 'wheat' };
const STRUCTURE_TITLE = { keep: 'Keep', tower: 'Tower', wall: 'Wall', gate: 'Gate', house: 'House', palace: 'Palace', wonder: 'Wonder', landmark: 'Landmark', building: 'Building' };
const STRUCTURE_ICON = { keep: 'build-town-hall', tower: 'build-tower', house: 'build-house' };
const list = (xs) => (xs.length <= 1 ? xs.join('') : t('bt.inspect.list2', { a: xs.slice(0, -1).join(', '), b: xs[xs.length - 1] }));
const ownerOf = (side, playerSide) => (side == null || side < 0 ? 'neutral' : side === playerSide ? 'you' : 'enemy');
const ownerLabel = (owner) => t(`bt.inspect.${owner}`);

const ecoInfo = (hud, setup, b, playerSide) => {
  const def = BUILDINGS[b.type] || {};
  const ageId = setup.sides[b.side]?.ageId;
  const owner = ownerOf(b.side, playerSide);
  const lines = [];
  if (!b.built) lines.push(t('bt.eco.buildingDots', { progress: b.progress }));
  const q0 = owner === 'you' && b.built ? b.queue?.[0] : null;
  if (q0) lines.push(q0.blocked === 'housing' ? t('bt.inspect.trainWaits') : b.queue.length > 1 ? t('bt.inspect.trainingMore', { unit: roleLabel(q0.role, ageId).toLowerCase(), pct: q0.pct, more: b.queue.length - 1 }) : t('bt.inspect.training', { unit: roleLabel(q0.role, ageId).toLowerCase(), pct: q0.pct }));
  if (def.trains?.length) lines.push(t('bt.inspect.trains', { list: list(def.trains.map((r) => roleLabel(r, ageId).toLowerCase())) }));
  if (def.housing) lines.push(t('bt.inspect.housing', { n: def.housing }));
  if (def.dropoff && !def.hq) lines.push(t('bt.inspect.takes', { list: list(def.dropoff.map((r) => resourceWord(r))) }));
  // I208: the camp's name follows the age (Expedition camp, Headquarters tent, Command camp): say what it is.
  if (def.hq) lines.push(owner === 'you' ? t('bt.inspect.hqYours') : t('bt.inspect.hqTheirs'));
  // The base rule (sim/base.js): what counts.
  if (hud.base && b.built) lines.push(isBaseType(b.type) ? (owner === 'you' ? t('bt.inspect.baseYours') : t('bt.inspect.baseTheirs')) : t('bt.inspect.notBase'));
  if (def.trade) lines.push(t('bt.inspect.trade'));
  if (def.farm) lines.push(t('bt.inspect.farm', { n: def.slots }));
  if (def.mine) lines.push(t('bt.inspect.mine'));
  if (def.aid) lines.push(t('bt.inspect.aid'));
  if (def.tower) lines.push(t('bt.inspect.towerShoots'));
  if (owner === 'enemy' && b.built) lines.push(t('bt.inspect.loot'));
  return {
    kind: 'eco', title: ecoLabel(b.type, ageId), owner, ownerLabel: ownerLabel(owner), hp: b.hp, maxHp: b.maxHp, alive: b.alive,
    built: b.built, progress: b.built ? 100 : b.progress, icon: def.icon ? { group: 'battle', id: def.icon } : null, glyph: 'building', lines, type: b.type
  };
};

// A building of the town, a wonder or a plain structure, named in the current language.
export const structureName = (st) => (st.projectId ? wonderName(st.projectId, st.name) : st.category ? categoryTierName(st.category, st.tier ?? 0) : st.name || structureLabel(st.kind, STRUCTURE_TITLE[st.kind]));

const structureInfo = (hud, setup, index, playerSide) => {
  const live = hud.structures[index]; const st = setup.structures?.[index] || {};
  if (!live) return null;
  const owner = ownerOf(1, playerSide); // the town and its works are the defender's
  const town = index === 0 && setup.city;
  const title = town ? t('bt.inspect.townHall') : st.kind === 'building' || st.name ? structureName(st) : structureLabel(live.kind, STRUCTURE_TITLE[live.kind] || live.kind);
  const lines = [];
  if (!live.alive) lines.push(live.kind === 'gate' ? t('bt.inspect.brokenGate') : live.kind === 'wall' ? t('bt.inspect.breached') : t('bt.inspect.ruined'));
  if (hud.base) {
    // The base rule (sim/base.js): the keep is one base building among others.
    if (index === 0 || live.kind === 'building') lines.push(owner === 'you' ? t('bt.inspect.baseYours') : t('bt.inspect.baseTheirs'));
    else lines.push(t('bt.inspect.notBase'));
  } else if (index === 0) lines.push(owner === 'you' ? t('bt.inspect.objectiveHold') : t('bt.inspect.objectiveTake'));
  if (live.garrisonSlots > 0) lines.push(t('bt.inspect.garrison', { a: live.garrison, b: live.garrisonSlots }));
  if (st.housing) lines.push(t('bt.inspect.houses', { n: st.housing }));
  if (live.kind === 'building' && st.category) lines.push(buildingEffect(st.category, '') || t('bt.inspect.landmark'));
  if (live.kind === 'tower' || (index === 0 && st.damage > 0)) lines.push(t('bt.inspect.shootsBack'));
  if (live.kind === 'gate' && live.alive) lines.push(t('bt.inspect.gateIn'));
  if (live.kind === 'wall' && live.alive) lines.push(t('bt.inspect.wallBlocks'));
  const icon = STRUCTURE_ICON[live.kind]
    ? { group: 'battle', id: STRUCTURE_ICON[live.kind] }
    : live.kind === 'building' && st.category ? (buildingIconUrl(st.category, st.tier ?? 0) ? { url: buildingIconUrl(st.category, st.tier ?? 0) } : null) : null;
  return { kind: 'structure', title, owner, ownerLabel: ownerLabel(owner), hp: live.hp, maxHp: live.maxHp, alive: live.alive, built: true, progress: 100, icon, glyph: live.kind, lines };
};

const nodeInfo = (hud, n) => {
  const left = n.amount < 0 ? null : n.amount;
  const lines = [n.kind === 'farm' ? t('bt.inspect.farmLine') : t('bt.inspect.gather', { res: resourceWord(n.res) })];
  return {
    kind: 'node', title: n.kind === 'farm' ? t('bt.inspect.farmField') : nodeLabel(n.kind), owner: 'neutral', ownerLabel: t('bt.inspect.resource'), hp: left, maxHp: n.max < 0 ? null : n.max,
    alive: true, built: true, progress: 100, icon: iconUrl('resources', NODE_ICON[n.kind]) ? { group: 'resources', id: NODE_ICON[n.kind] } : null, glyph: 'node', lines, node: { res: n.res, left, max: n.max }
  };
};

/** The info card for `target` ({ kind: 'eco' | 'structure' | 'node', index }), or null when it is gone from view. */
export const inspectInfo = (hud, setup, target, playerSide) => {
  if (!hud || !target) return null;
  if (target.kind === 'eco') {
    const b = hud.eco?.buildings.find((x) => x.idx === target.index);
    if (!b) return null;
    if (b.proxy) return structureInfo(hud, setup, 0, playerSide); // the town hall is the keep
    return ecoInfo(hud, setup, b, playerSide);
  }
  if (target.kind === 'structure') return structureInfo(hud, setup, target.index, playerSide);
  if (target.kind === 'node') { const n = hud.eco?.nodes.find((x) => x.i === target.index); return n ? nodeInfo(hud, n) : null; }
  return null;
};

/** Why a building cannot be placed now, or null: the shortfall per resource and the laborers. */
export const buildBlock = (id, stock, workers) => {
  const cost = BUILDINGS[id]?.cost || {};
  const short = RESOURCES.map((r, i) => [r, Math.max(0, (cost[r] || 0) - (stock?.[i] || 0))]).filter(([, v]) => v > 0);
  if (short.length) return { kind: 'cost', short, text: t('bt.eco.needs', { list: list(short.map(([r, v]) => t('bt.eco.more', { v, res: resourceWord(r) }))) }) };
  if (!workers) return { kind: 'workers', short: [], text: t('bt.inspect.noLaborers') };
  return null;
};

/** The build menu's detail for a building: what it does, its HP, footprint and build time. */
export const buildDetail = (id, ageId) => {
  const def = BUILDINGS[id];
  if (!def) return null;
  const info = ecoInfo({ structures: [] }, { sides: [{ ageId }] }, { type: id, side: 0, hp: def.hp, maxHp: def.hp, alive: true, built: true, progress: 100 }, 0);
  return { title: info.title, lines: info.lines.filter((l) => l !== t('bt.inspect.hqYours')), hp: def.hp, size: def.size, time: def.time, trains: def.trains || [], cost: def.cost || {} };
};

