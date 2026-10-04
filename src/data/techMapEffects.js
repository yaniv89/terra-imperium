// src/data/techMapEffects.js
// Map effects per tech (plans/civ-map-rework.md, C3.2; workstream 10): every tech changes what a
// nation can do on the map, beyond the buildings, units and improvements it unlocks
// (requiresTech in buildings.js, unitClasses.js and tileYields.js) and its income modifiers
// (techTree.js TECH_EFFECTS). The engine sums the numeric keys of a nation's researched techs
// (src/engine/techMapEffects.js mapEffectsOf) and the systems read them:
// Reaches are in km (plans/math/grid-f100.md): the systems add them to their own km rule and turn
// the sum into rings of the loaded grid (gridScale.js ringsForKm). 102 km is one ring at frequency 75.
//   sight          +km of sight for armies and land (sight.js)
//   navalMoves     +km a turn for fleets (fleets.js)
//   deepOcean      the open ocean is sailable whatever the age (fleets.js)
//   borderRing     +km a city's border may reach (cities.js claimCandidates)
//   tileCostMult   x on the culture cost of a tile (cities.js tileCultureCost)
//   granaryKeep    the share of the growth threshold a city keeps when it grows (cities.js)
//   claimRange     +km a claim may reach from the border (claims.js)
//   governorRings  +km a governor's group spans (governors.js)
//   stackCap       +units a tile holds without supply trouble (supplyMeter.js)
//   supplyMax      +points on the supply meter (supplyMeter.js)
//   lineRings      +km a supply line reaches (resolveTurn)
//   hillsCost      movement points added or removed on hills (armies.js)
//   mountainCost   the same on mountains
//   roadCost       added to the movement cost of a road tile (negative: faster)
//   movePoints     +km a turn for land armies (armies.js movePoints; not settlers or aircraft)
// Each entry's `label` is the line the research sheet shows.
export const TECH_MAP_EFFECTS = {
  military_bronze_casting: { label: 'Armies see one tile further', sight: 102 },
  military_composite_bow: { label: 'Hills cost no extra movement', hillsCost: -1 },
  military_feudal_levies: { label: 'Stacks hold two more units', stackCap: 2 },
  military_plate_armor: { label: 'Supply meter +20', supplyMax: 20 },
  military_standing_armies: { label: 'Supply lines reach two tiles further', lineRings: 204 },
  military_mechanized_warfare: { label: 'Roads at a third of the cost; land armies move two tiles further a turn', roadCost: -0.15, movePoints: 204 },
  economy_granary_storage: { label: 'A quarter of the food stays when a city grows', granaryKeep: 0.25 },
  economy_silk_road_trade: { label: 'Tiles cost 10% less culture to claim', tileCostMult: -0.1 },
  economy_banking_houses: { label: 'Fleets sail one tile further a turn', navalMoves: 102 },
  economy_joint_stock_companies: { label: 'Fleets sail one tile further a turn', navalMoves: 102 },
  economy_colonial_trade: { label: 'The open ocean is sailable', deepOcean: 1 },
  infrastructure_mudbrick_roads: { label: 'Armies see one tile further', sight: 102 },
  infrastructure_paved_roads: { label: 'Roads are crossed faster', roadCost: -0.1 },
  infrastructure_postal_relay: { label: 'Supply lines reach two tiles further', lineRings: 204 },
  infrastructure_turnpike_roads: { label: 'Roads are crossed faster', roadCost: -0.1 },
  infrastructure_highway_systems: { label: 'Mountains cost two movement points less, hills none', mountainCost: -2, hillsCost: -1 },
  governance_scribal_bureaucracy: { label: 'Claims reach one tile further', claimRange: 102 },
  governance_provincial_administration: { label: 'Borders may reach one ring further', borderRing: 102 },
  governance_royal_chancery: { label: 'A governor spans two more rings', governorRings: 204 },
  governance_bureaucratic_reform: { label: 'Tiles cost 10% less culture to claim', tileCostMult: -0.1 },
  governance_civil_service: { label: 'A governor spans two more rings', governorRings: 204 },
  science_cuneiform_records: { label: 'Tiles cost 10% less culture to claim', tileCostMult: -0.1 },
  science_early_astronomy: { label: 'Fleets sail one tile further a turn', navalMoves: 102 },
  science_geometry: { label: 'Borders may reach one ring further', borderRing: 102 },
  science_natural_philosophy: { label: 'Mountains cost one movement point less', mountainCost: -1 },
  science_optics: { label: 'Armies and fleets see one tile further', sight: 102 },
  science_scientific_method: { label: 'Half the food stays when a city grows', granaryKeep: 0.25 },
  science_calculus: { label: 'Fleets sail one tile further a turn', navalMoves: 102 },
  science_computing: { label: 'Everything in sight reaches one tile further', sight: 102 },
  science_genomics: { label: 'Stacks hold two more units', stackCap: 2 }
};
