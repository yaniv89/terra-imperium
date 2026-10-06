// src/components/ui/nationOverviewModel.js
// The nation overview (W17, plans/UI-DESIGN.md): the player's nation at a glance, opened from the
// name on the top bar. Pure; reads only what the engine keeps:
//   ruler        name and dynasty, turns on the throne, ADM / DIP / MIL, traits (no heirs:
//                succession went with decision 37)
//   government   the type and its reforms, the title, the next title (the realm form at
//                EMPIRE_CITY_COUNT cities, nationTitles.js)
//   stability    -3 to +3, legitimacy of 100, and authority with its parts as the reasons
//   victory      how far each victory is: capitals held, cities held, share of the world's gold,
//                the score rank
//   era goals    the calendar age's goals (met of needed, each with its legacy)
//   age          the age strip and when the next age begins at this pace
import { AGES, AGE_ORDER, getYearsPerTurn } from '../../data/ages';
import { PEOPLES } from '../../data/peoples';
import { titleFor, EMPIRE_CITY_COUNT } from '../../data/nationTitles';
import { getGovernmentType, getActiveReforms } from '../../data/government';
import { TRAITS } from '../../data/traits';
import { getCapital, getNationCapital } from '../../data/regions';
import { DOMINATION_CAPITAL_SHARE, CONQUEROR_CITY_SHARE, ECONOMIC_HEGEMONY_SHARE, getEconomicShare } from '../../data/victoryConditions';
import { PLAYSTYLES, ERA_LEGACY_TURNS } from '../../data/eraGoals';
import { authorityOf } from '../../engine/authority';
import { eraGoalProgress } from '../../engine/eraGoals';
import { STABILITY_MIN, STABILITY_MAX } from '../../engine/nationalPower';
import { getPlayerRank } from '../../engine/score';

const shortAge = (ageId) => (AGES[ageId]?.name || ageId || '').replace(/^Age of (the )?/i, '').replace(/ Age$/i, '');

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
    name: r.name,
    dynasty: r.dynasty || null,
    reignTurns: Math.max(0, (state.turnNumber || 1) - (r.reignStartTurn || state.turnNumber || 1)),
    skills: [
      { id: 'adm', label: 'ADM', value: r.adm || 0, hint: 'building, laws' },
      { id: 'dip', label: 'DIP', value: r.dip || 0, hint: 'pacts, peace' },
      { id: 'mil', label: 'MIL', value: r.mil || 0, hint: 'armies' }
    ],
    traits: (r.traits || []).map((id) => TRAITS[id]).filter(Boolean).map((t) => ({ id: t.id, name: t.name, description: t.description, bad: Object.values(t.effects || {}).some((v) => v < 0) && !Object.values(t.effects || {}).some((v) => v > 0) }))
  } : null;

  const nextTitle = people && mine.length < EMPIRE_CITY_COUNT ? titleFor(people, govType, EMPIRE_CITY_COUNT) : null;
  const government = {
    name: getGovernmentType(govType)?.name || govType,
    reforms: getActiveReforms(n).map((x) => ({ id: x.id, name: x.name, description: x.description })),
    title: n.name,
    nextTitle: nextTitle && nextTitle !== n.name ? { title: nextTitle, cities: mine.length, needed: EMPIRE_CITY_COUNT } : null
  };

  const authority = authorityOf(state, me);
  const stability = { base: authority.parts.find((p) => p.id === 'base')?.value ?? 0, value: n.stability || 0, min: STABILITY_MIN, max: STABILITY_MAX, legitimacy: Math.round(n.legitimacy ?? 50), authority: authority.total, parts: authority.parts.filter((p) => p.id !== 'base').map((p) => ({ ...p, value: Math.round(p.value) })) };

  const others = Object.values(state.nations).filter((x) => !x.isPlayer && x.id !== me);
  const held = (id) => !!id && state.regions?.[id]?.owner === me;
  const capitalsHeld = others.filter((x) => held(getCapital(state, x.id)) || held(state.scenario?.starts?.[x.id] || getNationCapital(x.id))).length;
  const capitalsNeeded = Math.ceil(others.length * DOMINATION_CAPITAL_SHARE);
  const totalCities = Object.keys(state.regions || {}).length;
  const econ = getEconomicShare(state);
  const victory = [
    { id: 'domination', label: 'Domination', value: capitalsHeld, target: capitalsNeeded, text: `${capitalsHeld} of ${capitalsNeeded} capitals` },
    { id: 'conqueror', label: 'Conqueror', value: mine.length, target: Math.ceil(totalCities * CONQUEROR_CITY_SHARE), text: `${mine.length} of ${Math.ceil(totalCities * CONQUEROR_CITY_SHARE)} cities` },
    { id: 'economic', label: 'Economic hegemony', value: Math.round(econ.share * 100), target: Math.round(ECONOMIC_HEGEMONY_SHARE * 100), text: `${Math.round(econ.share * 100)}% of ${Math.round(ECONOMIC_HEGEMONY_SHARE * 100)}% of the world's gold` }
  ];
  const rank = getPlayerRank(state);
  const ranked = Object.keys(state.nations).length;

  const era = eraGoalProgress(state);
  const ageIndex = Math.max(0, AGE_ORDER.indexOf(state.age));
  const nextAge = AGE_ORDER[ageIndex + 1] || null;
  const yearsLeft = nextAge ? AGES[nextAge].startYear - (state.year ?? AGES[state.age]?.startYear ?? 0) : 0;
  const nextIn = nextAge ? Math.max(1, Math.ceil(yearsLeft / getYearsPerTurn(state.age, state.gameSpeed))) : null;

  return {
    name: n.name,
    color: n.color || '#5B9BF0',
    cities: mine.length,
    capital: capital?.owner === me ? capital.name : null,
    ageName: shortAge(state.age),
    ruler,
    government,
    stability,
    victory,
    score: { rank, of: ranked },
    era: { ageName: shortAge(era.ageId), met: era.met, needed: era.needed, legacyTurns: ERA_LEGACY_TURNS, goals: era.goals.map((g) => ({ ...g, bonus: PLAYSTYLES[g.id]?.bonusLabel || '' })) },
    ages: AGE_ORDER.map((id, i) => ({ id, name: shortAge(id), past: i < ageIndex, current: i === ageIndex })),
    nextAge: nextAge ? { name: shortAge(nextAge), turns: nextIn } : null,
    turn: state.turnNumber
  };
};
