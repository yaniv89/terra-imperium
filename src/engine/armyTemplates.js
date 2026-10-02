// src/engine/armyTemplates.js
// Army templates (plans/civ-map-rework.md, D4; workstream 5). The player names a composition
// ("Legion: 2 infantry, 1 archers, 1 cavalry"; `nation.armyTemplates`, DEFAULT_TEMPLATES until
// they write their own) and queues it in a city as one production item (`{ kind: 'army',
// templateId, name, composition, built }`): the city builds the missing units one by one at
// each class's own cost (cities.js), every unit carries `army: { id, name }` as it appears on
// the city tile, and the order leaves the queue when the last piece is done. Pure.
import { getAvailableClasses, UNIT_CLASSES } from '../data/unitClasses';

export const DEFAULT_TEMPLATES = [
  { id: 'tpl_legion', name: 'Legion', composition: { infantry: 2, ranged: 1, cavalry: 1 } },
  { id: 'tpl_siege_train', name: 'Siege train', composition: { infantry: 2, siege: 1 } }
];
export const TEMPLATE_MAX_UNITS = 12;

export const templatesOf = (nation) => nation?.armyTemplates || DEFAULT_TEMPLATES;
export const templateSize = (composition) => Object.values(composition || {}).reduce((s, n) => s + Math.max(0, n | 0), 0);

/** The classes of a composition in build order: the line first, then the rest by the class table. */
export const templateUnits = (composition) => Object.keys(UNIT_CLASSES).flatMap((classId) => Array.from({ length: Math.max(0, composition?.[classId] | 0) }, () => classId));

/** The next class an army order needs, or null when it is complete. */
export const nextTemplateUnit = (item) => {
  const built = item.built || {};
  const counts = {};
  return templateUnits(item.composition).find((classId) => { counts[classId] = (counts[classId] || 0) + 1; return counts[classId] > (built[classId] || 0); }) || null;
};
export const templateProgress = (item) => ({ done: templateSize(item.built), total: templateSize(item.composition) });

/** Is this template a valid order in the age? */
export const validateTemplate = (template, ageId) => {
  const comp = template?.composition || {};
  const size = templateSize(comp);
  if (!template?.name?.trim()) return { ok: false, reason: 'An army needs a name.' };
  if (size < 1) return { ok: false, reason: 'An army needs at least one unit.' };
  if (size > TEMPLATE_MAX_UNITS) return { ok: false, reason: `At most ${TEMPLATE_MAX_UNITS} units.` };
  const available = new Set(getAvailableClasses(ageId));
  const missing = Object.keys(comp).filter((c) => (comp[c] | 0) > 0 && !available.has(c));
  if (missing.length) return { ok: false, reason: `${missing.map((c) => UNIT_CLASSES[c]?.name || c).join(', ')} not available in this age.` };
  return { ok: true };
};

/** The production item for a template, ordered in `city` at `turn`. */
export const armyOrder = (template, city, turn) => ({ kind: 'army', templateId: template.id, armyId: `army_${city.id}_${turn}_${template.id}`, name: template.name, composition: { ...template.composition }, built: {} });

/** The nation with `template` saved (a new id when it has none). */
export const saveTemplate = (nation, template, turn) => {
  const list = templatesOf(nation);
  const id = template.id || `tpl_${turn}_${list.length}`;
  const next = { id, name: template.name.trim(), composition: Object.fromEntries(Object.entries(template.composition || {}).filter(([, n]) => (n | 0) > 0).map(([c, n]) => [c, n | 0])) };
  const exists = list.some((t) => t.id === id);
  return { ...nation, armyTemplates: exists ? list.map((t) => (t.id === id ? next : t)) : [...list, next] };
};
export const deleteTemplate = (nation, id) => ({ ...nation, armyTemplates: templatesOf(nation).filter((t) => t.id !== id) });
