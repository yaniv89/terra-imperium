// src/i18n/gameText.js
// Game data names and descriptions in the current language (phase H4). The English data in
// src/data stays the source: every helper takes the data's own English text and returns it in
// English, or the Hebrew lookup by id (locales/data.he.js) in Hebrew. A missing Hebrew entry shows
// the English text. Pure: reads only the current language of core.js, so view models may call it
// (they rebuild when the language changes). Not for the engine's saved text (log lines, reports).
import { dataText, getLanguage } from './core';
import { nameNow } from './names';

const D = (key, english, vars) => dataText(key, english, vars);

export const techName = (id, english) => D(`tech.${id}`, english ?? id);
export const boostLabel = (techId, english) => D(`boost.${techId}`, english);

export const buildingCategoryLabel = (categoryId, english) => D(`bcat.${categoryId}`, english ?? categoryId);
export const buildingTierName = (categoryId, tierIndex, english) => D(`btier.${categoryId}.${tierIndex}`, english ?? `${categoryId} ${tierIndex + 1}`);
export const extractionName = (resourceId, english) => D(`bext.${resourceId}`, english ?? resourceId);

export const lawName = (id, english) => D(`law.${id}`, english ?? id);
export const lawDescription = (id, english) => D(`law.${id}.desc`, english);
export const governmentName = (id, english) => D(`gov.${id}`, english ?? id);
export const reformName = (id, english) => D(`reform.${id}`, english ?? id);
export const reformDescription = (id, english) => D(`reform.${id}.desc`, english);

export const resourceName = (id, english) => D(`res.${id}`, english ?? id);
export const resourceDescription = (id, english) => D(`res.${id}.desc`, english);

export const wonderName = (id, english) => D(`gp.${id}`, english ?? id);
export const wonderDescription = (id, english) => D(`gp.${id}.desc`, english);

export const achievementName = (id, english) => D(`ach.${id}`, english ?? id);
export const achievementDescription = (id, english) => D(`ach.${id}.desc`, english);
export const doctrineName = (id, english) => D(`doctrine.${id}`, english ?? id);
export const doctrineDescription = (id, english) => D(`doctrine.${id}.desc`, english);

export const playstyleName = (id, english) => D(`playstyle.${id}`, english ?? id);
export const goalUnit = (id, english) => D(`goalunit.${id}`, english);
export const goalNext = (id, english) => D(`goalnext.${id}`, english);
export const goalBonus = (id, english) => D(`goalbonus.${id}`, english);

export const cityStateTypeName = (id, english) => D(`cstype.${id}`, english ?? id);
export const independentKindName = (id, english) => D(`indep.${id}`, english ?? id);
export const independentWhere = (id, english) => D(`indep.${id}.where`, english);
/** "the free city of {city}" and its kin; `form` is the English template, `vars` its {people} / {city}
 * (already in the current language: pass names through nameOf first). */
export const independentForm = (shape, band, english, vars) => D(`indep.form.${shape}.${band}`, english, vars);

export const victoryName = (id, english) => D(`victory.${id}`, english ?? id);
export const victoryDescription = (id, english) => D(`victory.${id}.desc`, english);
export const taxRateName = (id, english) => D(`tax.${id}`, english ?? id);
export const taxRateDescription = (id, english) => D(`tax.${id}.desc`, english);
export const difficultyName = (id, english) => D(`diff.${id}`, english ?? id);
export const difficultyDescription = (id, english) => D(`diff.${id}.desc`, english);
export const identityPole = (axisId, sign, english) => D(`ident.${axisId}.${sign}`, english);
export const identityDescription = (axisId, english) => D(`ident.${axisId}.desc`, english);

export const branchName = (id, english) => D(`branch.${id}`, english ?? id);
export const perkName = (id, english) => D(`perk.${id}`, english ?? id);
export const perkDescription = (id, english) => D(`perk.${id}.desc`, english);
export const personaName = (id, english) => D(`persona.${id}`, english ?? id);
export const personaDescription = (id, english) => D(`persona.${id}.desc`, english);

export const unitClassName = (classId, english) => D(`uclass.${classId}`, english ?? classId);
export const unitClassRole = (classId, english) => D(`uclass.${classId}.role`, english);
/** A ship's name by naval line and age (navalLines.js names, in the current language). */
export const navalShipName = (line, ageId, english) => D(`navalship.${line}.${AGES[ageId] ? ageId : FIRST_AGE_ID}`, english);
export const navalLineLabel = (line, english) => D(`naval.${line}`, english);
export const navalLineRole = (line, english) => D(`naval.${line}.role`, english);
/** The roster's unit for an age and class ("Spearmen"), as unitDisplayName but in the current language.
 * `english` is what data/unitNames.js unitDisplayName gave. */
export const unitRosterName = (ageId, classId, english, navalLine = null) => {
  if (classId === 'naval') return navalShipName(navalLine || 'warship', ageId || FIRST_AGE_ID, english);
  if (classId === 'settler') return D('unit.settler', english);
  return D(`unit.${ageId || FIRST_AGE_ID}.${classId}`, D(`unit.${FIRST_AGE_ID}.${classId}`, english));
};
export const signatureUnitName = (peopleId, english) => D(`sig.${peopleId}`, english);
/** A robot variant's name (unitClasses.js ROBOT_VARIANTS) in the current language. */
export const robotUnitName = (classId) => D(`unit.robot.${classId}`, ROBOT_VARIANTS[classId] || classId);

// Events: historical and chain events by id, procedural ones by templateId. `field` is 'title',
// 'desc' or 'opt<N>'. The English text a template varies on (a granary or not) picks the variant.
const eventKeyBase = (event) => (event?.procedural && event.templateId ? `pevt.${event.templateId}` : `evt.${event?.id}`);
export const eventText = (event, field, english, vars) => {
  const base = `${eventKeyBase(event)}.${field}`;
  const variant = event?.procedural && /granar/i.test(english || '') ? `${base}.granary` : base;
  const v = { ...(vars || {}) };
  if (event?.procedural && event.templateId === 'ambitious_general' && v.general === undefined) v.general = english ? nameNow('person', null, String(english).split(',')[0]) : '';
  return D(variant, D(base, english, v), v);
};
export const eventTitle = (event, vars) => eventText(event, 'title', event?.title, vars);
export const eventDescription = (event, vars) => eventText(event, 'desc', event?.description, vars);
export const eventOptionLabel = (event, index, vars) => eventText(event, `opt${index}`, event?.options?.[index]?.label, vars);

/** A ruler's line: the name (one ruler a game, no house). */
export const rulerLine = (ruler) => nameNow('person', null, ruler.name);
export const currentLanguage = getLanguage;

// Wrappers over the data helpers, so a view can swap one import and keep its call.
import { unitDisplayName } from '../data/unitNames';
import { ROBOT_VARIANTS } from '../data/unitClasses';
import { getCategoryTierName } from '../data/buildings';
import { AGES, FIRST_AGE_ID } from '../data/ages';
/** unitDisplayName (data/unitNames.js) in the current language. */
export const unitName = (ageId, classId, navalLine = null) => unitRosterName(ageId, classId, unitDisplayName(ageId, classId, navalLine), navalLine);
/** getCategoryTierName (data/buildings.js) in the current language. */
export const categoryTierName = (categoryId, tierIndex) => buildingTierName(categoryId, tierIndex, getCategoryTierName(categoryId, tierIndex));
export const improvementName = (id, english) => D(`impr.${id}`, english ?? id);
export const terrainWord = (word) => D(`terrain.${word}`, word);
export const tileResourceName = (id) => D(`tres.${id}`, id);
export const districtName = (id, english) => D(`district.${id}`, english ?? id);
/** A law's effect line: the game's own English sentence in English, the translated description in Hebrew. */
export const lawLine = (law, englishLine) => (getLanguage() === 'he' ? lawDescription(law.id, englishLine || law.description) : (englishLine || law.description));
