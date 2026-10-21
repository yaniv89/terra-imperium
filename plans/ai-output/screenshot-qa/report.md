# Screenshot QA: layout faults

13 findings over 30 screen and size pairs (English and Hebrew together), most serious first (3 unreadable or unusable, 2 clearly wrong, 1 polish).
The screenshots are in `shots/`. World Congress has no screen yet, so it is not covered.
Every captured screen was checked.

| Sev | Kind | Screen | Size | Lang | Where | Problem | File |
|---|---|---|---|---|---|---|---|
| 2 | overlap | start-people | 844x390 | en | top bar, right end | The orange Weekly challenge button covers another control behind it (the language button or a similar one). Only a sliver of its border shows above the button, so that control cannot be used. | `shots/start-people-phone-en.jpg` |
| 2 | overlap | start-people | 844x390 | he | top bar, left end | The orange weekly challenge button covers another control behind it, with its border showing. The language icon sits right beside it and is crowded. | `shots/start-people-phone-he.jpg` |
| 2 | overlap | start-rules | 844x390 | en | top bar, right end | The orange Weekly challenge button covers another top bar control, whose outline shows behind it at the top right. That control is hidden and cannot be used. | `shots/start-rules-phone-en.jpg` |
| 2 | overlap | start-rules | 844x390 | he | top bar, left end | The orange Weekly challenge button covers another top bar control, whose outline shows behind it. The language icon sits right next to it, crowded. | `shots/start-rules-phone-he.jpg` |
| 2 | overlap | start-world | 844x390 | en | top bar, right end | The orange Weekly challenge button covers another control that sits behind it (its outline shows above and left of the button), probably the language switcher, so that control is hidden. | `shots/start-world-phone-en.jpg` |
| 2 | overlap | start-world | 844x390 | he | top bar, left end | The orange challenge button covers another control behind it (an outline shows at its top and right edge), and the language icon sits right next to it. | `shots/start-world-phone-he.jpg` |
| 1 | cut-off | start-people | 844x390 | en | region filter chips row | The chip after Europe is cut off at the edge of the list panel. This looks like a horizontal scroll, so it is probably acceptable. | `shots/start-people-phone-en.jpg` |
| 1 | notch | start-people | 844x390 | en | top bar, right end and Next button | The Weekly challenge button and the Next: World button sit about 12 px from the right edge, inside the notch zone. | `shots/start-people-phone-en.jpg` |
| 1 | notch | start-people | 844x390 | he | top bar, left end and Next button | The weekly challenge button and the Next button sit about 8 to 12 px from the left edge, inside the notch zone. | `shots/start-people-phone-he.jpg` |
| 1 | notch | start-rules | 844x390 | he | top bar, left end, Weekly challenge button | The button sits about 16 px from the left screen edge, within the notch or rounded corner zone. | `shots/start-rules-phone-he.jpg` |
| 1 | notch | start-rules | 844x390 | en | top bar, right end, Weekly challenge button | The button sits about 16 px from the right screen edge, within the notch or rounded corner zone. | `shots/start-rules-phone-en.jpg` |
| 1 | notch | start-world | 844x390 | en | top right, Weekly challenge button | The button extends to about 10 px from the right screen edge, so a notch or rounded corner could cover part of it. | `shots/start-world-phone-en.jpg` |
| 1 | notch | start-world | 844x390 | he | top left, challenge button | The button sits about 8 px from the left screen edge, so a notch or rounded corner could cover part of it. | `shots/start-world-phone-he.jpg` |
