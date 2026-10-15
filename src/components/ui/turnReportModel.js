// src/components/ui/turnReportModel.js
// The turn report (W10, plans/UI-DESIGN.md): what happened between two states the player saw (one
// turn, or every turn of a fast forward), grouped for the report sheet. Pure; reads only what the
// engine already keeps:
//   battles   new entries of state.battleReports (name, won or lost, the fallen on each side)
//   raids     new log lines about pillage, plunder and raiders
//   contacts  peoples met since (fog.met), majors only, with their capital when seen
//   cities    cities founded, taken and lost; growth folded into one line
//   research  techs learned
//   news      the other new log lines worth a look (crises, diplomacy, milestones, events)
// A place is a city id the sheet can jump to, or a nation id for a contact. Quiet turns (nothing
// but growth and research) are `quiet`, and the sheet does not open by itself for them.
import { LogTypes } from '../../data/types';
import { TECH_TREE } from '../../data/techTree';
import { AGES } from '../../data/ages';
import { playerWon } from '../../engine/battleReports';
import { newContacts, contactCard } from '../modals/firstContactModel';
import { isExplored, fogOn, hasMet } from '../../engine/fog';
import { summarizeLogs } from '../../engine/logSummary';
import { isIndependentNation } from '../../data/independents';
import { translate, getLanguage, formatYear, ageName, hasKey } from '../../i18n/core';
import { nameOf } from '../../i18n/names';
import { logText } from '../../i18n/messageText';

export const REPORT_GROUPS = [
  { id: 'battles', label: 'Battles' },
  { id: 'raids', label: 'Raids' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'cities', label: 'Cities' },
  { id: 'research', label: 'Research' },
  { id: 'news', label: 'News' }
];
const groupsIn = (lang) => REPORT_GROUPS.map((g) => ({ ...g, label: translate(`report.group.${g.id}`, null, lang) }));

const RAID_WORDS = /pillag|plunder|raider|raid\b|raids\b|sack/i;
const NEWS_TYPES = new Set([LogTypes.COMBAT, LogTypes.CRISIS, LogTypes.DIPLOMACY, LogTypes.MILESTONE, LogTypes.EVENT]);
const men = (n) => `${Math.round(n || 0).toLocaleString('en-US')}`;

// The first of the player's (or any seen) cities named in a line, for the place button.
const placeIn = (state, message) => {
  const me = state.playerNationId;
  let best = null;
  Object.values(state.regions || {}).forEach((c) => {
    if (!c.name || !message.includes(c.name)) return;
    const mine = c.owner === me;
    if (!mine && !isExplored(state, c.tile)) return;
    if (!best || (mine && best.owner !== me) || c.name.length > best.name.length) best = c;
  });
  return best ? { kind: 'city', id: best.id, name: best.name } : null;
};

// A line is "unmet" news when it names a major people the player has not met or a city the player
// has not seen, and names nothing of the player's own or already known. Fog off: nothing is unmet.
const unmetFilter = (state) => {
  if (!fogOn(state)) return () => false;
  const me = state.playerNationId;
  const known = new Set(); const unmet = new Set();
  Object.values(state.regions || {}).forEach((c) => {
    if (!c.name || c.name.length < 3) return;
    (c.owner === me || isExplored(state, c.tile) ? known : unmet).add(c.name);
  });
  Object.entries(state.nations || {}).forEach(([id, n]) => {
    if (!n?.name || id === me || isIndependentNation(n)) return;
    (hasMet(state, me, id) ? known : unmet).add(n.name);
  });
  const knownList = [...known]; const unmetList = [...unmet].filter((s) => !known.has(s));
  return (msg) => unmetList.some((s) => msg.includes(s)) && !knownList.some((s) => msg.includes(s));
};

// A city that shrank (a sack, a starving siege) and grew back inside one report reads as two
// steps in order, not as a contradiction (playtest audit I172): "shrinks to 1" then "grew to 2".
const shrinkNote = (lines, city) => {
  const hit = lines.find((l) => String(l.message).includes(city.name) && /shrinks? to (?:size )?(\d+)/i.test(l.message));
  const n = hit && /shrinks? to (?:size )?(\d+)/i.exec(hit.message)[1];
  return n ? Number(n) : null;
};

/** The report in `lang` (default: the current language). Text is written here, from keys; the
 * engine's log lines through logText (old saves: their English as it is). */
export const turnReportModel = (before, after, lang = getLanguage()) => {
  if (!before || !after || after.turnNumber <= before.turnNumber) return null;
  const tr = (key, vars) => translate(key, vars, lang);
  const cityName = (c) => nameOf('city', null, c.name, lang);
  const nationName = (id, fallback) => (after.nations?.[id]?.name ? nameOf('people', id, after.nations[id].name, lang) : fallback);
  const cityPlace = (c) => ({ kind: 'city', id: c.id, name: cityName(c) });
  const me = after.playerNationId;
  const items = [];
  const add = (group, item) => items.push({ group, id: `${group}-${items.length}`, ...item });

  // Battles: new report entries (ids are sequential, newest first).
  const seen = new Set((before.battleReports || []).map((b) => b.id));
  (after.battleReports || []).filter((b) => !seen.has(b.id)).reverse().forEach((b) => {
    const won = playerWon(b);
    const stalemate = b.outcome === 'stalemate';
    const mine = b.playerSide; const theirs = mine === 'attacker' ? 'defender' : 'attacker';
    const city = b.targetRegionId != null ? after.regions?.[b.targetRegionId] : null;
    add('battles', {
      tone: stalemate ? 'muted' : won ? 'good' : 'danger',
      title: tr('report.battleTitle', { name: b.name ? nameOf('battle', null, b.name, lang) : tr('report.aBattle'), result: tr(`report.battle.${stalemate ? 'none' : won ? (b.defense ? 'held' : 'won') : (b.defense ? 'lost' : 'repelled')}`) }),
      sub: `${tr('report.fallen', { mine: men(b.fallen?.[mine]), theirs: men(b.fallen?.[theirs]) })}${b.captured ? tr('report.changedHands') : ''}`,
      place: city ? cityPlace(city) : null
    });
  });

  // Log lines added since `before` (the log only grows; a reset starts a new game). Recurring
  // lines (upkeep, a plundered route) are folded into one with a count (logSummary.js).
  const fresh = summarizeLogs((after.logs || []).slice((before.logs || []).length));
  const unmetNews = [];
  const isUnmet = unmetFilter(after);
  fresh.forEach((l) => {
    const msg = String(l.message || '');
    if (!msg) return;
    // News about peoples and cities the player has not met or seen is not a task: one line.
    // (matched on the English line; shown in the reader's language)
    const shown = logText(l, lang);
    const placeOf = (m) => { const p = placeIn(after, m); return p ? { ...p, name: nameOf('city', null, p.name, lang) } : null; };
    if (l.type !== LogTypes.ACTION && l.type !== LogTypes.TECH && isUnmet(msg)) { unmetNews.push(shown); return; }
    if (RAID_WORDS.test(msg) && (l.type === LogTypes.COMBAT || l.type === LogTypes.CRISIS)) {
      add('raids', { tone: 'danger', title: shown, sub: null, place: placeOf(msg) });
    } else if (NEWS_TYPES.has(l.type) && !/^A new era dawns/.test(msg)) {
      add('news', { tone: l.type === LogTypes.CRISIS ? 'danger' : l.type === LogTypes.COMBAT ? 'enemy' : 'muted', title: shown, sub: null, place: placeOf(msg) });
    }
  });

  if (unmetNews.length) {
    add('news', {
      tone: 'muted', unmet: true,
      title: tr('report.unmet', { count: unmetNews.length }),
      sub: tr('report.unmetSub'),
      lines: unmetNews, place: null
    });
  }

  // Contacts.
  newContacts(after, new Set(Object.keys(before.fog?.met?.[me] || {}))).forEach((id) => {
    const card = contactCard(after, id);
    if (!card) return;
    add('contacts', {
      tone: 'you',
      title: lang === 'en' ? `Met the ${card.title}` : tr('report.met', { name: nameOf('people', id, after.nations?.[id]?.name || card.title, lang) }),
      sub: tr(card.citiesSeen ? 'report.metSubSeen' : 'report.metSub', { mood: tr(`report.mood.${card.mood}`), n: card.citiesSeen }),
      place: { kind: 'nation', id, name: card.capitalSeen && card.capital ? nameOf('city', null, card.capital, lang) : tr('report.peoples') }
    });
  });

  // Cities: founded, taken, lost, grown.
  const was = before.regions || {}; const now = after.regions || {};
  const grown = [];
  Object.values(now).forEach((c) => {
    const old = was[c.id];
    if (c.owner === me && !old) add('cities', { tone: 'good', title: tr('report.founded', { city: cityName(c) }), sub: tr('report.foundedSub'), place: cityPlace(c) });
    else if (c.owner === me && old && old.owner !== me) add('cities', { tone: 'good', title: tr('report.taken', { city: cityName(c) }), sub: tr('report.takenFrom', { nation: nationName(old.owner, tr('report.enemy')) }), place: cityPlace(c) });
    else if (old && old.owner === me && c.owner !== me) add('cities', { tone: 'danger', title: tr('report.lost', { city: cityName(c) }), sub: tr('report.heldBy', { nation: nationName(c.owner, tr('report.enemy')) }), place: cityPlace(c) });
    else if (c.owner === me && old && (c.size || 1) > (old.size || 1)) grown.push(c);
  });
  Object.values(was).forEach((old) => { if (old.owner === me && !now[old.id]) add('cities', { tone: 'danger', title: tr('report.gone', { city: cityName(old) }), sub: tr('report.goneSub'), place: null }); });
  if (grown.length) {
    add('cities', {
      tone: 'good', growth: true,
      title: grown.length === 1 ? tr('report.grewOne', { city: cityName(grown[0]), size: grown[0].size }) : tr('report.grewMany', { n: grown.length }),
      sub: grown.length === 1 ? (shrinkNote(fresh, grown[0]) ? tr('report.shrankNote', { n: shrinkNote(fresh, grown[0]) }) : null) : grown.slice(0, 4).map((c) => `${cityName(c)} ${c.size}${shrinkNote(fresh, c) ? tr('report.afterLoss') : ''}`).join(', '),
      place: cityPlace(grown[0])
    });
  }

  // Research.
  const knew = before.techTree || {};
  Object.keys(after.techTree || {}).filter((id) => after.techTree[id]?.researched && !knew[id]?.researched).forEach((id) => {
    const techKey = `tech.${id}.name`;
    const tech = hasKey(techKey, 'en') ? tr(techKey) : (TECH_TREE[id]?.name || id);
    add('research', { tone: 'science', title: tr('report.learned', { tech }), sub: null, place: { kind: 'tab', id: 'tech', name: tr('report.group.research') } });
  });
  if (after.age !== before.age) add('news', { tone: 'you', title: tr('report.newAge', { age: lang === 'en' ? (AGES[after.age]?.name || after.age) : ageName(after.age, AGES[after.age]?.name || after.age) }), sub: null, place: null });

  const counts = Object.fromEntries(REPORT_GROUPS.map((g) => [g.id, items.filter((i) => i.group === g.id).length]));
  const quiet = items.every((i) => i.group === 'research' || i.growth || i.unmet);
  const turns = after.turnNumber - before.turnNumber;
  return {
    title: turns > 1 ? tr('report.titleMany', { from: before.turnNumber, to: after.turnNumber - 1 }) : tr('report.titleOne', { n: before.turnNumber }),
    year: formatYear(Math.round(after.year), lang),
    turns,
    nextTurn: after.turnNumber,
    items,
    counts,
    groups: groupsIn(lang).filter((g) => counts[g.id] > 0),
    quiet
  };
};
