// src/data/glossary/index.js
// The glossary (differentiation plan U30): one entry per people, city, tech and unit, read straight
// from the existing data (no second copy to drift). Returns facts only; GlossarySheet words them,
// so every line goes through the usual i18n keys. A unit id is `<age>_<class>` (the roster).
import { PEOPLES, PEOPLES_LIST } from '../peoples';
import { TECH_TREE } from '../techTree';
import { UNIT_ROSTER, UNIT_CLASSES, UNIT_UNLOCKS } from '../unitClasses';
import { BOOSTS } from '../boosts';
import { BUILDING_CATEGORIES } from '../buildings';
import { RESOURCES_ON_TILES, IMPROVEMENTS, RESOURCE_KNOWN_FROM_TECH, RESOURCE_KNOWN_FROM_AGE } from '../tileYields';
import PEOPLE_NOTES from './peopleNotes.json'; // AI-drafted, reviewed: { note, founded: {en, he}, uncertain }

export const GLOSSARY_KINDS = ['people', 'city', 'tech', 'unit', 'building', 'resource', 'improvement'];
/** A building id is `<category>.<tier index>` (the city's building lines). */
export const buildingId = (categoryId, tierIndex) => `${categoryId}.${tierIndex}`;
// The game's own words, for a newcomer (newcomer playtest: Glossary opened a people page, never a
// list). Text lives in the i18n keys gloss.term.<id> and gloss.term.<id>.text.
export const GLOSSARY_TERMS = ['gold', 'production', 'science', 'settlers', 'scouts', 'army', 'battle', 'war', 'pact', 'independents', 'ruler', 'decrees', 'governor', 'laws', 'ages', 'goals', 'food', 'culture', 'boosts', 'queue', 'focus', 'landmarks', 'catchup', 'help'];

/** Every id of a kind that has an entry. */
export const glossaryIds = (kind) => ({
  people: () => PEOPLES_LIST.map((p) => p.id),
  city: () => PEOPLES_LIST.flatMap((p) => p.cities),
  tech: () => Object.keys(TECH_TREE),
  unit: () => Object.entries(UNIT_ROSTER).flatMap(([age, classes]) => Object.keys(classes).map((c) => `${age}_${c}`)),
  building: () => Object.entries(BUILDING_CATEGORIES).flatMap(([cat, def]) => def.tiers.map((_, i) => buildingId(cat, i))),
  resource: () => Object.keys(RESOURCES_ON_TILES),
  improvement: () => Object.keys(IMPROVEMENTS)
}[kind]?.() || []);

// shortcut: a city name shared by two peoples shows the first; the name list is small, upgrade if a clash matters.
const CITY_HOME = new Map();
PEOPLES_LIST.forEach((p) => p.cities.forEach((c, i) => { if (!CITY_HOME.has(c)) CITY_HOME.set(c, { peopleId: p.id, capital: i === 0 }); }));

export const glossaryEntry = (kind, id) => {
  if (kind === 'term') return GLOSSARY_TERMS.includes(id) ? { kind, id } : null;
  if (kind === 'people') {
    const p = PEOPLES[id];
    return p && { kind, id, name: p.name, capital: p.capital.name, land: p.landName, cities: p.cities.slice(0, 6), ...PEOPLE_NOTES[id] };
  }
  if (kind === 'city') {
    const home = CITY_HOME.get(id);
    return home && { kind, id, name: id, ...home, people: PEOPLES[home.peopleId].name };
  }
  if (kind === 'tech') {
    const t = TECH_TREE[id];
    if (!t) return null;
    const leadsTo = Object.values(TECH_TREE).filter((x) => x.prerequisites.includes(id)).map((x) => ({ id: x.id, name: x.name }));
    return { kind, id, name: t.name, category: t.category, ageId: t.ageId, effects: t.effects, prerequisites: t.prerequisites.map((r) => ({ id: r, name: TECH_TREE[r].name })), leadsTo, boost: BOOSTS[id]?.label || null };
  }
  if (kind === 'unit') {
    const [ageId, classId] = String(id).split('_');
    const u = UNIT_ROSTER[ageId]?.[classId];
    return u && { kind, id, name: u.name, ageId, classId, role: UNIT_CLASSES[classId]?.role, attack: u.baseAttack, defense: u.baseDefense, needsTech: UNIT_UNLOCKS[ageId]?.[classId] || null };
  }
  if (kind === 'building') {
    const [categoryId, i] = String(id).split('.');
    const tier = BUILDING_CATEGORIES[categoryId]?.tiers[Number(i)];
    return tier ? { kind, id, name: tier.name, categoryId, categoryLabel: BUILDING_CATEGORIES[categoryId].label, tierIndex: Number(i), ageId: tier.age, requiresTech: tier.requiresTech || null } : null;
  }
  if (kind === 'resource') {
    const r = RESOURCES_ON_TILES[id];
    return r ? { kind, id, name: id, type: r.kind, yields: r.yields, improvement: r.improvement, knownTech: RESOURCE_KNOWN_FROM_TECH[id] || null, knownAge: RESOURCE_KNOWN_FROM_AGE[id] || null } : null;
  }
  if (kind === 'improvement') {
    const m = IMPROVEMENTS[id];
    return m ? { kind, id, name: m.name, turns: m.turns, requiresTech: m.requiresTech || null, yields: m.yields, resources: Object.keys(RESOURCES_ON_TILES).filter((r) => RESOURCES_ON_TILES[r].improvement === id), upgrades: Object.keys(m.upgrades || {}) } : null;
  }
  return null;
};
