# Hebrew review

4 lines to look at, most serious first (3 confusing or broken, 2 worth fixing, 1 polish).
Every chunk was reviewed.

| Sev | Problem | Key | English | Hebrew now | Suggested | Why |
|---|---|---|---|---|---|---|
| 2 | unnatural | `start.diff.emperor.desc` | AI nations get +50% resources and are ruthless: optimal counter-building, coordinated wars. | עמי המחשב מקבלים 50%+ משאבים ואכזריים: בנייה נגדית מושלמת ומלחמות מתואמות. | עמי המחשב מקבלים בונוס של 50% במשאבים ואכזריים: בנייה נגדית מושלמת ומלחמות מתואמות. | The '50%+' notation is machine-like; a Hebrew game would say 'בונוס של 50%' in words. |
| 2 | unnatural | `start.diff.settler.desc` | AI nations are passive and rarely declare war. You start with +50% resources, AI with -25%. | עמי המחשב פסיביים ונדיר שיכריזו מלחמה. אתם מתחילים עם 50%+ משאבים, והמחשב עם 25%-. | עמי המחשב פסיביים ונדיר שיכריזו מלחמה. אתם מתחילים עם בונוס של 50% במשאבים, והמחשב עם עונש של 25%. | The notation '50%+' and '25%-' reads like a spreadsheet, not game text. Spelling out the bonus and penalty is clearer. |
| 1 | wrong | `start.csLine` | Up to {n} one-city peoples, each {km} km or more from every start. Trade, military, science and culture cities reward the people they favour; a third at most are raiders. | עד {n} עמים בני עיר אחת, כל אחד במרחק {km} ק״מ או יותר מכל התחלה. ערים של מסחר, צבא, מדע ותרבות מתגמלות את העם שהן מעדיפות; שליש לכל היותר הן שודדים. | עד {n} עמים בני עיר אחת, כל אחד במרחק {km} ק״מ או יותר מכל התחלה. ערים של מסחר, צבא, מדע ותרבות מתגמלות את העם שהן מעדיפות; שליש לכל היותר הם שודדים. | The subject of the clause is the peoples (masculine plural עמים), so the pronoun should be הם, not הן. |
| 1 | unnatural | `start.homeKind.riverLand` | river land | ארץ נהר | אדמת נהר | 'ארץ נהר' is a literal calque and does not read as a natural Hebrew place-type label. |
