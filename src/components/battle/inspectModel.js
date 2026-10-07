// src/components/battle/inspectModel.js
// What the battle's info card says about anything tapped on the field (plans/UI-DESIGN.md section 8,
// B09): a building of the battle economy (either side's, the camp, the town hall), a structure of
// the town (keep, towers, wall segments, the gate, houses, the region's buildings, the palace) or a
// resource node. Pure: from the HUD frame (render/view.js), the setup and who the player is.
//   inspectInfo(hud, setup, target, playerSide) -> { title, owner, ownerLabel, hp, maxHp, alive,
//     built, progress, icon: { group, id } | { url } | null, glyph, lines: [string], node? } | null
import { BUILDINGS, NODE_KINDS, ecoName } from '../../battle/data/economy';
import { BUILDING_EFFECTS } from '../../battle/sim/buildings';
import { getSquadDisplayName } from '../../battle/data/battleStats';
import { buildingIconUrl, iconUrl } from '../../data/icons';

const RES_WORD = { food: 'food', materials: 'materials', gold: 'gold' };
// A node's picture: the resource art (src/assets/icons/resources).
const NODE_ICON = { tree: 'timber', stone: 'stone', ore: 'iron', gold: 'gold', herd: 'sheep', cattle: 'cattle', fish: 'fish', farm: 'wheat' };
const STRUCTURE_TITLE = { keep: 'Keep', tower: 'Tower', wall: 'Wall', gate: 'Gate', house: 'House', palace: 'Palace', wonder: 'Wonder', landmark: 'Landmark', building: 'Building' };
const STRUCTURE_ICON = { keep: 'build-town-hall', tower: 'build-tower', house: 'build-house' };
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const ownerOf = (side, playerSide) => (side == null || side < 0 ? 'neutral' : side === playerSide ? 'you' : 'enemy');
const OWNER_LABEL = { you: 'Yours', enemy: 'Enemy', neutral: 'Neutral' };

const ecoInfo = (hud, setup, b, playerSide) => {
  const def = BUILDINGS[b.type] || {};
  const ageId = setup.sides[b.side]?.ageId;
  const owner = ownerOf(b.side, playerSide);
  const lines = [];
  if (!b.built) lines.push(`Under construction, ${b.progress}% built: its HP rises as it goes up`);
  if (def.trains?.length) lines.push(`Trains ${list(def.trains.map((r) => (r === 'worker' ? ecoName('worker', ageId) : getSquadDisplayName(r, ageId)).toLowerCase()))}`);
  if (def.housing) lines.push(`+${def.housing} housing`);
  if (def.dropoff && !def.hq) lines.push(`Takes ${list(def.dropoff.map((r) => RES_WORD[r]))}`);
  if (def.hq) lines.push(owner === 'you' ? 'Your headquarters: laborers bring everything here' : 'Their headquarters');
  if (def.trade) lines.push('Brings in gold while it stands');
  if (def.farm) lines.push(`Food for ${def.slots} laborers, never runs out`);
  if (def.mine) lines.push('Faster mining at its vein');
  if (def.aid) lines.push('Heals resting troops nearby');
  if (def.tower) lines.push('Shoots the nearest enemy in range');
  if (owner === 'enemy' && b.built) lines.push('Destroy it for a quarter of its price in gold');
  return {
    kind: 'eco', title: ecoName(b.type, ageId), owner, ownerLabel: OWNER_LABEL[owner], hp: b.hp, maxHp: b.maxHp, alive: b.alive,
    built: b.built, progress: b.built ? 100 : b.progress, icon: def.icon ? { group: 'battle', id: def.icon } : null, glyph: 'building', lines, type: b.type
  };
};

const structureInfo = (hud, setup, index, playerSide) => {
  const live = hud.structures[index]; const st = setup.structures?.[index] || {};
  if (!live) return null;
  const owner = ownerOf(1, playerSide); // the town and its works are the defender's
  const town = index === 0 && setup.city;
  const title = town ? 'Town hall' : st.kind === 'building' || st.name ? st.name || STRUCTURE_TITLE[st.kind] : STRUCTURE_TITLE[live.kind] || live.kind;
  const lines = [];
  if (!live.alive) lines.push(live.kind === 'gate' ? 'Broken open' : live.kind === 'wall' ? 'Breached' : 'Ruined');
  if (index === 0) lines.push(owner === 'you' ? 'The objective: hold it to the end' : 'The objective: take it');
  if (live.garrisonSlots > 0) lines.push(`Garrison ${live.garrison} / ${live.garrisonSlots}`);
  if (st.housing) lines.push(`Houses ${st.housing} people (battle housing)`);
  if (live.kind === 'building' && st.category) lines.push(BUILDING_EFFECTS[st.category] || 'A landmark of the town');
  if (live.kind === 'tower' || (index === 0 && st.damage > 0)) lines.push('Shoots back');
  if (live.kind === 'gate' && live.alive) lines.push('The way in; open ground once broken');
  if (live.kind === 'wall' && live.alive) lines.push('Blocks the way until breached');
  const icon = STRUCTURE_ICON[live.kind]
    ? { group: 'battle', id: STRUCTURE_ICON[live.kind] }
    : live.kind === 'building' && st.category ? (buildingIconUrl(st.category, st.tier ?? 0) ? { url: buildingIconUrl(st.category, st.tier ?? 0) } : null) : null;
  return { kind: 'structure', title, owner, ownerLabel: OWNER_LABEL[owner], hp: live.hp, maxHp: live.maxHp, alive: live.alive, built: true, progress: 100, icon, glyph: live.kind, lines };
};

const nodeInfo = (hud, n) => {
  const k = NODE_KINDS[n.kind] || {};
  const left = n.amount < 0 ? null : n.amount;
  const lines = [n.kind === 'farm' ? 'A sown field: food without end' : `Laborers gather ${RES_WORD[n.res]} here`];
  return {
    kind: 'node', title: n.kind === 'farm' ? 'Farm field' : k.label || n.kind, owner: 'neutral', ownerLabel: 'Resource', hp: left, maxHp: n.max < 0 ? null : n.max,
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
  const short = ['food', 'materials', 'gold'].map((r, i) => [r, Math.max(0, (cost[r] || 0) - (stock?.[i] || 0))]).filter(([, v]) => v > 0);
  if (short.length) return { kind: 'cost', short, text: `Needs ${list(short.map(([r, v]) => `${v} more ${RES_WORD[r]}`))}` };
  if (!workers) return { kind: 'workers', short: [], text: 'No laborers left to build it' };
  return null;
};

/** The build menu's detail for a building: what it does, its HP, footprint and build time. */
export const buildDetail = (id, ageId) => {
  const def = BUILDINGS[id];
  if (!def) return null;
  const info = ecoInfo({ structures: [] }, { sides: [{ ageId }] }, { type: id, side: 0, hp: def.hp, maxHp: def.hp, alive: true, built: true, progress: 100 }, 0);
  return { title: info.title, lines: info.lines.filter((l) => !l.startsWith('Your headquarters')), hp: def.hp, size: def.size, time: def.time, trains: def.trains || [], cost: def.cost || {} };
};

