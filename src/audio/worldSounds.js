// src/audio/worldSounds.js
// Which sounds a game state change deserves (src/audio/ACTIONS.md is the table). Pure: given the
// state before, the state after and the action that made it, a list of sound ids (soundRegistry.js
// UI_SOUNDS / WORLD_SOUNDS); src/audio/sfx.js plays them, GameContext calls it once per change.
//   1. The player's own action (ACTION_SOUNDS, by ActionTypes): feedback at once.
//   2. A refused action (the reducer only added a log line, gameReducer.js `reject`): 'ui-error'.
//   3. What the change brought, read from the state: wars begun or ended, cities gained or lost,
//      battles fought (battleReports), events and peace offers waiting, assaults queued, peoples
//      met, a new era, victory or defeat.
//   4. The news in the new log lines (LOG_RULES): a city grew, a building or wonder stands, a
//      research is done, a rebellion, a raid on its way...
// Never reads the clock or any random: the same change always sounds the same.
import { ActionTypes, GameStatus } from '../data/types';
import { WORLD_SOUNDS, UI_SOUNDS } from './soundRegistry';

const T = ActionTypes;
const settlerMove = (action, prev) => (prev?.units?.[action.payload?.unitId]?.classId === 'settler' ? 'settler-moving' : 'army-moved');

/**
 * The player's actions: an id, a function (action, prev, next) => id, or null (silent: the tap
 * itself already clicked, or the result is heard from the state). Every ActionTypes entry is here.
 */
export const ACTION_SOUNDS = {
  [T.ADVANCE_TURN]: null, // the end of turn sounds when the player presses it (GameContext runTurn)
  [T.FAST_FORWARD]: null,
  [T.APPLY_TURN_RESULT]: null, // the new turn and its news: from the state
  [T.RESET_GAME]: null,
  [T.FRONTIER_EXPEDITION]: 'settler-moving',
  [T.FOUND_COLONY]: 'city-founded',
  [T.ABANDON_COLONY]: 'ui-confirm',
  [T.QUEUE_PRODUCTION]: (a) => (a.payload?.item?.kind === 'wonder' ? 'wonder-started' : 'building-queued'), // units too: "unit-trained" when done
  [T.SAVE_ARMY_TEMPLATE]: 'ui-confirm',
  [T.RENAME_ARMY]: null,
  [T.PILLAGE_TILE]: 'gold-received',
  [T.HIRE_MERCENARY]: 'unit-trained',
  [T.ANSWER_TRIBUTE_DEMAND]: (a) => (a.payload?.pay ? 'tribute-paid' : 'ui-confirm'),
  [T.GIFT_INDEPENDENT]: 'tribute-paid',
  [T.PROPOSE_JOINING]: 'ui-confirm',
  [T.ANSWER_JOIN_OFFER]: (a) => (a.payload?.accept ? 'independent-joined' : 'ui-confirm'),
  [T.DEMAND_INDEPENDENT_TRIBUTE]: 'ui-confirm',
  [T.PROPOSE_INDEPENDENT_TRADE]: 'trade-route',
  [T.OFFER_INDEPENDENT_TRIBUTE]: 'tribute-paid',
  [T.RAZE_CITY]: 'city-razed',
  [T.STOP_RAZING]: 'ui-confirm',
  [T.DELETE_ARMY_TEMPLATE]: null,
  [T.DEQUEUE_PRODUCTION]: null,
  [T.SET_CITY_FOCUS]: null,
  [T.TOGGLE_TILE_LOCK]: null,
  [T.BUY_TILE]: 'tribute-paid',
  [T.SET_SETTLER_TARGET]: 'settler-moving',
  [T.FOUND_CITY]: 'city-founded',
  [T.ADD_LOG]: null,
  [T.RESOLVE_EVENT]: 'ui-confirm',
  [T.LOAD_GAME]: null,
  [T.GAIN_CONTROL]: 'ui-confirm',
  [T.BUILD_INFRASTRUCTURE]: 'building-queued',
  [T.BUILD_DEFENSES]: 'building-queued',
  [T.CONSTRUCT_BUILDING]: 'building-queued',
  [T.DEVELOP_RESOURCE_SITE]: 'building-queued',
  [T.DEVELOP_PROVINCE]: 'building-queued',
  [T.QUELL_UNREST]: 'ui-confirm',
  [T.SETTLE_COLONIZE]: 'settler-moving',
  [T.POPULATION_POLICY]: null,
  [T.SET_TAX_RATE]: null,
  [T.RECRUIT_UNIT]: 'unit-trained',
  [T.DISBAND_UNIT]: 'ui-close',
  [T.MOVE_ARMY]: settlerMove,
  [T.SET_ROUTE]: settlerMove,
  [T.CANCEL_ROUTE]: null,
  [T.LAUNCH_INVASION]: null, // the battle's outcome: battleReports
  [T.ATTACK_ARMY]: null,
  [T.ATTACK_FLEET]: null,
  [T.BEGIN_TACTICAL_BATTLE]: null, // the battle screen has its own sound
  [T.RESOLVE_TACTICAL_BATTLE]: null,
  [T.ABANDON_TACTICAL_BATTLE]: null,
  [T.SET_BATTLE_SETTINGS]: null,
  [T.BEGIN_DEFENSE_BATTLE]: null,
  [T.BEGIN_AMPHIBIOUS_BATTLE]: null,
  [T.RESOLVE_DEFENSE_AUTO]: null,
  [T.RESOLVE_ALL_DEFENSES_AUTO]: null,
  [T.WITHDRAW_FROM_DEFENSE]: 'battle-lost',
  [T.PROMOTE_UNIT]: 'ui-confirm',
  [T.HIRE_GENERAL]: 'unit-trained',
  [T.APPOINT_GENERAL]: 'ui-confirm',
  [T.EMBARK_UNIT]: 'army-moved',
  [T.DISEMBARK_UNIT]: 'army-moved',
  [T.AMPHIBIOUS_ASSAULT]: null,
  [T.NAVAL_ENGAGEMENT]: null,
  [T.SUPPRESS_REBELLION]: null,
  [T.RESEARCH_TECH]: 'tech-selected',
  [T.QUEUE_RESEARCH]: 'tech-selected',
  [T.UNQUEUE_RESEARCH]: null,
  [T.SET_RESEARCH_AUTO]: null,
  [T.SET_RESEARCH_FOCUS]: null,
  [T.MARK_TUTORIAL_STEP]: null,
  [T.ANSWER_DEMAND]: 'ui-confirm',
  [T.SET_AIR_PATROL]: null,
  [T.FUND_SCHOLARS]: 'tribute-paid',
  [T.CHANGE_GOVERNMENT_TYPE]: 'ui-confirm',
  [T.ENACT_GOVERNMENT_REFORM]: 'ui-confirm',
  [T.CHANGE_LAW]: 'ui-confirm',
  [T.DECLARE_WAR]: null, // the war itself: from the state
  [T.FABRICATE_CLAIM]: 'ui-confirm',
  [T.SUE_FOR_PEACE]: null, // peace signed (or not): from the state
  [T.OFFER_PEACE]: null,
  [T.ACCEPT_PENDING_PEACE]: null,
  [T.REJECT_PENDING_PEACE]: 'ui-close',
  [T.TRADE_AGREEMENT]: 'trade-route',
  [T.OPEN_BORDERS]: 'pact-signed',
  [T.CLOSE_BORDERS]: 'ui-close',
  [T.DEMAND]: 'ui-confirm',
  [T.MILITARY_ALLIANCE]: 'pact-signed',
  [T.GIFT_BRIBE]: 'tribute-paid',
  [T.ESPIONAGE]: 'ui-confirm',
  [T.COUNTER_INTELLIGENCE]: 'ui-confirm',
  [T.RIVAL_NATION]: 'ui-confirm',
  [T.UNRIVAL_NATION]: null,
  [T.PROPOSE_MARRIAGE]: 'pact-signed',
  [T.BREAK_ALLIANCE]: 'ui-close',
  [T.INSULT]: 'ui-confirm',
  [T.ASSIGN_DIPLOMAT]: 'ui-confirm',
  [T.RECALL_DIPLOMAT]: null,
  [T.VASSALIZE]: 'pact-signed',
  [T.ANNEX_VASSAL]: 'independent-joined',
  [T.RELEASE_VASSAL]: 'ui-confirm',
  [T.SHIFT_IDENTITY]: 'ui-confirm',
  [T.BUILD_CLIMATE_RESILIENCE]: 'building-queued',
  [T.CULTURAL_EXPORT]: 'ui-confirm',
  [T.HIRE_ADVISOR]: 'ui-confirm',
  [T.ASSIGN_GOVERNOR]: 'ui-confirm',
  [T.DISMISS_GOVERNOR]: null,
  [T.INCREASE_STABILITY]: 'ui-confirm',
  [T.LAUNCH_SATELLITE]: 'tech-complete',
  [T.ASAT_STRIKE]: 'city-razed',
  [T.BUILD_MISSILE]: 'building-queued',
  [T.MISSILE_STRIKE]: 'city-razed',
  [T.BUILD_ABM_DEFENSE]: 'building-queued',
  [T.LAUNCH_MISSION]: 'wonder-started',
  [T.SET_ARMY_MAINTENANCE]: null,
  [T.SET_NAVY_MAINTENANCE]: null,
  [T.REQUEST_LOAN]: 'gold-received',
  [T.REPAY_LOAN]: 'tribute-paid',
  [T.ACTIVATE_FUSION_GRID]: 'tech-complete',
  [T.MOVE_CAPITAL]: 'ui-confirm',
  [T.DECLARE_INDEPENDENCE]: null, // a war of independence: from the state
  [T.CONTINUE_AFTER_VICTORY]: null
};

/** The id an action asks for (null: silent). */
export const actionSound = (action, prev, next) => {
  const s = ACTION_SOUNDS[action?.type];
  return typeof s === 'function' ? s(action, prev, next) : s || null;
};

// News in the log lines the change added: [pattern, id]. First match wins per line.
export const LOG_RULES = [
  [/^VICTORY/, 'game-victory'],
  [/^DEFEAT/, 'game-defeat'],
  [/A new era dawns|expertise has reached/i, 'era-advanced'],
  [/stands at .*!|completes [a-z][a-z ]+ \(tier \d+\)/i, 'wonder-complete'],
  [/^Researched /, 'tech-complete'],
  [/is razed|razing/i, 'city-razed'],
  [/Rebellion breaks out|civil war|insurgents|uprising/i, 'rebellion'],
  [/has thrown off your rule|has gone over to/i, 'city-lost'],
  [/join you|joins you/i, 'independent-joined'],
  [/is founded|has grown from an outpost/i, 'city-founded'],
  [/is under siege|lay(s)? siege/i, 'city-besieged'],
  [/tiles? from |plunder your|will raid you/i, 'raid-warning'],
  [/offer to join you|demand \d+ gold/i, 'event-appeared'],
  [/grows to size/i, 'city-grows'],
  [/ completes a | lays out its /i, 'building-complete'],
  [/ trains | is complete at |has joined your officer corps/i, 'unit-trained'],
  [/sends out settlers/i, 'settler-moving'],
  [/Vassal tribute: \+|treasury of|\+\d[\d,.]* gold\b/i, 'gold-received']
];
// A refusal in a log line: the action's own sound turns into 'ui-error'.
const REFUSAL = /\b(refus|declin|reject|rebuff|not interested|turns? (you )?down|can't|cannot|can only|not enough|isn't possible|no longer possible)/i;
const INCOME_LINE = /^-?\d+: \+/; // the per-turn income line (resolveTurn.js) is not news

export const logSound = (message) => {
  if (!message || INCOME_LINE.test(message)) return null;
  const hit = LOG_RULES.find(([re]) => re.test(message));
  return hit ? hit[1] : null;
};

/** Only the logs changed: the reducer refused the action (gameReducer.js `reject`). */
export const isRejection = (prev, next) => {
  if (!prev || !next || prev === next || prev.logs === next.logs) return false;
  if ((next.logs?.length || 0) <= (prev.logs?.length || 0)) return false;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) if (k !== 'logs' && prev[k] !== next[k]) return false;
  return true;
};

const involves = (war, id) => war && (war.aggressor === id || war.enemy === id);
const activeWarIds = (state) => new Set((state?.wars || []).filter((w) => w.active && involves(w, state.playerNationId)).map((w) => w.id));

// The player's cities: id -> true.
const playerCities = (state) => {
  const out = new Set();
  const me = state?.playerNationId;
  Object.entries(state?.regions || {}).forEach(([id, r]) => { if (r?.owner === me) out.add(id); });
  return out;
};

const TURN_ACTIONS = new Set([T.ADVANCE_TURN, T.FAST_FORWARD, T.APPLY_TURN_RESULT]);

/**
 * The sounds for one state change, most important first is NOT promised here (sfx.js planSequence
 * orders them); ids may repeat (dropped there). [] when the change deserves none.
 */
export const soundsForTransition = (prev, next, action) => {
  if (!prev || !next || prev === next || !action) return [];
  if (action.type === T.LOAD_GAME || action.type === T.RESET_GAME || action.type === T.ADD_LOG) return [];
  if (prev.playerNationId !== next.playerNationId) return [];
  const out = [];
  const newLogs = (next.logs || []).length > (prev.logs || []).length ? next.logs.slice(prev.logs.length) : [];

  // 2. Refused: one error, nothing else.
  if (isRejection(prev, next)) return ['ui-error'];

  // 1. The action's own sound (a diplomatic offer turned down sounds like a refusal).
  const own = actionSound(action, prev, next);
  if (own) out.push(newLogs.some((l) => REFUSAL.test(l?.message || '')) && !TURN_ACTIONS.has(action.type) ? 'ui-error' : own);

  // 3. The state.
  if (next.gameStatus !== prev.gameStatus) {
    if (next.gameStatus === GameStatus.VICTORY) out.push('game-victory');
    else if (next.gameStatus === GameStatus.DEFEAT) out.push('game-defeat');
    else if (next.gameStatus === GameStatus.COMPLETE) out.push('era-advanced');
  }
  if (next.age && prev.age && next.age !== prev.age) out.push('era-advanced');
  if ((next.activeEventId && next.activeEventId !== prev.activeEventId) || (next.activeProceduralEvent && next.activeProceduralEvent !== prev.activeProceduralEvent)) out.push('event-appeared');
  if (next.pendingPeaceOffer && next.pendingPeaceOffer !== prev.pendingPeaceOffer) out.push('event-appeared');
  if ((next.pendingDefenses?.length || 0) > (prev.pendingDefenses?.length || 0)) {
    const added = next.pendingDefenses.slice(prev.pendingDefenses?.length || 0);
    out.push(added.some((d) => d.kind === 'raid' || d.kind === 'sack') ? 'raid-warning' : 'city-besieged');
  }
  if (next.wars !== prev.wars) {
    const before = activeWarIds(prev); const after = activeWarIds(next);
    if ([...after].some((id) => !before.has(id))) out.push('war-declared');
    if ([...before].some((id) => !after.has(id))) out.push('peace-signed');
  }
  if (next.regions !== prev.regions) {
    const before = playerCities(prev); const after = playerCities(next);
    const gained = [...after].filter((id) => !before.has(id));
    const lost = [...before].filter((id) => !after.has(id));
    if (gained.some((id) => prev.regions?.[id])) out.push('city-captured'); // was someone's: taken (or joined: the log says)
    else if (gained.length) out.push('city-founded');
    if (lost.length) out.push(lost.some((id) => !next.regions?.[id]) ? 'city-razed' : 'city-lost');
  }
  const seqGain = (next.battleReportSeq || 0) - (prev.battleReportSeq || 0);
  if (seqGain > 0 && action.type !== T.RESOLVE_TACTICAL_BATTLE) {
    const fresh = (next.battleReports || []).slice(0, seqGain);
    if (fresh.length) {
      const won = fresh.filter((e) => e.outcome !== 'stalemate' && e.outcome === e.playerSide).length;
      out.push(won * 2 >= fresh.length ? 'battle-won' : 'battle-lost');
    }
  }
  const metBefore = Object.keys(prev.fog?.met?.[prev.playerNationId] || {}).length;
  const metAfter = Object.keys(next.fog?.met?.[next.playerNationId] || {}).length;
  if (metAfter > metBefore && TURN_ACTIONS.has(action.type)) out.push('first-contact');

  // 4. The news.
  newLogs.forEach((l) => { const id = logSound(l?.message); if (id) out.push(id); });

  // A new turn is the quietest news: heard when nothing else is.
  if (TURN_ACTIONS.has(action.type) && next.turnNumber !== prev.turnNumber) out.push('turn-begin');

  return out.filter((id) => WORLD_SOUNDS[id] || UI_SOUNDS[id]);
};
