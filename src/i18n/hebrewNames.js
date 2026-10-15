// src/i18n/hebrewNames.js
// Hebrew spellings of proper names (user ruling, 14 October: in Hebrew every name is written in
// Hebrew letters, never mixed). A reviewed table for the 50 major peoples and their capitals; any
// other name goes through transliterate() in names.js, so it is still Hebrew. The table is the
// starting set: phase H4b adds every people, city, ruler, general, battle and river.

// By people id (src/data/peoples.js).
import { HE_PEOPLES_MORE, HE_CITIES_MORE } from './locales/data/he.names';

const MAJOR_PEOPLES = Object.freeze({
  israel: 'ישראל', akkad: 'אכד', elam: 'עילם', pontus: 'פונטוס', saba: 'שבא',
  kemet: 'כמת', kerma: 'כרמה', numidia: 'נומידיה', garamantes: 'גרמנטס',
  ahhiyawa: 'אחיאווה', rasenna: 'ראסנה', tartessos: 'טרטסוס', arverni: 'ארברני', brigantes: 'בריגנטס',
  geats: 'גאטס', dacia: 'דקיה', khazaria: 'כוזריה',
  bactria: 'בקטריה', gokturk: 'גוקטורק', yarlung: 'יארלונג', wusun: 'ווסון',
  meluhha: 'מלוחה', magadha: 'מגדה', pandya: 'פנדיה', satavahana: 'סטוואהנה',
  shang: 'שאנג', shu: 'שו', nanyue: 'ננייה', gojoseon: "גוג'וסון", yamatai: 'יאמאטאי',
  van_lang: 'ואן לאנג', funan: 'פונן', pyu: 'פיו', srivijaya: "סריוויג'איה",
  wagadu: 'וגדו', nok: 'נוק', d_mt: 'דמט', kitara: 'קיטרה', kilwa: 'קילווה', mapungubwe: 'מפונגובווה', ndongo: 'נדונגו',
  teotihuacan: 'טאוטיוואקאן', mutal: 'מוטל', hopewell: 'הופוול', chaco: "צ'אקו", muisca: 'מויסקה',
  caral: 'קראל', tiwanaku: 'טיוואנאקו', tupinamba: 'טופינמבה', gunditjmara: "גונדיצ'מרה"
});

export const HE_PEOPLES = Object.freeze({ ...HE_PEOPLES_MORE, ...MAJOR_PEOPLES });

// By the English city name (the capitals of the 50 majors, and the rest in locales/data/he.names.js).
const MAJOR_CITIES = Object.freeze({
  'Jerusalem': 'ירושלים', 'Kish': 'כיש', 'Anshan': 'אנשאן', 'Sinope': 'סינופה', 'Maryab': 'מריאב',
  'Men-nefer': 'מן-נפר', 'Kerma': 'כרמה', 'Cirta': 'קירטה', 'Garama': 'גראמה',
  'Mycenae': 'מיקנה', 'Velzna': 'וולזנה', 'Tartessos': 'טרטסוס', 'Gergovia': 'גרגוביה', 'Stanwick': 'סטנוויק',
  'Skara': 'סקארה', 'Sarmizegetusa': 'סרמיזגטוסה', 'Atil': 'אטיל',
  'Bactra': 'בקטרה', 'Ötüken': 'אוטוקן', 'Yumbulagang': 'יומבולאגאנג', 'Chigu': "צ'יגו",
  'Harappa': 'הרפה', 'Rajagriha': "רג'גריהה", 'Madurai': 'מדורי', 'Pratishthana': 'פרטישטהנה',
  'Yin': 'יין', 'Sanxingdui': 'סאנשינגדוי', 'Panyu': 'פאניו', 'Wanggeom-seong': 'וואנגגום-סונג', 'Makimuku': 'מאקימוקו',
  'Phong Chau': "פונג צ'או", 'Vyadhapura': 'וייאדהפורה', 'Sri Ksetra': 'סרי קשטרה', 'Palembang': 'פלמבאנג',
  'Koumbi Saleh': 'קומבי סאלח', 'Nok': 'נוק', 'Bigo': 'ביגו', 'Kilwa Kisiwani': 'קילווה קיסיוואני',
  'Mapungubwe Hill': 'גבעת מפונגובווה', 'Kabasa': 'קבאסה',
  'Teotihuacan': 'טאוטיוואקאן', 'Mutal': 'מוטל', 'Chillicothe': "צ'יליקות'י", 'Pueblo Bonito': 'פואבלו בוניטו',
  'Bacatá': 'בקטה', 'Yeha': 'ייהא', 'Caral': 'קראל', 'Tiwanaku': 'טיוואנאקו', 'Guanabara': 'גואנבארה', 'Budj Bim': "בודג' בים"
});

export const HE_CITIES = Object.freeze({ ...HE_CITIES_MORE, ...MAJOR_CITIES });

// Words that come before a name in English titles: "Kingdom of Israel" -> "ממלכת ישראל".
export const HE_TITLE_WORDS = Object.freeze({
  'kingdom of': 'ממלכת', 'empire of': 'אימפריית', 'republic of': 'רפובליקת', 'league of': 'ברית', 'the': ''
});
