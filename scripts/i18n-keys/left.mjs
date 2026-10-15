// Key list for src/i18n/locales/ui/left.*.js: node scripts/i18n-gen-ui.mjs left scripts/i18n-keys/left.mjs
// Engine reasons and sentences (m.*, written by engine/messages.js) and the leftover UI text (bt.* and others).
export default [
  // battleQueue.js queuedCommandBlock
  ['m.q.gone', 'The attackers are gone: there is no one to fight. Auto closes it.', 'התוקפים נעלמו: אין עם מי להילחם. האוטומטי סוגר את זה.'],
  ['m.q.noDefCity', 'No one in {place} to command: no regiment, and no militia without houses. On Auto the attackers strike its defences.', 'אין ב{place} מי שיפקדו עליו: אין גדוד, ואין מיליציה בלי בתים. באוטומטי התוקפים פוגעים בהגנות שלה.'],
  ['m.q.noIntercept', 'None of your fleets can reach the landing fleet: Auto settles it.', 'אף אחד מהצי שלכם לא יכול להגיע לצי הנחיתה: האוטומטי מכריע.'],
  ['m.q.landingOver', 'The landing is over before it started: Auto settles it.', 'הנחיתה נגמרה לפני שהתחילה: האוטומטי מכריע.'],
  ['m.q.noDefLanding', 'No one in {place} to command against the landing: no regiment and no militia. On Auto they come ashore.', 'אין ב{place} מי שיפקדו עליו מול הנחיתה: אין גדוד ואין מיליציה. באוטומטי הם עולים לחוף.'],
  ['m.q.noDefSack', 'No one in the town to command: no regiment and no militia. On Auto the raiders sack it.', 'אין בעיירה מי שיפקדו עליו: אין גדוד ואין מיליציה. באוטומטי הפושטים מבזזים אותה.'],
  ['m.q.raidGone', 'Your troops are no longer there: Auto settles the raid.', 'הכוחות שלכם כבר לא שם: האוטומטי מכריע את הפשיטה.'],
  ['m.q.noMans', "No man's land: a clash outside both peoples' borders is fought on Auto.", 'שטח הפקר: עימות מחוץ לגבולות שני העמים נלחם באוטומטי.'],
  ['m.q.noBattle', 'The armies are no longer in reach of each other: there is no battle to command. Auto closes it.', 'הצבאות כבר לא בטווח זה של זה: אין קרב לפקד עליו. האוטומטי סוגר את זה.'],

  // capture.js options
  ['m.cap.conquer', 'Keep {city}. It starts restless (control {control}%, loyalty {loyalty}).{grace} each unit standing in it holds it better.', 'השאירו את {city}. היא מתחילה נסערת (שליטה {control}%, נאמנות {loyalty}).{grace} כל יחידה שעומדת בה מחזיקה אותה טוב יותר.'],
  ['m.cap.grace', ' It cannot break away for {turns} turns;', ' היא לא יכולה להיפרד במשך {turns} תורות;'],
  ['m.cap.noGrace', ' You took it again so soon: no grace this time;', ' כבשתם אותה שוב כל כך מהר: אין תקופת חסד הפעם;'],
  ['m.cap.raze.one', 'Burn it: one size a turn, gone in {count} turn. It yields nothing meanwhile, and its kin will hold it against you.', 'שרפו אותה: גודל אחד בתור, תיעלם בתוך תור אחד. היא לא מניבה דבר בינתיים, ובני עמה ינטרו לכם.'],
  ['m.cap.raze.two', 'Burn it: one size a turn, gone in {count} turns. It yields nothing meanwhile, and its kin will hold it against you.', 'שרפו אותה: גודל אחד בתור, תיעלם בתוך שני תורות. היא לא מניבה דבר בינתיים, ובני עמה ינטרו לכם.'],
  ['m.cap.raze.other', 'Burn it: one size a turn, gone in {count} turns. It yields nothing meanwhile, and its kin will hold it against you.', 'שרפו אותה: גודל אחד בתור, תיעלם בתוך {count} תורות. היא לא מניבה דבר בינתיים, ובני עמה ינטרו לכם.'],
  ['m.cap.tributary', 'It stands as an independent city that pays you about {gold} gold a turn for {turns} turns, with a truce both ways meanwhile. Your troops step out of it.', 'היא עומדת כעיר עצמאית שמשלמת לכם כ־{gold} זהב בתור במשך {turns} תורות, עם הפוגה לשני הצדדים בינתיים. הכוחות שלכם יוצאים ממנה.'],
  ['m.cap.freeBack', 'Hand it back to {nation}, who founded it.{kindly} Your troops step out of it.', 'החזירו אותה ל{nation}, שהקימו אותה.{kindly} הכוחות שלכם יוצאים ממנה.'],
  ['m.cap.kindly', ' They will remember it kindly.', ' הם יזכרו לכם את זה לטובה.'],
  ['m.cap.freeCity', 'It stands as a free city, friendly to you{grateful}. No tribute. Your troops step out of it.', 'היא עומדת כעיר חופשית, ידידותית אליכם{grateful}. בלי מס. הכוחות שלכם יוצאים ממנה.'],
  ['m.cap.grateful', ' and grateful', ' ומלאת תודה'],

  // why: reasons (engine/messages.js reasonOf)
  ['m.why.capLeave', 'Your troops in it have no city of yours to fall back to.', 'לכוחות שלכם בה אין עיר שלכם לסגת אליה.'],
  ['m.why.capNoIndep', 'This world has no independent cities, so it cannot stand on its own.', 'בעולם הזה אין ערים עצמאיות, ולכן היא לא יכולה לעמוד בכוחות עצמה.'],
  ['m.why.capNoOne', 'Its founders are gone and this world has no free cities: there is no one to hand it to.', 'מקימיה נעלמו ובעולם הזה אין ערים חופשיות: אין למי למסור אותה.'],
  ['m.why.capNotChoice', 'That is not a choice for a captured city.', 'זו לא אפשרות לעיר שנכבשה.'],
  ['m.why.capNoRaze', 'This city cannot be razed.', 'אי אפשר להחריב את העיר הזו.'],
  ['m.why.capNoStand', 'It cannot stand on its own here.', 'היא לא יכולה לעמוד כאן בכוחות עצמה.'],
  ['m.why.razeNotYours', 'Not your city.', 'זו לא העיר שלכם.'],
  ['m.why.razeBurning', 'It is already burning.', 'היא כבר בוערת.'],
  ['m.why.razeOutpost', 'An outpost cannot be razed.', 'אי אפשר להחריב מוצב.'],
  ['m.why.razeForce', 'Only a city taken by force can be razed.', 'אפשר להחריב רק עיר שנכבשה בכוח.'],
  ['m.why.razeCapital', 'Your capital cannot be razed.', 'אי אפשר להחריב את הבירה שלכם.'],
  ['m.why.razeLast', 'It is your last city.', 'זו העיר האחרונה שלכם.'],
  ['m.why.razeWonder', 'A wonder stands in it.', 'עומד בה פלא.']
];
