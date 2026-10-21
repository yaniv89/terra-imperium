// src/i18n/locales/data/he.ambitions.js
// Hebrew for the ambitions (differentiation plan U13): ambition.<id> for the templates in
// src/data/ambitions.js and for each people's historical ambition (flavour from its row in
// src/data/ambitionsByPeople.js, the rule from HE_RULES here, sized as in English).
import { AMBITION_ROWS, ambitionRule } from '../../../data/ambitionsByPeople';

const HE_RULES = {
  realm: (n) => `להוסיף ${n} ערים`,
  grow: (n) => `לגדל עיר לגודל ${n}`,
  harbour: (n) => `לבנות נמל ולהוסיף ${n} ערים`,
  seaTrade: (n) => `לבנות נמל ולצבור ${n} סוגי משאבים חדשים`,
  river: (n) => `להחזיק עיר על נהר ולהוסיף ${n} ערים`,
  highlands: (n) => `להחזיק גבעות ולהוסיף ${n} ערים`,
  woods: (n) => `להחזיק יער ולהוסיף ${n} ערים`,
  caravans: (n) => `לצבור ${n} סוגי משאבים חדשים ולהוסיף עיר`,
  harvest: (n) => `לצבור ${n} סוגי משאבים חדשים`,
  victories: (n) => `לנצח ב-${n} קרבות`,
  conquest: (n) => (n > 1 ? `לכבוש ${n} ערים בכוח` : 'לכבוש עיר בכוח'),
  scholars: (n) => `ללמוד ${n} תגליות`,
  wonder: (n) => (n > 1 ? `לבנות ${n} פלאים` : 'לבנות פלא')
};

export default Object.freeze({
  'ambition.twoCities': 'לשלוט ב-2 ערים',
  'ambition.threeCities': 'לשלוט ב-3 ערים',
  'ambition.fiveCities': 'לשלוט ב-5 ערים',
  'ambition.foundTwo': 'להוסיף 2 ערים',
  'ambition.addCities': 'להוסיף 3 ערים',
  'ambition.gatherers': 'לצבור 2 סוגי משאבים חדשים',
  'ambition.wideRealm': 'לצבור 3 סוגי משאבים חדשים',
  'ambition.lore': 'ללמוד 3 תגליות',
  'ambition.scholars': 'ללמוד 6 תגליות',
  'ambition.deepLore': 'ללמוד 8 תגליות',
  'ambition.growVillage': 'להגדיל את העיר הגדולה ב-2',
  'ambition.greatCity': 'לגדל עיר לגודל 8',
  'ambition.metropolis': 'לגדל עיר לגודל 12',
  'ambition.bigGrowth': 'להגדיל את העיר הגדולה ב-4',
  'ambition.wonder': 'לבנות פלא',
  'ambition.veterans': 'לנצח ב-5 קרבות',
  'ambition.conquest': 'לכבוש עיר בכוח',
  ...Object.fromEntries(AMBITION_ROWS.map((row) => [`ambition.${row[0]}Ambition`, `${row[3]}: ${HE_RULES[row[1]](ambitionRule(row).n)}`]))
});
