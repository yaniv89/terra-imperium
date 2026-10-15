// src/components/city/cityDefenseModel.js
// The city sheet's Defense tab and damage alert (W05, plans/UI-DESIGN.md; master plan 6.3 and 6.8):
// the battle housing explained line by line (houses holding 5, 10 or 15 by size, the town hall's
// 20, minus the houses in ruins), the damage a battle left and when it is repaired (free; nothing
// repairs under siege), the walls and the siege. From the city's manifest (cityManifest.js). Pure.
import { cityManifestOf, cityDamageOf, cityHousingCap } from '../../engine/cityManifest';
import { wallsOf } from '../../engine/sieges';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { t as tNow } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { buildingTierName } from '../../i18n/gameText';

const wallName = (tier, def) => buildingTierName('defense', tier, def?.name);

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
    { id: 'walls', tab: nextWall ? 'build' : null, action: nextWall ? tNow('cy.def.buildWall', { name: wallName(defenseTier + 1, nextWall) }) : null, text: nextWall ? tNow('cy.def.wallsNext', { name: wallName(defenseTier + 1, nextWall) }) : tNow('cy.def.lineDone') },
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
    siege: city.siege ? { by: city.siege.by ? nameNow('nation', city.siege.by, state.nations?.[city.siege.by]?.name || tNow('cy.rebels')) : null, hp: city.siege.hp, maxHp: city.siege.maxHp, encircled: !!city.siege.encircled } : null
  };
};
