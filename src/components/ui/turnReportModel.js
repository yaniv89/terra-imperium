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
import { isExplored } from '../../engine/fog';

export const REPORT_GROUPS = [
  { id: 'battles', label: 'Battles' },
  { id: 'raids', label: 'Raids' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'cities', label: 'Cities' },
  { id: 'research', label: 'Research' },
  { id: 'news', label: 'News' }
];

const RAID_WORDS = /pillag|plunder|raider|raid\b|raids\b|sack/i;
const NEWS_TYPES = new Set([LogTypes.COMBAT, LogTypes.CRISIS, LogTypes.DIPLOMACY, LogTypes.MILESTONE, LogTypes.EVENT]);
const asLog = (l) => (typeof l === 'string' ? { message: l, type: LogTypes.ACTION } : l || { message: '', type: LogTypes.ACTION });
const fmtYear = (y) => (y < 0 ? `${Math.abs(Math.round(y))} BCE` : `${Math.round(y)} CE`);
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

export const turnReportModel = (before, after) => {
  if (!before || !after || after.turnNumber <= before.turnNumber) return null;
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
      title: `${b.name || 'A battle'}: ${stalemate ? 'no winner' : won ? (b.defense ? 'held' : 'won') : (b.defense ? 'lost' : 'repelled')}`,
      sub: `Your fallen: ${men(b.fallen?.[mine])}. Theirs: ${men(b.fallen?.[theirs])}.${b.captured ? ' The city changed hands.' : ''}`,
      place: city ? { kind: 'city', id: city.id, name: city.name } : null
    });
  });

  // Log lines added since `before` (the log only grows; a reset starts a new game).
  const fresh = (after.logs || []).slice((before.logs || []).length).map(asLog);
  fresh.forEach((l) => {
    const msg = String(l.message || '');
    if (!msg) return;
    if (RAID_WORDS.test(msg) && (l.type === LogTypes.COMBAT || l.type === LogTypes.CRISIS)) {
      add('raids', { tone: 'danger', title: msg, sub: null, place: placeIn(after, msg) });
    } else if (NEWS_TYPES.has(l.type) && !/^A new era dawns/.test(msg)) {
      add('news', { tone: l.type === LogTypes.CRISIS ? 'danger' : l.type === LogTypes.COMBAT ? 'enemy' : 'muted', title: msg, sub: null, place: placeIn(after, msg) });
    }
  });

  // Contacts.
  newContacts(after, new Set(Object.keys(before.fog?.met?.[me] || {}))).forEach((id) => {
    const card = contactCard(after, id);
    if (!card) return;
    add('contacts', {
      tone: 'you',
      title: `Met the ${card.title}`,
      sub: `${card.mood} toward you${card.citiesSeen ? `, ${card.citiesSeen} of their cities seen` : ''}. Diplomacy is open.`,
      place: { kind: 'nation', id, name: card.capitalSeen && card.capital ? card.capital : 'Peoples' }
    });
  });

  // Cities: founded, taken, lost, grown.
  const was = before.regions || {}; const now = after.regions || {};
  const grown = [];
  Object.values(now).forEach((c) => {
    const old = was[c.id];
    if (c.owner === me && !old) add('cities', { tone: 'good', title: `${c.name} founded`, sub: 'A new city of yours.', place: { kind: 'city', id: c.id, name: c.name } });
    else if (c.owner === me && old && old.owner !== me) add('cities', { tone: 'good', title: `${c.name} is yours`, sub: `Taken from the ${after.nations?.[old.owner]?.name || 'enemy'}.`, place: { kind: 'city', id: c.id, name: c.name } });
    else if (old && old.owner === me && c.owner !== me) add('cities', { tone: 'danger', title: `${c.name} lost`, sub: `Now held by the ${after.nations?.[c.owner]?.name || 'enemy'}.`, place: { kind: 'city', id: c.id, name: c.name } });
    else if (c.owner === me && old && (c.size || 1) > (old.size || 1)) grown.push(c);
  });
  Object.values(was).forEach((old) => { if (old.owner === me && !now[old.id]) add('cities', { tone: 'danger', title: `${old.name} is gone`, sub: 'Razed or abandoned.', place: null }); });
  if (grown.length) {
    add('cities', {
      tone: 'good', growth: true,
      title: grown.length === 1 ? `${grown[0].name} grew to size ${grown[0].size}` : `${grown.length} cities grew`,
      sub: grown.length === 1 ? null : grown.slice(0, 4).map((c) => `${c.name} ${c.size}`).join(', '),
      place: { kind: 'city', id: grown[0].id, name: grown[0].name }
    });
  }

  // Research.
  const knew = before.techTree || {};
  Object.keys(after.techTree || {}).filter((id) => after.techTree[id]?.researched && !knew[id]?.researched).forEach((id) => {
    add('research', { tone: 'science', title: `${TECH_TREE[id]?.name || id} learned`, sub: null, place: { kind: 'tab', id: 'tech', name: 'Research' } });
  });
  if (after.age !== before.age) add('news', { tone: 'you', title: `The world enters the ${AGES[after.age]?.name || after.age}`, sub: null, place: null });

  const counts = Object.fromEntries(REPORT_GROUPS.map((g) => [g.id, items.filter((i) => i.group === g.id).length]));
  const quiet = items.every((i) => i.group === 'research' || i.growth);
  const turns = after.turnNumber - before.turnNumber;
  return {
    title: turns > 1 ? `Turns ${before.turnNumber} to ${after.turnNumber - 1}` : `Turn ${before.turnNumber} report`,
    year: fmtYear(after.year),
    turns,
    nextTurn: after.turnNumber,
    items,
    counts,
    groups: REPORT_GROUPS.filter((g) => counts[g.id] > 0),
    quiet
  };
};
