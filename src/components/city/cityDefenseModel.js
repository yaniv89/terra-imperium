// src/components/city/cityDefenseModel.js
// The city sheet's Defense tab and damage alert (W05, plans/UI-DESIGN.md; master plan 6.3 and 6.8):
// the battle housing explained line by line (houses holding 5, 10 or 15 by size, the town hall's
// 20, minus the houses in ruins), the damage a battle left and when it is repaired (free; nothing
// repairs under siege), the walls and the siege. From the city's manifest (cityManifest.js). Pure.
import { cityManifestOf, cityDamageOf, cityHousingCap } from '../../engine/cityManifest';
import { wallsOf, besiegersOf } from '../../engine/sieges';
import { validateFieldAttack } from '../../engine/fieldBattle';
import { unitTile } from '../../engine/armies';
import { describeAttackBlock } from '../../utils/attackAvailability';
import { menText } from '../../engine/battleLedger';
import { raidEta } from '../../engine/raids';
import { isIndependentNation } from '../../data/independents';
import { getTiles } from '../../data/geo/tiles';
import { distanceKm } from '../../data/geo/geodesic';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { t as tNow } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { buildingTierName } from '../../i18n/gameText';

const wallName = (tier, def) => buildingTierName('defense', tier, def?.name);

/**
 * Engage the besiegers (playtest 40650976677 step 67: the only way into the battle was the enemy's
 * banner on the map): a sally from the city on the weakest besieging stack, the same pre-battle card
 * as any attack. { tile, men, ok, reason } or null when nobody of the player's besieges it.
 */
export const engageTarget = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city?.siege?.by || city.owner !== state.playerNationId || city.tile == null) return null;
  const stacks = new Map();
  besiegersOf(state, city).forEach((units) => units.forEach((u) => { const t = unitTile(state, u); stacks.set(t, (stacks.get(t) || 0) + Math.max(0, u.strength)); }));
  const [tile, strength] = [...stacks].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0] || [];
  if (tile == null) return null;
  const v = validateFieldAttack(state, cityId, tile);
  return { tile, men: menText(strength), ok: v.ok, reason: describeAttackBlock(v) };
};

/**
 * Who is coming for this city of the player's (lead: the raid and march warnings must be actionable):
 * raid parties out against it and armies marching on it, each { kind, nationId, name, men, turns|tiles },
 * plus `armyTile`, the player's nearest field army outside the city (Send an army), or null.
 */
export const comingFor = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner !== state.playerNationId || city.tile == null) return null;
  const tiles = getTiles();
  const name = (id) => nameNow('nation', id, state.nations?.[id]?.name || id);
  const strengthOf = (list) => list.reduce((n, u) => n + Math.max(0, u.strength), 0);
  const list = [];
  Object.keys(state.nations || {}).sort().forEach((id) => {
    const raid = state.nations[id]?.indep?.raid;
    if (!isIndependentNation(state.nations[id]) || !raid || raid.phase !== 'out' || raid.targetNationId !== state.playerNationId) return;
    if (raid.targetCityId !== cityId && state.world?.tileOwner?.[raid.targetTile] !== cityId) return;
    const party = Object.values(state.units || {}).filter((u) => u.raidOf === id && u.strength > 0);
    if (party.length) list.push({ kind: 'raid', nationId: id, name: name(id), men: menText(strengthOf(party)), turns: raidEta(state, id)?.turns ?? null });
  });
  const marching = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (u.ownerId === state.playerNationId || u.raidOf || !u.route?.length || u.route[u.route.length - 1] !== city.tile || !(u.strength > 0)) return;
    const m = marching.get(u.ownerId) || { units: [], tiles: u.route.length };
    m.units.push(u); m.tiles = Math.min(m.tiles, u.route.length);
    marching.set(u.ownerId, m);
  });
  marching.forEach((m, id) => list.push({ kind: 'army', nationId: id, name: name(id), men: menText(strengthOf(m.units)), tiles: m.tiles }));
  if (!list.length) return null;
  const at = tiles.centres[city.tile];
  let armyTile = null; let best = Infinity;
  Object.values(state.units || {}).forEach((u) => {
    if (u.ownerId !== state.playerNationId || u.domain !== 'land' || u.classId === 'settler' || u.embarkedOn || !(u.strength > 0)) return;
    const t = unitTile(state, u);
    if (t == null || t === city.tile) return;
    const d = distanceKm(tiles.centres[t], at);
    if (d < best) { best = d; armyTile = t; }
  });
  return { list, armyTile };
};

export const cityDefenseModel = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city) return null;
  const manifest = cityManifestOf(state, cityId);
  const dmg = cityDamageOf(city);
  const houses = manifest ? manifest.structures.filter((s) => s.kind === 'house') : [];
  const hall = manifest ? manifest.structures.find((s) => s.kind === 'townhall') : null;
  const ruinedHouses = houses.filter((h) => dmg.ruined[h.id]);
  const housesHold = houses.reduce((s, h) => s + (h.housing || 0), 0);
  const ruinedHold = ruinedHouses.reduce((s, h) => s + (h.housing || 0), 0);
  // houses grouped by what each holds: "12 houses of 5", "6 of 10"...
  const bySize = [5, 10, 15].map((n) => ({ holds: n, count: houses.filter((h) => h.housing === n).length })).filter((g) => g.count > 0);
  const lines = [
    { id: 'houses', label: tNow('cy.def.houses', { count: houses.length, list: bySize.map((g) => tNow('cy.def.ofHolds', { count: g.count, holds: g.holds })).join(', ') || tNow('cy.def.none') }), value: housesHold },
    ...(hall ? [{ id: 'townhall', label: tNow('cy.def.townHall'), value: hall.housing || 0 }] : []),
    ...(ruinedHouses.length ? [{ id: 'ruined', label: tNow('cy.def.ruinedHouses', { count: ruinedHouses.length }), value: -ruinedHold }] : [])
  ];
  const ruinTurns = Object.values(dmg.ruined);
  const damagedIds = Object.keys(dmg.damaged);
  const repairTurns = Object.values(dmg.damaged);
  const besieged = !!city.siege?.by;
  const ruined = ruinedHouses.length;
  const damaged = damagedIds.length;
  const alert = ruined || damaged
    ? {
      ruined,
      damaged,
      rebuiltIn: ruinTurns.length ? Math.max(...ruinTurns) : 0,
      repairedIn: repairTurns.length ? Math.max(...repairTurns) : 0,
      paused: besieged,
      text: [
        ruined ? tNow('cy.def.alertRuined', { count: ruined, turns: tNow('cy.turns', { count: Math.max(...ruinTurns) }) }) : null,
        damaged ? tNow('cy.def.alertDamaged', { n: damaged, turns: tNow('cy.turns', { count: Math.max(...repairTurns) }) }) : null
      ].filter(Boolean).join('; ') + (besieged ? ` ${tNow('cy.def.paused')}` : '')
    }
    : null;
  // What the player can DO about the defence, each with the tab that does it (I053): the tab
  // itself only reports.
  const mine = city.owner === state.playerNationId;
  const defenseTier = city.buildings?.categories?.defense ?? -1;
  const nextWall = BUILDING_CATEGORIES.defense.tiers[defenseTier + 1] || null;
  const garrison = Object.values(state.units || {}).filter((u) => u.ownerId === city.owner && u.domain === 'land' && u.classId !== 'settler' && u.strength > 0 && (u.tile != null ? u.tile === city.tile : u.regionId === cityId)).length;
  const paths = !mine ? [] : [
    { id: 'walls', tab: nextWall ? 'build' : null, item: nextWall && (!nextWall.requiresTech || state.techTree?.[nextWall.requiresTech]?.researched) ? { kind: 'building', category: 'defense', tier: defenseTier + 1 } : null, action: nextWall ? tNow('cy.def.buildWall', { name: wallName(defenseTier + 1, nextWall) }) : null, text: nextWall ? tNow('cy.def.wallsNext', { name: wallName(defenseTier + 1, nextWall) }) : tNow('cy.def.lineDone') },
    { id: 'garrison', tab: 'build', action: tNow('cy.def.train'), text: garrison ? tNow('cy.def.garrison', { count: garrison }) : tNow('cy.def.noGarrison') },
    { id: 'works', tab: 'buildings', action: tNow('cy.def.openBuildings'), text: tNow('cy.def.level', { n: city.defenseLevel || 0 }) }
  ];
  return {
    housing: manifest ? cityHousingCap(state, cityId, manifest) : 0,
    lines,
    alert,
    paths,
    garrison,
    walls: wallsOf(city),
    cityId,
    engage: mine ? engageTarget(state, cityId) : null,
    coming: mine ? comingFor(state, cityId) : null,
    siege: city.siege ? { by: city.siege.by ? nameNow('nation', city.siege.by, state.nations?.[city.siege.by]?.name || tNow('cy.rebels')) : null, hp: city.siege.hp, maxHp: city.siege.maxHp, encircled: !!city.siege.encircled } : null
  };
};
