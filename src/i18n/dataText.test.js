// src/i18n/dataText.test.js
// Hebrew for the game data (phase H4) and every proper name (phase H4b): each id in src/data has a
// Hebrew text, no Hebrew text holds a Latin letter, and no name the Hebrew UI can show holds one.
import { describe, it, expect } from 'vitest';
import { dataText, dataTable } from './core';
import { nameOf } from './names';
import * as G from './gameText';
import { TECH_TREE } from '../data/techTree';
import { BUILDING_CATEGORIES, EXTRACTION_BUILDINGS } from '../data/buildings';
import { LAW_CATEGORIES } from '../data/laws';
import { GOVERNMENT_TYPES, GOVERNMENT_REFORMS } from '../data/government';
import { RESOURCES } from '../data/resources';
import { GREAT_PROJECTS } from '../data/greatProjects';
import { ACHIEVEMENTS } from '../data/achievements';
import { STARTING_DOCTRINES } from '../data/startingDoctrines';
import { PLAYSTYLES, GOAL_NEXT_ACTION } from '../data/eraGoals';
import { CITY_STATE_TYPES } from '../data/cityStates';
import { PERSONALITIES, INDEPENDENT_TITLE_FORMS, FREE_CITY_FORMS } from '../data/independents';
import { VICTORY_CONDITIONS } from '../data/victoryConditions';
import { SPACE_MISSIONS } from '../data/spaceMissions';
import { SATELLITE_TYPES } from '../data/satellites';
import { MISSILE_TIERS } from '../data/missiles';
import { TAX_RATES } from '../data/taxRates';
import { DIFFICULTIES } from '../data/difficulty';
import { IDENTITY_AXES } from '../data/identity';
import { TRAITS } from '../data/traits';
import { PROMOTION_BRANCHES, CLASS_CAPSTONES } from '../data/promotions';
import { PERSONAS } from '../data/personas';
import { UNIT_CLASSES, UNIT_ROSTER } from '../data/unitClasses';
import { NAVAL_LINES } from '../data/navalLines';
import { SIGNATURE_UNITS } from '../data/signatureUnits';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { BOOSTS } from '../data/boosts';
import { PEOPLES_LIST } from '../data/peoples';
import { GOVERNMENT_TITLES, titleFor } from '../data/nationTitles';
import { HE_PERSONS } from './locales/data/he.names';

const LATIN = /[A-Za-zÀ-ɏ]/;
const he = dataTable('he');
const need = (key) => expect(he[key], `Hebrew text for ${key}`).toBeDefined();

describe('Hebrew game data covers every id', () => {
  it('techs, boosts, buildings, laws, governments, reforms, resources', () => {
    Object.keys(TECH_TREE).forEach((id) => need(`tech.${id}`));
    Object.keys(BOOSTS).forEach((id) => need(`boost.${id}`));
    Object.entries(BUILDING_CATEGORIES).forEach(([c, def]) => { need(`bcat.${c}`); def.tiers.forEach((_, i) => need(`btier.${c}.${i}`)); });
    Object.keys(EXTRACTION_BUILDINGS).forEach((id) => need(`bext.${id}`));
    Object.values(LAW_CATEGORIES).flat().forEach((l) => { need(`law.${l.id}`); need(`law.${l.id}.desc`); });
    Object.keys(GOVERNMENT_TYPES).forEach((id) => need(`gov.${id}`));
    Object.values(GOVERNMENT_REFORMS).flatMap((ages) => Object.values(ages).flat()).forEach((r) => { need(`reform.${r.id}`); need(`reform.${r.id}.desc`); });
    Object.keys(RESOURCES).forEach((id) => { need(`res.${id}`); need(`res.${id}.desc`); });
  });
  it('wonders, goals, achievements, doctrines, independents, victories, space, tax, difficulty, identity', () => {
    Object.keys(GREAT_PROJECTS).forEach((id) => { need(`gp.${id}`); need(`gp.${id}.desc`); });
    Object.keys(PLAYSTYLES).forEach((id) => { need(`playstyle.${id}`); need(`goalunit.${id}`); need(`goalbonus.${id}`); });
    Object.keys(GOAL_NEXT_ACTION).forEach((id) => need(`goalnext.${id}`));
    Object.keys(ACHIEVEMENTS).forEach((id) => { need(`ach.${id}`); need(`ach.${id}.desc`); });
    Object.keys(STARTING_DOCTRINES).forEach((id) => { need(`doctrine.${id}`); need(`doctrine.${id}.desc`); });
    Object.keys(CITY_STATE_TYPES).forEach((id) => need(`cstype.${id}`));
    Object.keys(PERSONALITIES).forEach((id) => { need(`indep.${id}`); need(`indep.${id}.where`); });
    Object.entries(INDEPENDENT_TITLE_FORMS).forEach(([shape, bands]) => Object.keys(bands).forEach((b) => need(`indep.form.${shape}.${b}`)));
    Object.keys(FREE_CITY_FORMS).forEach((b) => need(`indep.form.free.${b}`));
    Object.keys(VICTORY_CONDITIONS).forEach((id) => { need(`victory.${id}`); need(`victory.${id}.desc`); });
    SPACE_MISSIONS.forEach((m) => { need(`space.${m.id}`); need(`space.${m.id}.desc`); });
    Object.keys(SATELLITE_TYPES).forEach((id) => { need(`sat.${id}`); need(`sat.${id}.desc`); });
    Object.keys(MISSILE_TIERS).forEach((id) => need(`missile.${id}`));
    Object.keys(TAX_RATES).forEach((id) => { need(`tax.${id}`); need(`tax.${id}.desc`); });
    Object.keys(DIFFICULTIES).forEach((id) => { need(`diff.${id}`); need(`diff.${id}.desc`); });
    Object.keys(IDENTITY_AXES).forEach((id) => { need(`ident.${id}.pos`); need(`ident.${id}.neg`); need(`ident.${id}.desc`); });
  });
  it('traits, promotions, personas, unit classes, the roster, ships and signature units', () => {
    Object.keys(TRAITS).forEach((id) => { need(`trait.${id}`); need(`trait.${id}.desc`); });
    Object.values(PROMOTION_BRANCHES).forEach((b) => { need(`branch.${b.id}`); Object.keys(b.perks).forEach((p) => { need(`perk.${p}`); need(`perk.${p}.desc`); }); });
    Object.values(CLASS_CAPSTONES).forEach((c) => { need(`perk.${c.id}`); need(`perk.${c.id}.desc`); });
    Object.keys(PERSONAS).forEach((id) => { need(`persona.${id}`); need(`persona.${id}.desc`); });
    Object.keys(UNIT_CLASSES).forEach((id) => { need(`uclass.${id}`); need(`uclass.${id}.role`); });
    Object.entries(UNIT_ROSTER).forEach(([age, classes]) => Object.keys(classes).forEach((c) => need(`unit.${age}.${c}`)));
    Object.keys(NAVAL_LINES).forEach((line) => { need(`naval.${line}`); need(`naval.${line}.role`); NAVAL_LINES[line].names.forEach((_, i) => need(`navalship.${line}.${i}`)); });
    Object.keys(SIGNATURE_UNITS).forEach((id) => need(`sig.${id}`));
  });
  it('events: every historical event, chain event and procedural template', () => {
    [...Object.values(HISTORICAL_EVENTS), ...Object.values(EVENT_CHAINS)].forEach((e) => {
      need(`evt.${e.id}.title`); need(`evt.${e.id}.desc`);
      e.options.forEach((_, i) => need(`evt.${e.id}.opt${i}`));
    });
    ['coastal_trade_boom', 'overcrowded_plague', 'frontier_raiders', 'ambitious_general', 'failed_harvest', 'river_flood', 'foreign_quarter', 'traveling_merchants', 'refugee_crisis', 'harsh_winter'].forEach((id) => {
      need(`pevt.${id}.title`); need(`pevt.${id}.desc`); need(`pevt.${id}.opt0`); need(`pevt.${id}.opt1`);
    });
  });
  it('no Latin letters in any Hebrew data text (only {variables})', () => {
    for (const [key, text] of Object.entries(he)) expect(text.replace(/\{\w+\}/g, ''), key).not.toMatch(LATIN);
  });
  it('the helpers return English in English and the lookup in Hebrew, English when missing', () => {
    expect(dataText('tech.science_geometry', 'Geometry', null, 'en')).toBe('Geometry');
    expect(dataText('tech.science_geometry', 'Geometry', null, 'he')).toBe('גאומטריה');
    expect(dataText('tech.no_such', 'Fallback', null, 'he')).toBe('Fallback');
    expect(dataText('pevt.coastal_trade_boom.desc', 'x', { city: 'כיש' }, 'he')).toContain('כיש');
    // helpers read the current language: English here
    expect(G.techName('science_geometry', 'Geometry')).toBe('Geometry');
    expect(G.eventTitle({ id: 'great_flood_myth', title: 'The Great Flood' })).toBe('The Great Flood');
  });
});

describe('every proper name is Hebrew in Hebrew mode (H4b)', () => {
  const noLatin = (s, what) => expect(s, what).not.toMatch(LATIN);
  it('all peoples, their picker names and adjectives-based titles under every government', () => {
    for (const p of PEOPLES_LIST) {
      noLatin(nameOf('people', p.id, p.name, 'he'), `people ${p.id}`);
      for (const gov of Object.keys(GOVERNMENT_TITLES)) {
        for (const cities of [1, 15]) {
          // the game's own title for this people, government and size
          const english = titleFor(p, gov, cities);
          const hebrew = nameOf('people', p.id, english, 'he');
          noLatin(hebrew, `${p.id} ${gov} ${cities}: ${english}`);
          expect(hebrew.length, english).toBeGreaterThan(0);
          expect(hebrew, `${english} must not stay English`).not.toBe(english);
        }
      }
    }
  });
  it('independents take their Hebrew forms', () => {
    for (const p of PEOPLES_LIST.slice(0, 40)) {
      for (const [shape, bands] of Object.entries(INDEPENDENT_TITLE_FORMS)) {
        for (const tpl of Object.values(bands)) {
          const english = tpl.replaceAll('{people}', p.adjective).replaceAll('{city}', p.capital.name).replace(/^./, (c) => c.toUpperCase());
          noLatin(nameOf('people', p.id, english, 'he'), `${shape}: ${english}`);
        }
      }
    }
    expect(nameOf('people', null, 'The free city of Kish', 'he')).toBe('העיר החופשית כיש');
  });
  it('every city of every people, with the Hebrew table for the capitals', () => {
    for (const p of PEOPLES_LIST) {
      for (const c of p.cities) noLatin(nameOf('city', null, c, 'he'), `city ${c} of ${p.id}`);
      expect(nameOf('city', null, p.capital.name, 'he').length).toBeGreaterThan(0);
    }
  });
  it('rulers, dynasties, generals, regiments, battles, rivers and seas', () => {
    Object.values(HE_PERSONS).forEach((v) => noLatin(v, 'person'));
    for (const n of ['William', 'al-Rashid', 'de la Vega', 'Commander 7', 'Zbigniew']) noLatin(nameOf('person', null, n, 'he'), n);
    expect(nameOf('person', null, 'Commander 7', 'he')).toBe('מפקד 7');
    const places = ['Kish', 'the Nile', 'the border', 'Maiden Castle', 'the Bol’shaya Kuonamka'];
    for (const pl of places) {
      for (const prefix of ['Battle of', 'Siege of', 'Sea battle off', 'Landing at', 'Raid on', 'Sack of', 'Sally from', 'Revolt in']) {
        const he1 = nameOf('battle', null, `${prefix} ${pl}`, 'he');
        noLatin(he1, `${prefix} ${pl}`);
        expect(he1, `${prefix} ${pl} stays English`).not.toBe(`${prefix} ${pl}`);
      }
    }
    expect(nameOf('battle', null, 'Battle of Kish', 'he')).toBe('הקרב על כיש');
    expect(nameOf('battle', null, 'Sea battle off the Nile', 'he')).toBe('הקרב הימי מול הנילוס');
    for (const w of ['Nile', 'Euphrates', 'Mediterranean Sea', 'Yangtze', 'Olenekskaya Protoka']) noLatin(nameOf('place', null, w, 'he'), w);
  });
});

