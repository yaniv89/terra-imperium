// src/components/panels/researchSheetModel.js
// What the Research sheet (W09, plans/UI-DESIGN.md) shows beyond researchView.js, as a pure model:
//   header   your age, how many of its techs you know and how many more bring the next age
//   current  the tech under way, its bar, and a boost that is met but not yet paid (it lands at
//            the end of the turn) drawn as a striped part of the same bar
//   boosts   the map facts that would speed up the techs you research or could start now: met
//            ones first ("waits in X"), then the rest, each with where on the map to look
//   ages     the age strip: techs known of each age's total, the age you are in
//   era      the era goals of your age (met of needed) for the side card
import { TECH_TREE } from '../../data/techTree';
import { AGES, AGE_ORDER } from '../../data/ages';
import { BOOSTS, BOOST_SHARE } from '../../data/boosts';
import { ERA_LEGACY_TURNS } from '../../data/eraGoals';
import { eraGoalProgress } from '../../engine/eraGoals';
import { nationFacts, boostOf } from '../../engine/boosts';
import { canStartTech } from '../../engine/research';
import { fundQuote } from '../../engine/spending';
import { getResearchView, researchedSet } from './researchView';
import { techName } from '../../i18n/gameText';
import { t as tNow, hasKey, ageName } from '../../i18n/core';
import { ageOf } from '../../engine/nationState';
import { ageProgress } from '../ui/ageProgress';

// Where a boost's fact lives on the map: a lens to switch on, or a sheet to open. Settling claims
// land (rivers, coast, resources, forest, hills); a city's size shows in the yields lens; roads in
// the supply lens; a trade agreement is made with a people.
export const boostTarget = (label = '') => {
  if (/trade agreement|Trade with/i.test(label)) return { kind: 'tab', tab: 'diplomacy', label: tNow('rail.diplomacy') };
  if (/Grow a city/i.test(label)) return { kind: 'lens', lens: 'yields', label: tNow('p2.bt.map') };
  if (/road/i.test(label)) return { kind: 'lens', lens: 'supply', label: tNow('p2.bt.map') };
  if (/river|coastal|Rule \d|forest|hill|Own (?!a harbour)/i.test(label)) return { kind: 'lens', lens: 'settle', label: tNow('p2.bt.map') };
  return null;
};

// "Bronze", "Kingdoms": an age's name without "Age" for the strip and the era card.
export const shortAge = (ageId) => {
  const english = (AGES[ageId]?.name || ageId || '').replace(/^Age of (the )?/i, '').replace(/ Age$/i, '');
  return hasKey(`p2.ageShort.${ageId}`, 'en') ? tNow(`p2.ageShort.${ageId}`) : english;
};

export const researchSheetModel = (state) => {
  const view = getResearchView(state);
  const researched = researchedSet(state);
  const progress = ageProgress(state);
  const techAge = progress.ageId;
  const all = Object.values(TECH_TREE);
  const ages = AGE_ORDER.map((ageId) => {
    const techs = all.filter((t) => t.ageId === ageId);
    return { ageId, name: shortAge(ageId), total: techs.length, known: techs.filter((t) => researched.has(t.id)).length, current: ageId === techAge };
  });

  // The boosts worth showing: the current tech, the queue, and every tech you could start now.
  const facts = nationFacts(state, state.playerNationId);
  const order = [view.current?.tech.id, ...view.queue.map((q) => q.tech.id)].filter(Boolean);
  const startable = all.filter((t) => !researched.has(t.id) && !order.includes(t.id) && canStartTech(t.id, researched, ageOf(state, state.playerNationId)).ok).map((t) => t.id);
  const boosts = [...order, ...startable]
    .filter((id) => BOOSTS[id])
    .map((id) => ({ techId: id, techName: techName(id, TECH_TREE[id].name), planned: order.includes(id), ...boostOf(state, state.playerNationId, id, facts) }))
    .filter((b) => !b.taken)
    .map((b) => ({ ...b, share: Math.round(BOOST_SHARE * 100), target: b.met ? null : boostTarget(b.label) }))
    .sort((a, b) => (b.met - a.met) || (b.planned - a.planned));

  let current = null;
  if (view.current) {
    const c = view.current;
    const b = boostOf(state, state.playerNationId, c.tech.id, facts);
    const pending = b && b.met && !b.taken ? Math.min(c.cost - c.progress, Math.round(c.cost * BOOST_SHARE)) : 0;
    current = { ...c, boost: b, pendingBoost: pending, pendingShare: pending > 0 ? Math.round(BOOST_SHARE * 100) : 0 };
  }

  const era = eraGoalProgress(state);
  return {
    fund: fundQuote(state), // gold for science, once a turn (spending.js)
    science: view.science,
    bank: view.bank,
    auto: view.auto,
    status: view.status,
    current,
    queue: view.queue,
    // Your age only: it rises with your research, and the next one comes with a share of its techs (KTD1).
    header: { ageName: ageName(techAge, AGES[techAge]?.name || techAge), known: progress.known, total: progress.total, nextAgeName: progress.nextAgeId ? shortAge(progress.nextAgeId) : null, techsLeft: progress.techsLeft },
    boosts,
    ages,
    era: {
      ageName: shortAge(era.ageId),
      met: era.met,
      needed: era.needed,
      legacyTurns: ERA_LEGACY_TURNS,
      goals: era.goals
    }
  };
};
