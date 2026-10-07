# Action sounds

Every player-facing action or event that makes a sound, its sound id, when exactly it plays and its
category. The ids live in `src/audio/soundRegistry.js` (UI_SOUNDS, WORLD_SOUNDS, BATTLE_SOUNDS,
voice folders); the recordings in `src/assets/audio/<category>/<id>/` (one to four variants, one
picked at random, never the same twice in a row). An id without recordings stays silent (battle
ids fall back to their synthesized sound). Every file is CC0: `src/assets/audio/LICENSES.md`.

Categories and switches (Settings > Sound; all of them under the one Sound switch and the
Effects volume):

| Category | Switch | Played by |
| --- | --- | --- |
| ui | Interface sounds | `src/audio/uiSounds.js` (one click listener and one sheet observer for the whole app), `worldSounds.js` for refusals |
| world | Interface sounds | `src/context/GameContext.jsx`: every dispatch is compared before and after (`soundsForTransition`, pure), `src/audio/sfx.js` plays the result |
| battle | Battle sounds | `src/battle/audio/battleAudio.js` (sim events and the player's orders; positional sounds only where the camera looks) |
| voice | Unit voices | `src/components/battle/TacticalBattleScreen.jsx` through `sfx.playVoice` (rate-limited) |

Several sounds of one moment (a turn's news) play one after another, most important first, at most
three, 420 ms apart; a big fanfare plays alone (`sfx.planSequence`). Every id has a cooldown. Sound
never blocks or delays the game: the reducer and the sim never call it, and without Web Audio
(tests, headless runs) every call is a no-op.

Count: 7 ui, 33 world, 16 new battle cues (plus 7 existing battle sounds reused as player cues),
14 voice folders (5 unit classes; select, order, attack).

## Interface (ui)

| Id | When it plays |
| --- | --- |
| ui-click | Any button, link or menu item is tapped (outside the RTS battle, which has its own order sounds). `data-sound="..."` on an element overrides it, `data-sound="none"` silences it. |
| ui-open | A sheet or dialog (`.sheet-panel` or `role="dialog"`) appears. Quiet when a world sound started in the last 600 ms (the sheet is that news). |
| ui-close | A sheet or dialog goes away; also DISBAND_UNIT, REJECT_PENDING_PEACE, CLOSE_BORDERS, BREAK_ALLIANCE. |
| ui-tab | A tab (`role="tab"` or `aria-selected`) is tapped: the tab rail, panel tabs. |
| ui-toggle | A switch, checkbox, radio or pressed chip (`role="switch"`, `aria-pressed`). |
| ui-error | The reducer refused the action (it only added a log line, `reject` in gameReducer.js), or the answer in the log is a refusal ("refuses", "declines", "not enough"...). |
| ui-confirm | A settled choice with no sound of its own: an event option, a law, a reform, a governor, a diplomat, a claim, espionage, a promotion, a capital moved, a tribute refused. |

## World map (world)

Actions: the player's own dispatch (`ACTION_SOUNDS` in worldSounds.js names every ActionTypes entry,
`null` on purpose for silent ones). State: read from the change. Log: a new log line matching
`LOG_RULES`. "Turn" means the turn result (ADVANCE_TURN, FAST_FORWARD, APPLY_TURN_RESULT).

| Id | When it plays | Source of the trigger |
| --- | --- | --- |
| turn-end | The player presses End turn or Fast forward (GameContext `runTurn`, before the worker starts). | action |
| turn-begin | The new turn arrives. Lowest priority: heard only when the turn brought less than three other news. | state (turnNumber) |
| city-founded | FOUND_CITY, FOUND_COLONY; a new city of the player's appears; "is founded as an outpost", "has grown from an outpost". | action, state, log |
| city-grows | "X grows to size N". | log |
| building-queued | QUEUE_PRODUCTION (not a wonder), CONSTRUCT_BUILDING, BUILD_INFRASTRUCTURE, BUILD_DEFENSES, DEVELOP_PROVINCE, DEVELOP_RESOURCE_SITE, BUILD_MISSILE, BUILD_ABM_DEFENSE, BUILD_CLIMATE_RESILIENCE. | action |
| building-complete | "X completes a Granary", "X lays out its district". | log |
| wonder-started | QUEUE_PRODUCTION of a wonder; LAUNCH_MISSION. | action |
| wonder-complete (big) | "Wonder (tier N) stands at X!", "X completes wonder (tier N)". | log |
| tech-selected | RESEARCH_TECH, QUEUE_RESEARCH. | action |
| tech-complete | "Researched X"; LAUNCH_SATELLITE, ACTIVATE_FUSION_GRID. | log, action |
| era-advanced (big) | The world's age changes; "Your empire's expertise has reached the X"; a game COMPLETE ending. | state, log |
| settler-moving | MOVE_ARMY or SET_ROUTE of a settler, SET_SETTLER_TARGET, FRONTIER_EXPEDITION, SETTLE_COLONIZE; "X sends out settlers". | action, log |
| army-moved | MOVE_ARMY or SET_ROUTE of an army, EMBARK_UNIT, DISEMBARK_UNIT. | action |
| unit-trained | RECRUIT_UNIT, HIRE_MERCENARY, HIRE_GENERAL; "X trains infantry", "Army is complete at X", "joined your officer corps". | action, log |
| war-declared (big) | A war the player is in begins (declared by or on the player, DECLARE_INDEPENDENCE, a pact calling them in). | state (wars) |
| peace-signed | A war the player was in ends. | state (wars) |
| pact-signed | MILITARY_ALLIANCE, OPEN_BORDERS, PROPOSE_MARRIAGE, VASSALIZE (a refusal in the log turns it into ui-error). | action |
| trade-route | TRADE_AGREEMENT, PROPOSE_INDEPENDENT_TRADE. | action |
| gold-received | PILLAGE_TILE, REQUEST_LOAN; "Vassal tribute: +", "You take the treasury of", "+N gold". | action, log |
| tribute-paid | ANSWER_TRIBUTE_DEMAND (pay), GIFT_INDEPENDENT, OFFER_INDEPENDENT_TRIBUTE, GIFT_BRIBE, BUY_TILE, FUND_SCHOLARS, REPAY_LOAN. | action |
| raid-warning | A raid or sack is queued against the player (pendingDefenses kind raid or sack); "raiders are N tiles from", "plunder your trade route", "or they will raid you". | state, log |
| city-besieged | Any other assault queued against the player (pendingDefenses); "X is under siege", "Your army lays siege to X". | state, log |
| city-captured | A city that was someone else's becomes the player's. | state (regions) |
| city-lost | One of the player's cities becomes someone else's; "has thrown off your rule", "has gone over to". | state, log |
| city-razed | RAZE_CITY, MISSILE_STRIKE, ASAT_STRIKE; a player city disappears; "X is razed". | action, state, log |
| event-appeared | An event or a procedural event opens; a peace offer arrives; "offer to join you", "demand N gold a turn". | state, log |
| first-contact | The player meets a new people during a turn (fog `met` grows). | state |
| independent-joined | ANSWER_JOIN_OFFER (accept), ANNEX_VASSAL; "join you", "joins you". | action, log |
| rebellion | "Rebellion breaks out", "civil war", "insurgents", "uprising". | log |
| battle-won | An auto-resolved battle the player won (new battleReports entry); not after a commanded battle, which sounded on the battlefield. | state |
| battle-lost | The same, lost; WITHDRAW_FROM_DEFENSE. | state, action |
| game-victory (big) | gameStatus becomes VICTORY. | state |
| game-defeat (big) | gameStatus becomes DEFEAT. | state |

Silent on purpose (the tap's own click is enough, or the result is heard from the state): turn
actions themselves, RESET_GAME, LOAD_GAME, ADD_LOG, renames and templates deleted, focus, tile
locks, tax and maintenance sliders, research queue edits and settings, dequeue, route cancelled,
all battle start and resolve actions (their outcome sounds), DECLARE_WAR and peace offers (the war
list sounds), recall and dismiss, unrival.

## Battle (battle)

New player cues (non-positional: heard wherever the camera is, each with a cooldown), from
battleAudio.js `orderSound`, `cueForEvent` and `frameAlerts`:

| Id | When it plays |
| --- | --- |
| order-move | The player sends a move, deploy or formation-line order. |
| order-attack | An attack, attack-move or charge order. |
| worker-task | Workers sent to gather, help build or repair. |
| building-placed | A building placed (the build order). |
| building-finished | A building of the player's is finished (sim event `built`). |
| house-built | A house is finished (`built`, kind house). |
| squad-trained | A unit of the player's leaves a building's queue (`trained`). |
| housing-full | A training queue item is newly blocked by the housing cap (once per block, 15 s cooldown). |
| node-depleted | A resource node that was running low disappears from the view (worked out). |
| under-attack | An enemy hits the player's troops or walls where the camera is not looking (12 s cooldown). |
| gate-breached | The keep is breached, or a gate falls. |
| wall-destroyed | A wall section or tower falls. |
| retreat-horn | A retreat or retreat-all order. |
| rally-cry | The Rally Cry power is used (either side). |
| power-used | Any other commander power (arrow storm, bombardment...). |
| general-killed | A general's guard is destroyed. |

Existing battle sounds that serve as player cues: `order-click` (any other order: stop, hold,
garrison, rally point; also the fallback when an order's own sound is cooling down), `bell` (a
capture point taken, assimilation started), `horn-order` (rallied, last stand), `rout` (a squad
routs or flees), `arrow-volley` (six or more arrows in one frame), `building-collapse` (a keep,
structure or economy building destroyed, positional), `victory` / `defeat` (the battle ends).

## Unit voices (voice)

Wordless barks, no spoken words: CC0 voices with an ancient feel do not exist (Kenney's Voiceover
packs are modern announcer and soldier lines, "Go go go", "Mission completed"), so each class has
its own male voice from HaelDB's CC0 grunt and yelling pack: the shortest sounds acknowledge a
selection, the middle ones an order, the longest and loudest ones a charge. Workers use short
grunts, a little higher, with a tool clink on an order.

| Folder | When it plays |
| --- | --- |
| voice/<class>/select | The selection changes to a new group (tap, box select, select by class); the class most of the group shares answers. |
| voice/<class>/order | A move, deploy, formation, gather, build, repair or garrison order. |
| voice/<class>/attack | An attack, attack-move or charge order (falls back to the order barks). |

Classes: infantry, ranged, cavalry (also generals), siege, worker; other classes borrow the
infantry voice. Rate limit (`sfx.createBarkLimiter`): one bark at a time, at least 0.9 s between
two, a select bark at most every 2.6 s, an order every 1.4 s, an attack every 1.6 s; the same group
selected again is not answered.

## Adding a sound

1. Pick or add the id in soundRegistry.js (UI_SOUNDS, WORLD_SOUNDS or BATTLE_SOUNDS) and the
   trigger here (ACTION_SOUNDS or LOG_RULES in worldSounds.js, cueForEvent in battleAudio.js).
2. Drop CC0 OGG files into `src/assets/audio/<category>/<id>/` and list them in LICENSES.md.
   The raw downloads and the build scripts (actions.mjs, licenses_actions.mjs) live outside the
   repository in `C:\GitWotkspace\audio-sources\`.
