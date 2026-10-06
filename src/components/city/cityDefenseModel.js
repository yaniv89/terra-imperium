// src/components/city/cityDefenseModel.js
// The city sheet's Defense tab and damage alert (W05, plans/UI-DESIGN.md; master plan 6.3 and 6.8):
// the battle housing explained line by line (houses holding 5, 10 or 15 by size, the town hall's
// 20, minus the houses in ruins), the damage a battle left and when it is repaired (free; nothing
// repairs under siege), the walls and the siege. From the city's manifest (cityManifest.js). Pure.
import { cityManifestOf, cityDamageOf, cityHousingCap } from '../../engine/cityManifest';
import { wallsOf } from '../../engine/sieges';

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
    { id: 'houses', label: `${houses.length} house${houses.length === 1 ? '' : 's'} (${bySize.map((g) => `${g.count} of ${g.holds}`).join(', ') || 'none'})`, value: housesHold },
    ...(hall ? [{ id: 'townhall', label: 'Town hall', value: hall.housing || 0 }] : []),
    ...(ruinedHouses.length ? [{ id: 'ruined', label: `${ruinedHouses.length} house${ruinedHouses.length === 1 ? '' : 's'} in ruins`, value: -ruinedHold }] : [])
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
        ruined ? `${ruined} house${ruined === 1 ? '' : 's'} ruined, rebuilt in ${Math.max(...ruinTurns)} turn${Math.max(...ruinTurns) === 1 ? '' : 's'}` : null,
        damaged ? `${damaged} damaged, repaired in ${Math.max(...repairTurns)} turn${Math.max(...repairTurns) === 1 ? '' : 's'}` : null
      ].filter(Boolean).join('; ') + (besieged ? ' (paused: under siege)' : '')
    }
    : null;
  return {
    housing: manifest ? cityHousingCap(state, cityId, manifest) : 0,
    lines,
    alert,
    walls: wallsOf(city),
    siege: city.siege ? { by: city.siege.by ? state.nations?.[city.siege.by]?.name || 'Rebels' : null, hp: city.siege.hp, maxHp: city.siege.maxHp, encircled: !!city.siege.encircled } : null
  };
};
