// src/data/ambitionsByPeople.js
// One historical ambition per people (differentiation plan KTD8, U13), offered only in its peak age: the
// age of its signature unit (src/data/signatureUnits.js). Each row is a flavour line and a recipe;
// the recipe gives the rule and its size for that age, so a goal asks for more in a later age.
//   AMBITION_ROWS: [peopleId, recipe, English flavour, Hebrew flavour, size override?]
//   HISTORICAL_AMBITIONS: { [peopleId]: { id, label, requires } }   requires: a predicate (src/engine/predicates.js)
// Label: "<flavour>: <rule>". Hebrew: `ambition.<id>` in src/i18n/locales/data/he.ambitions.js (the
// flavour from the row, the rule from HE_RULES there). Lines name no battle and no living conflict.
import { SIGNATURE_UNITS } from './signatureUnits';

const TIERS = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
const by = (a) => (t) => a[t];

/** A recipe: a size per tier (bronze to modern), the English rule and the predicate for a size n. */
export const AMBITION_RECIPES = {
  // Gains count from the turn of the offer, so none is met at once.
  realm: { size: by([3, 3, 4, 4, 5]), rule: (n) => `add ${n} cities`, requires: (n) => ({ fact: 'cities', min: n, gain: true }) },
  grow: { size: by([5, 7, 9, 11, 14]), rule: (n) => `grow a city to size ${n}`, requires: (n) => ({ fact: 'maxSize', min: n }) },
  harbour: { size: by([2, 2, 3, 3, 3]), rule: (n) => `build a harbour and add ${n} cities`, requires: (n) => ({ all: [{ fact: 'coastal' }, { fact: 'harbour' }, { fact: 'cities', min: n, gain: true }] }) },
  seaTrade: { size: by([2, 2, 3, 3, 3]), rule: (n) => `build a harbour and gain ${n} new kinds of resource`, requires: (n) => ({ all: [{ fact: 'coastal' }, { fact: 'harbour' }, { fact: 'resources', min: n, gain: true }] }) },
  river: { size: by([2, 2, 3, 3, 3]), rule: (n) => `hold a river city and add ${n} cities`, requires: (n) => ({ all: [{ fact: 'river' }, { fact: 'cities', min: n, gain: true }] }) },
  highlands: { size: by([2, 2, 3, 3, 3]), rule: (n) => `hold hills and add ${n} cities`, requires: (n) => ({ all: [{ fact: 'hills' }, { fact: 'cities', min: n, gain: true }] }) },
  woods: { size: by([2, 2, 3, 3, 3]), rule: (n) => `hold forest and add ${n} cities`, requires: (n) => ({ all: [{ fact: 'forest' }, { fact: 'cities', min: n, gain: true }] }) },
  caravans: { size: by([2, 3, 3, 4, 4]), rule: (n) => `gain ${n} new kinds of resource and add a city`, requires: (n) => ({ all: [{ fact: 'resources', min: n, gain: true }, { fact: 'cities', gain: true }] }) },
  harvest: { size: by([2, 3, 3, 4, 4]), rule: (n) => `gain ${n} new kinds of resource`, requires: (n) => ({ fact: 'resources', min: n, gain: true }) },
  victories: { size: by([2, 3, 3, 4, 5]), rule: (n) => `win ${n} battles`, requires: (n) => ({ fact: 'battlesWon', min: n, gain: true }) },
  conquest: { size: by([1, 1, 1, 1, 2]), rule: (n) => (n > 1 ? `take ${n} cities by force` : 'take a city by force'), requires: (n) => ({ fact: 'citiesTaken', min: n }) },
  scholars: { size: by([3, 4, 5, 6, 8]), rule: (n) => `learn ${n} discoveries`, requires: (n) => ({ fact: 'techs', min: n, gain: true }) },
  wonder: { size: by([1, 1, 1, 1, 2]), rule: (n) => (n > 1 ? `build ${n} wonders` : 'build a wonder'), requires: (n) => ({ fact: 'wonders', min: n, gain: true }) }
};

export const AMBITION_ROWS = [
  // Near East
  ['israel', 'highlands', 'Hold the hill country', 'להחזיק את ארץ ההרים'],
  ['ugarit', 'seaTrade', 'Make the harbour a market for all the coast', 'להפוך את הנמל לשוק של כל החוף'],
  ['mari', 'river', 'Command the river road between the cities', 'לשלוט בדרך הנהר שבין הערים'],
  ['akkad', 'realm', 'Unite the land of Sumer and Akkad', 'לאחד את ארץ שומר ואכד', 4],
  ['elam', 'highlands', 'Hold the highland roads', 'להחזיק את דרכי ההרים'],
  ['media', 'highlands', 'Hold the mountain passes of the horse country', 'להחזיק את מעברי ההרים של ארץ הסוסים'],
  ['kanesh', 'caravans', 'Open the caravan road', 'לפתוח את דרך השיירות'],
  ['lydia', 'caravans', 'Mint wealth from the river gold', 'להטביע עושר מזהב הנהר'],
  ['phrygia', 'highlands', 'Raise a kingdom on the high plateau', 'להקים ממלכה על הרמה הגבוהה'],
  ['pontus', 'harbour', 'Rule the Black Sea coast', 'לשלוט בחוף הים השחור'],
  ['urartu', 'highlands', 'Fortify the mountain heartland', 'לבצר את לב ארץ ההרים'],
  ['colchis', 'woods', 'Hold the forested valleys by the sea', 'להחזיק את העמקים המיוערים שליד הים'],
  ['aghvank', 'highlands', 'Guard the valleys of the mountain land', 'לשמור על עמקי ארץ ההרים'],
  ['saba', 'caravans', 'Make the incense road rich', 'להעשיר את דרך הלבונה'],
  ['kindah', 'realm', 'Unite the desert tribes under one banner', 'לאחד את שבטי המדבר תחת דגל אחד'],
  ['magan', 'harbour', 'Ship copper over the gulf', 'להפליג עם נחושת על פני המפרץ'],
  ['dilmun', 'seaTrade', 'Make the island the market of the gulf', 'להפוך את האי לשוק המפרץ'],
  ['qedar', 'caravans', 'Command the desert trade routes', 'לשלוט בדרכי הסחר במדבר'],
  ['nabataea', 'caravans', 'Turn the desert road into a fortune', 'להפוך את דרך המדבר להון'],
  // North Africa
  ['kemet', 'wonder', 'Raise a monument to last forever', 'להקים אנדרטה שתעמוד לנצח'],
  ['kerma', 'river', 'Hold the Nile above the cataracts', 'להחזיק את הנילוס שמעל המפלים'],
  ['alodia', 'scholars', 'Keep faith and learning alive along the Nile', 'לשמר אמונה ולימוד לאורך הנילוס'],
  ['libu', 'victories', 'Defend the western frontier', 'להגן על הגבול המערבי'],
  ['cyrene', 'grow', 'Raise a city of learning and horses', 'להקים עיר של לימוד וסוסים'],
  ['garamantes', 'harvest', 'Bring water and harvest to the oases', 'להביא מים ויבול אל הנאות'],
  ['numidia', 'victories', 'Ride out and win on the open plains', 'לצאת על סוסים ולנצח במישורים הפתוחים'],
  ['mauretania', 'seaTrade', 'Open the western coast to trade', 'לפתוח את החוף המערבי לסחר'],
  // Europe
  ['keftiu', 'seaTrade', 'Rule the sea from the island palaces', 'לשלוט בים מארמונות האי'],
  ['ahhiyawa', 'highlands', 'Hold the hilltop citadels', 'להחזיק את מצודות ראשי הגבעות'],
  ['odrysia', 'realm', 'Unite the Thracian lands', 'לאחד את ארצות תרקיה'],
  ['illyria', 'highlands', 'Hold the mountain homeland', 'להחזיק את מולדת ההרים'],
  ['dacia', 'highlands', 'Guard the passes of the mountain arc', 'לשמור על המעברים של קשת ההרים'],
  ['rasenna', 'seaTrade', 'Trade from a league of coastal cities', 'לסחור מליגה של ערי חוף'],
  ['nuragi', 'harbour', 'Hold the island and its coasts', 'להחזיק את האי ואת חופיו'],
  ['tartessos', 'caravans', 'Trade in silver and tin from the western rivers', 'לסחור בכסף ובבדיל מנהרות המערב'],
  ['celtiberia', 'highlands', 'Defend the high country, town by town', 'להגן על הרמה, עיר אחר עיר'],
  ['lusitania', 'seaTrade', 'Sail out from the Atlantic coast', 'להפליג מחוף האוקיינוס'],
  ['arverni', 'realm', 'Unite the tribes of the high country', 'לאחד את שבטי הרמה'],
  ['belgae', 'woods', 'Hold the forest and the fields of the north', 'להחזיק את היער והשדות שבצפון'],
  ['noricum', 'highlands', 'Open the mountain passes', 'לפתוח את מעברי ההרים'],
  ['marcomannia', 'grow', 'Build the great city of the heartland', 'לבנות את העיר הגדולה של לב היבשת'],
  ['cherusci', 'woods', 'Make the forest your fortress', 'להפוך את היער למבצר'],
  ['durotriges', 'highlands', 'Raise hillforts that none can take', 'להקים מצודות גבעה שאיש לא יכבוש'],
  ['brigantes', 'highlands', 'Hold the northern hills', 'להחזיק את הגבעות שבצפון'],
  ['ulaid', 'realm', 'Unite the north of the island', 'לאחד את צפון האי'],
  ['fortriu', 'highlands', 'Hold the glens and the highlands', 'להחזיק את העמקים ואת ההרים'],
  ['geats', 'seaTrade', 'Sail the northern sea', 'להפליג בים הצפוני'],
  ['rygir', 'harbour', 'Build harbours along the fjords', 'לבנות נמלים לאורך הפיורדים'],
  ['bosporan_kingdom', 'seaTrade', 'Feed the sea cities with grain', 'להאכיל את ערי הים בתבואה'],
  ['cucuteni', 'grow', 'Build a great town of clay houses', 'לבנות עיירה גדולה של בתי חימר'],
  ['avaria', 'victories', 'Ride out of the plain and make a name', 'לצאת מהמישור ולהקים שם'],
  ['khazaria', 'caravans', 'Hold the roads between the sea and the steppe', 'להחזיק את הדרכים שבין הים לערבה'],
  ['sarmatians', 'victories', 'Win a name for the winged horsemen', 'להקנות שם לפרשים בעלי הכנפיים'],
  // Central Asia
  ['oxus', 'river', 'Water the oasis cities', 'להשקות את ערי הנווה'],
  ['parthava', 'victories', 'Win battles from the saddle', 'לנצח בקרבות מגב הסוס'],
  ['bactria', 'caravans', 'Grow rich between the mountains and the river', 'להתעשר בין ההרים לנהר'],
  ['sogdia', 'caravans', 'Make the silk road merchants rich', 'להעשיר את סוחרי דרך המשי'],
  ['khwarazm', 'river', 'Rule the lands of the great rivers', 'לשלוט בארצות הנהרות הגדולים'],
  ['wusun', 'realm', 'Unite the herders of the valleys', 'לאחד את רועי העמקים'],
  ['andronovo', 'realm', 'Spread the herding clans across the steppe', 'להפיץ את חמולות הרועים ברחבי הערבה'],
  ['botai', 'harvest', 'Tame the herds of the open steppe', 'לביית את עדרי הערבה הפתוחה'],
  ['gokturk', 'realm', 'Unite the tribes of the steppe under one khan', 'לאחד את שבטי הערבה תחת ח׳אן אחד'],
  ['xianbei', 'conquest', 'Rise from the grass and take the walled cities', 'לקום מן העשב ולכבוש ערים מוקפות חומה'],
  ['kroraina', 'caravans', 'Keep the oasis road open', 'לשמור על דרך הנווה פתוחה'],
  ['khotan', 'caravans', 'Trade jade and silk from the oasis', 'לסחור בירקן ובמשי מהנווה'],
  ['zhangzhung', 'highlands', 'Hold the high plateau', 'להחזיק את הרמה הגבוהה'],
  ['yarlung', 'realm', 'Unite the valleys of the plateau in one kingdom', 'לאחד את עמקי הרמה בממלכה אחת'],
  // South Asia
  ['meluhha', 'river', 'Build cities on the great river', 'לבנות ערים על הנהר הגדול'],
  ['gandhara', 'highlands', 'Hold the passes between the plains and the hills', 'להחזיק את המעברים שבין המישור להרים'],
  ['saurashtra', 'seaTrade', 'Sail out from the western coast', 'להפליג מהחוף המערבי'],
  ['kuru', 'realm', 'Rule the plains of the sacred rivers', 'לשלוט במישורי הנהרות הקדושים'],
  ['kosala', 'river', 'Hold the river kingdom', 'להחזיק את ממלכת הנהר'],
  ['magadha', 'realm', 'Unite the river plains under one throne', 'לאחד את מישורי הנהר תחת כס אחד'],
  ['avanti', 'caravans', 'Make the crossroads rich', 'להעשיר את פרשת הדרכים'],
  ['kalinga', 'seaTrade', 'Sail east from the proud coast', 'להפליג מזרחה מהחוף הגאה'],
  ['satavahana', 'caravans', 'Join the sea trade to the inland roads', 'לחבר את סחר הים לדרכי הפנים'],
  ['pandya', 'seaTrade', 'Trade pearls with the world', 'לסחור בפנינים עם העולם'],
  ['rajarata', 'grow', 'Feed a great city from the rain tanks', 'להאכיל עיר גדולה ממאגרי הגשם'],
  ['kamarupa', 'river', 'Hold the great river valley', 'להחזיק את עמק הנהר הגדול'],
  ['vanga', 'seaTrade', 'Sail out from the river delta', 'להפליג מדלתת הנהר'],
  // East Asia
  ['shang', 'grow', 'Raise a great ritual city', 'להקים עיר טקסים גדולה'],
  ['zhou', 'realm', 'Hold the realm by ties of loyalty', 'להחזיק את הממלכה בקשרי נאמנות'],
  ['chu', 'river', 'Rule the lands along the great river', 'לשלוט בארצות לאורך הנהר הגדול'],
  ['shu', 'highlands', 'Raise a kingdom in the mountain basin', 'להקים ממלכה באגן ההרים'],
  ['qi', 'seaTrade', 'Prosper from salt and sea', 'לשגשג ממלח ומים'],
  ['yue', 'seaTrade', 'Sail the southern coast', 'להפליג בחוף הדרומי'],
  ['dian', 'highlands', 'Hold the lake plateau', 'להחזיק את רמת האגם'],
  ['nanyue', 'seaTrade', 'Trade from the southern harbours', 'לסחור מנמלי הדרום'],
  ['buyeo', 'realm', 'Unite the horse lords of the north', 'לאחד את אדוני הסוסים שבצפון'],
  ['gojoseon', 'realm', 'Unite the clans of the peninsula', 'לאחד את חמולות חצי האי'],
  ['baekje', 'seaTrade', 'Carry learning and trade over the sea', 'לשאת לימוד וסחר מעבר לים'],
  ['yamatai', 'realm', 'Unite the islands under one queen', 'לאחד את האיים תחת מלכה אחת'],
  ['emishi', 'victories', 'Defend the northern homeland', 'להגן על מולדת הצפון'],
  // Southeast Asia
  ['van_lang', 'river', 'Plant the river valley with rice', 'לנטוע אורז בעמק הנהר'],
  ['champa', 'seaTrade', 'Rule the ports of the eastern sea', 'לשלוט בנמלי הים המזרחי'],
  ['funan', 'seaTrade', 'Make the delta ports a crossroads of the sea', 'להפוך את נמלי הדלתה לצומת ימי'],
  ['pyu', 'river', 'Rule the walled cities of the river', 'לשלוט בערי החומה שעל הנהר'],
  ['dvaravati', 'caravans', 'Build moated cities of faith and trade', 'לבנות ערים מוקפות חפיר של אמונה וסחר'],
  ['srivijaya', 'seaTrade', 'Rule the straits', 'לשלוט במיצרים'],
  ['tarumanagara', 'river', 'Tame the rivers of the island', 'לאלף את נהרות האי'],
  ['medang', 'wonder', 'Raise a temple that outlives its kings', 'להקים מקדש שיחיה יותר ממלכיו'],
  ['kutai', 'woods', 'Rule the river of the forest', 'לשלוט בנהר היער'],
  ['butuan', 'caravans', 'Trade gold across the islands', 'לסחור בזהב בין האיים'],
  ['tondo', 'seaTrade', 'Make the bay a market', 'להפוך את המפרץ לשוק'],
  // Africa
  ['tichitt', 'highlands', 'Gather the people in stone villages on the cliff', 'לאסוף את העם בכפרי אבן על המצוק'],
  ['wagadu', 'caravans', 'Hold the gold and salt roads', 'להחזיק את דרכי הזהב והמלח'],
  ['djenne_djeno', 'river', 'Raise a city among the river floods', 'להקים עיר בין שיטפונות הנהר'],
  ['kanem', 'caravans', 'Command the desert road', 'לשלוט בדרך המדבר'],
  ['nok', 'woods', 'Work iron in the forest', 'לעבד ברזל ביער'],
  ['ife', 'grow', 'Raise a sacred city', 'להקים עיר קדושה'],
  ['bono', 'caravans', 'Trade gold from the forest to the coast', 'לסחור בזהב מהיער אל החוף'],
  ['punt', 'seaTrade', 'Send ships for incense and gold', 'לשלוח ספינות ללבונה ולזהב'],
  ['ajuran', 'seaTrade', 'Rule the coast of the eastern sea', 'לשלוט בחוף הים המזרחי'],
  ['kilwa', 'seaTrade', 'Make the island the port of gold', 'להפוך את האי לנמל הזהב'],
  ['kitara', 'realm', 'Unite the lake lands', 'לאחד את ארצות האגמים'],
  ['engaruka', 'harvest', 'Farm the terraced valley', 'לעבד את העמק המדורג'],
  ['luba', 'realm', 'Bind the lands by the memory of the elders', 'לקשור את הארצות בזיכרון הזקנים'],
  ['lunda', 'realm', 'Link the chiefs of the rivers', 'לקשור את ראשי הנהרות'],
  ['ndongo', 'river', 'Hold the river kingdom', 'להחזיק את ממלכת הנהר'],
  ['mapungubwe', 'caravans', 'Trade gold from the hill capital', 'לסחור בזהב מבירת הגבעה'],
  ['mutapa', 'caravans', 'Trade the gold of the plateau', 'לסחור בזהב הרמה'],
  ['merina', 'highlands', 'Rule the highlands of the island', 'לשלוט ברמות האי'],
  ['khoekhoe', 'harvest', 'Drive the herds across the plains', 'להוביל את העדרים על פני המישורים'],
  ['san', 'harvest', 'Know every plant and every path', 'להכיר כל צמח וכל שביל'],
  ['d_mt', 'highlands', 'Hold the highland home', 'להחזיק את בית ההרים'],
  // Americas
  ['caral', 'wonder', 'Raise the great platforms', 'להקים את הבמות הגדולות'],
  ['moche', 'wonder', 'Raise temples of adobe', 'להקים מקדשים מלבני בוץ'],
  ['wari', 'highlands', 'Link the highlands under one rule', 'לחבר את הרמות תחת שלטון אחד'],
  ['tiwanaku', 'highlands', 'Raise a city at the roof of the world', 'להקים עיר בגג העולם'],
  ['diaguita', 'highlands', 'Hold the valley fortresses', 'להחזיק את מצודות העמקים'],
  ['muisca', 'caravans', 'Gather gold and salt for the lake offerings', 'לאסוף זהב ומלח למנחות האגם'],
  ['marajoara', 'river', 'Raise mounds at the river mouth', 'להקים תלים בשפך הנהר'],
  ['tupinamba', 'woods', 'Hold the forest coast', 'להחזיק את חוף היער'],
  ['jaragua', 'harbour', 'Hold the western coast of the island', 'להחזיק את החוף המערבי של האי'],
  ['kalinago', 'harbour', 'Sail between the islands', 'להפליג בין האיים'],
  ['teotihuacan', 'grow', 'Raise the greatest city of the valley', 'להקים את העיר הגדולה בעמק'],
  ['zapotec', 'highlands', 'Raise a capital on the mountaintop', 'להקים בירה על ראש ההר'],
  ['mutal', 'realm', 'Lead the lowland city kingdoms', 'להנהיג את ממלכות הערים שבשפלה'],
  ['hopewell', 'river', 'Raise earthworks along the rivers', 'להקים סוללות עפר לאורך הנהרות'],
  ['hohokam', 'river', 'Dig canals in the desert', 'לחפור תעלות במדבר'],
  ['chaco', 'realm', 'Join the great houses of the canyon', 'לחבר את הבתים הגדולים של הקניון'],
  ['calusa', 'harbour', 'Rule the shell-built coast', 'לשלוט בחוף שנבנה מצדפים'],
  ['haida', 'seaTrade', 'Trade from the island coast', 'לסחור מחוף האי'],
  ['dorset', 'harbour', 'Hold the far northern coast', 'להחזיק את החוף הצפוני הרחוק'],
  // Oceania
  ['lapita', 'harbour', 'Cross the sea in canoes', 'לחצות את הים בקאנו'],
  ['wahgi', 'highlands', 'Farm the highland valleys', 'לעבד את עמקי הרמה'],
  ['gunditjmara', 'river', 'Keep the eel waters in good order', 'לשמור על מימי הצלופחים'],
  ['saudeleur', 'grow', 'Raise a city of stone on the reef', 'להקים עיר אבן על השונית'],
  ['latte_chiefs', 'harbour', 'Raise stone pillars by the sea', 'להקים עמודי אבן ליד הים'],
  ['bau', 'realm', 'Unite the island chiefs', 'לאחד את ראשי האיים']
];

const rowTier = (peopleId) => Math.max(0, TIERS.indexOf(SIGNATURE_UNITS[peopleId]?.ageId));

/** A row's rule: the size for the people's peak age, the English rule and the predicate. */
export const ambitionRule = ([peopleId, recipe, , , size]) => {
  const r = AMBITION_RECIPES[recipe];
  const n = size ?? r.size(rowTier(peopleId));
  return { n, rule: r.rule(n), requires: r.requires(n) };
};

export const HISTORICAL_AMBITIONS = Object.fromEntries(AMBITION_ROWS.map((row) => {
  const { rule, requires } = ambitionRule(row);
  return [row[0], { id: `${row[0]}Ambition`, label: `${row[2]}: ${rule}`, requires }];
}));
