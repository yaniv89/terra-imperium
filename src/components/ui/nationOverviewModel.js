// src/components/ui/nationOverviewModel.js
// The nation overview (W17, plans/UI-DESIGN.md): the player's nation at a glance, opened from the
// name on the top bar. Pure; reads only what the engine keeps:
//   ruler        name and ADM / DIP / MIL (one ruler for the whole game, differentiation plan U5)
//   government   the type and its reforms, the title, the next title (the realm form at
//                EMPIRE_CITY_COUNT cities, nationTitles.js)
//   stability    -3 to +3, legitimacy of 100, and authority with its parts as the reasons
//   victory      how far each victory is: capitals held, cities held, share of the world's gold,
//                the score rank
//   era goals    your age's goals (met of needed, each with its legacy)
//   age          the age strip and when the next age begins at this pace
import { AGE_ORDER } from '../../data/ages';
import { getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from '../../data/techTree';
import { ageOf, getResearched } from '../../engine/nationState';
import { PEOPLES } from '../../data/peoples';
import { titleFor, EMPIRE_CITY_COUNT } from '../../data/nationTitles';
import { getGovernmentType, getActiveReforms } from '../../data/government';
import { getCapital, getNationCapital } from '../../data/regions';
import { DOMINATION_CAPITAL_SHARE } from '../../data/victoryConditions';
import { PLAYSTYLES, ERA_LEGACY_TURNS } from '../../data/eraGoals';
import { authorityOf } from '../../engine/authority';
import { eraGoalProgress } from '../../engine/eraGoals';
import { STABILITY_MIN, STABILITY_MAX } from '../../engine/nationalPower';
import { rankNations } from '../../engine/score';
import { t as tNow } from '../../i18n';
import { nameNow } from '../../i18n/names';
import { governmentName, reformName, reformDescription, playstyleName, goalUnit, goalBonus } from '../../i18n/gameText';
import { authorityPartLabel, poolLabel, ageShort } from '../panels/empireText';

const shortAge = ageShort;

export const nationOverviewModel = (state) => {
  const me = state.playerNationId;
  const n = state.nations?.[me];
  if (!n) return null;
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me);
  const capital = state.regions?.[n.capitalRegionId];
  const people = PEOPLES[me];
  const govType = n.government?.type || 'tribal';

  const r = n.ruler || null;
  const ruler = r ? {
    name: nameNow('person', null, r.name),
    skills: [
      { id: 'adm', label: poolLabel('adm'), value: r.adm || 0, hint: tNow('p1.no.hint.adm') },
      { id: 'dip', label: poolLabel('dip'), value: r.dip || 0, hint: tNow('p1.no.hint.dip') },
      { id: 'mil', label: poolLabel('mil'), value: r.mil || 0, hint: tNow('p1.no.hint.mil') }
    ]
  } : null;

  const nextTitle = people && mine.length < EMPIRE_CITY_COUNT ? titleFor(people, govType, EMPIRE_CITY_COUNT) : null;
  const government = {
    name: governmentName(govType, getGovernmentType(govType)?.name || govType),
    reforms: getActiveReforms(n).map((x) => ({ id: x.id, name: reformName(x.id, x.name), description: reformDescription(x.id, x.description) })),
    title: nameNow('people', me, n.name),
    nextTitle: nextTitle && nextTitle !== n.name ? { title: nameNow('people', me, nextTitle), cities: mine.length, needed: EMPIRE_CITY_COUNT } : null
  };

  const authority = authorityOf(state, me);
  const stability = { base: authority.parts.find((p) => p.id === 'base')?.value ?? 0, value: n.stability || 0, min: STABILITY_MIN, max: STABILITY_MAX, legitimacy: Math.round(n.legitimacy ?? 50), authority: authority.total, parts: authority.parts.filter((p) => p.id !== 'base').map((p) => ({ ...p, label: authorityPartLabel(p, n), value: Math.round(p.value) })) };

  const others = Object.values(state.nations).filter((x) => !x.isPlayer && x.id !== me);
  const held = (id) => !!id && state.regions?.[id]?.owner === me;
  const capitalsHeld = others.filter((x) => held(getCapital(state, x.id)) || held(state.scenario?.starts?.[x.id] || getNationCapital(x.id))).length;
  const capitalsNeeded = Math.ceil(others.length * DOMINATION_CAPITAL_SHARE);
  const victory = [
    { id: 'domination', label: tNow('p1.no.vic.domination'), value: capitalsHeld, target: capitalsNeeded, text: tNow('p1.no.vic.capitals', { a: capitalsHeld, b: capitalsNeeded }) }
  ];
  // The legacy ranking (legacy.js): what ranks the game at its ending.
  const ranking = rankNations(state);
  const rank = ranking.findIndex((r) => r.nationId === me) + 1;
  const ranked = ranking.length;

  const era = eraGoalProgress(state);
  // The player's own age; the next one comes with 6 of this age's 10 techs (KTD1), never a date.
  const myAge = ageOf(state, me);
  const ageIndex = Math.max(0, AGE_ORDER.indexOf(myAge));
  const nextAge = AGE_ORDER[ageIndex + 1] || null;
  const known = new Set(getResearched(state, me));
  const techsLeft = nextAge ? Math.max(1, TECH_AGE_ADVANCEMENT_THRESHOLD - getTechsForAge(myAge).filter((t) => known.has(t.id)).length) : null;

  return {
    name: nameNow('people', me, n.name),
    color: n.color || '#5B9BF0',
    cities: mine.length,
    capital: capital?.owner === me ? nameNow('city', null, capital.name) : null,
    ageName: shortAge(myAge),
    ruler,
    government,
    stability,
    victory,
    score: { rank, of: ranked },
    era: { ageName: shortAge(era.ageId), met: era.met, needed: era.needed, legacyTurns: ERA_LEGACY_TURNS, goals: era.goals.map((g) => ({ ...g, label: playstyleName(g.id, g.label), unit: goalUnit(g.id, g.unit), bonus: PLAYSTYLES[g.id] ? goalBonus(g.id, PLAYSTYLES[g.id].bonusLabel) : '' })) },
    ages: AGE_ORDER.map((id, i) => ({ id, name: shortAge(id), past: i < ageIndex, current: i === ageIndex })),
    nextAge: nextAge ? { name: shortAge(nextAge), techs: techsLeft } : null,
    turn: state.turnNumber
  };
};
