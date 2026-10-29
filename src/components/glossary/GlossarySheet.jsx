// src/components/glossary/GlossarySheet.jsx
// The glossary sheet (differentiation plan U30): one small card for a people, city, tech, unit or
// game term, opened by a GlossaryLink anywhere (openGlossary). Links inside it open the next entry.
// openGlossary('index') (Menu and Help) opens the index: a search and the lists by kind; every
// entry has a way back to it.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { OPEN_GLOSSARY } from '../ui/uiEvents';
import { SheetHeader } from '../ui/atlas';
import { useInteraction, useDismissOverlays, PRIORITY } from '../../hooks/useExclusivePanel';
import { useT } from '../../i18n/useT';
import { ageName } from '../../i18n';
import { rich } from '../../i18n/rich';
import { AGES } from '../../data/ages';
import { TECH_TREE } from '../../data/techTree';
import { glossaryEntry, glossaryIds, GLOSSARY_TERMS, GLOSSARY_TOPICS } from '../../data/glossary';
import { ACTION_COSTS } from '../../data/actionCosts';
import { costLine } from '../panels/empireText';
import GlossaryLink, { UnlocksLine } from './GlossaryLink';
import { describeTech } from '../panels/researchView';
import { boostLabel, buildingTierName, buildingCategoryLabel, tileResourceName, improvementName } from '../../i18n/gameText';
import { describeTierEffects } from '../../data/buildings';

// An English tile resource name falls back to its id ("copper"): a title starts with a capital.
const resName = (id) => { const n = tileResourceName(id); return n.charAt(0).toUpperCase() + n.slice(1); };
const joined = (nodes) => nodes.flatMap((n, i) => (i ? [', ', n] : [n]));
// The prices the diplomacy topic names, read from the cost table so the card never drifts from it.
const termVars = () => ({ trade: costLine(ACTION_COSTS.tradeAgreement), borders: costLine(ACTION_COSTS.openBorders), gift: costLine(ACTION_COSTS.giftBribe), pact: costLine(ACTION_COSTS.militaryAlliance), demand: costLine(ACTION_COSTS.demand), warCause: costLine(ACTION_COSTS.declareWarJustified), war: costLine(ACTION_COSTS.declareWarUnjustified) });
const INDEX_TABS = ['term', 'people', 'tech', 'unit', 'building', 'resource', 'improvement'];
const SEARCH_LIMIT = 40;

const GlossarySheet = () => {
  const { t, lang, name: nm, dt } = useT();
  const [cur, setCur] = useState(null); // { kind, id }
  useEffect(() => {
    const onOpen = (e) => setCur(e.detail);
    const onKey = (e) => { if (e.key === 'Escape') setCur(null); };
    window.addEventListener(OPEN_GLOSSARY, onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(OPEN_GLOSSARY, onOpen); window.removeEventListener('keydown', onKey); };
  }, []);
  const isIndex = cur?.kind === 'index';
  const e = cur && !isIndex && glossaryEntry(cur.kind, cur.id);
  const card = useInteraction('glossary', !!e || isIndex, { priority: PRIORITY.sheet, user: true, label: t('gloss.wait') });
  useDismissOverlays(() => setCur(null), !!e || isIndex);
  const [tab, setTab] = useState('term');
  const [query, setQuery] = useState('');
  // Every entry's shown name, by kind (cities only through the search: there are hundreds).
  const names = useMemo(() => {
    if (!isIndex) return null;
    const label = (kind, id) => {
      const x = glossaryEntry(kind, id);
      if (kind === 'term') return t(`gloss.term.${id}`);
      if (kind === 'people') return nm('people', id, x.name);
      if (kind === 'city') return nm('city', null, id);
      if (kind === 'tech') return dt(`tech.${id}`, x.name);
      if (kind === 'building') return buildingTierName(x.categoryId, x.tierIndex, x.name);
      if (kind === 'resource') return resName(id);
      if (kind === 'improvement') return improvementName(id, x.name);
      return dt(`unit.${x.ageId}.${x.classId}`, x.name);
    };
    return Object.fromEntries([...INDEX_TABS, 'city'].map((kind) => [kind, (kind === 'term' ? GLOSSARY_TERMS : glossaryIds(kind)).map((id) => ({ kind, id, name: label(kind, id) }))]));
  }, [isIndex, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!(e || isIndex) || !card.shown) return null;

  const close = () => setCur(null);
  const toIndex = () => setCur({ kind: 'index' });
  const frame = (title, subtitle, body) => (
    <div className="fixed inset-0 z-[56] bg-black/50 flex items-center justify-center p-3 sheet-backdrop" onClick={close} data-testid="glossary-sheet">
      <div role="dialog" aria-modal="true" aria-labelledby="glossary-title" onClick={(ev) => ev.stopPropagation()}
        className="sheet-panel fa-sheet w-full max-w-md max-h-[92dvh] flex flex-col rounded-[10px] border border-fa-line shadow-2xl">
        <SheetHeader title={title} subtitle={subtitle} titleId="glossary-title" onClose={close} />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2 text-[13px] text-fa-muted">{body}</div>
      </div>
    </div>
  );

  if (isIndex) {
    const q = query.trim().toLowerCase();
    const list = q ? Object.values(names).flat().filter((x) => x.name.toLowerCase().includes(q)).slice(0, SEARCH_LIMIT) : names[tab];
    return frame(t('gloss.wait'), null, (<>
      <div className="relative sticky top-0 bg-fa-panel pt-0.5 pb-1 z-[1]">
        <Search className="w-4 h-4 absolute start-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder={t('gloss.search')} aria-label={t('gloss.search')} className="fa-input w-full !ps-8" data-testid="glossary-search" />
      </div>
      {!q && tab === 'term' && <p className="text-[12px]" data-testid="glossary-hold-hint">{t('gloss.holdHint')}</p>}
      {!q && (
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('gloss.wait')}>
          {INDEX_TABS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`glossary-tab-${k}`}
              className={`rounded-full border px-3 min-h-[36px] text-[12px] ${tab === k ? 'border-fa-brass bg-fa-raised text-fa-text' : 'border-fa-line'}`}>{t(`gloss.tab.${k}`)}</button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-fa-line" data-testid="glossary-index">
        {list.map((x) => (
          <li key={`${x.kind}:${x.id}`}>
            <button type="button" onClick={() => setCur({ kind: x.kind, id: x.id })} className="w-full text-start min-h-[44px] px-1 flex items-center justify-between gap-2 hover:bg-fa-raised text-fa-text">
              <span className="truncate">{x.name}</span>{q && <span className="text-[11px] text-fa-muted shrink-0">{t(`gloss.${x.kind}`)}</span>}
            </button>
          </li>
        ))}
        {!list.length && <li className="py-2">{t('gloss.none')}</li>}
      </ul>
    </>));
  }

  const age = (id) => ageName(id, AGES[id]?.name);
  const people = (id, english) => nm('people', id, english);
  const city = (c) => nm('city', null, c);
  const yieldList = (y) => Object.entries(y || {}).map(([k, v]) => `+${v} ${t(`mx.tile.${k}`)}`).join(', ');
  const needsLine = (techId) => techId && TECH_TREE[techId] && <p>{rich(t('gloss.needs'), { list: techLink(TECH_TREE[techId]) })}</p>;
  const techLink = (r) => <GlossaryLink key={r.id} kind="tech" id={r.id}>{dt(`tech.${r.id}`, r.name)}</GlossaryLink>;
  let title = e.name;
  let body;
  if (e.kind === 'people') {
    title = people(e.id, e.name);
    body = (<>
      {e.note && <p>{e.note[lang] || e.note.en}{e.uncertain && <small className="ml-1 opacity-70">({t('gloss.uncertain')})</small>}</p>}
      {e.founded ? <p>{e.founded[lang] || e.founded.en}</p> : e.capital && e.land && <p>{t('gloss.trueStart', { capital: city(e.capital), land: nm('land', null, e.land) })}</p>}
      <p>{rich(t('gloss.otherCities'), { list: joined(e.cities.slice(1).map((c) => <GlossaryLink key={c} kind="city" id={c}>{city(c)}</GlossaryLink>)) })}</p>
    </>);
  } else if (e.kind === 'city') {
    title = city(e.name);
    const link = <GlossaryLink kind="people" id={e.peopleId}>{people(e.peopleId, e.people)}</GlossaryLink>;
    body = <p>{rich(t(e.capital ? 'gloss.capitalOf' : 'gloss.cityOf'), { city: city(e.name), people: link })}</p>;
  } else if (e.kind === 'tech') {
    title = dt(`tech.${e.id}`, e.name);
    body = (<>
      <p>{t('gloss.techLine', { age: age(e.ageId) })}</p>
      <p className="text-fa-text">{t('gloss.gives', { text: describeTech(e) })}</p>
      <UnlocksLine techId={e.id} className="text-fa-text" testId="glossary-unlocks" />
      {e.boost && <p className="text-fa-good">{t('gloss.boost', { label: boostLabel(e.id, e.boost) })}</p>}
      {e.prerequisites.length > 0 && <p>{rich(t('gloss.needs'), { list: joined(e.prerequisites.map(techLink)) })}</p>}
      {e.leadsTo.length > 0 && <p>{rich(t('gloss.leadsTo'), { list: joined(e.leadsTo.map(techLink)) })}</p>}
    </>);
  } else if (e.kind === 'building') {
    title = buildingTierName(e.categoryId, e.tierIndex, e.name);
    body = (<>
      <p>{t('gloss.buildingLine', { line: buildingCategoryLabel(e.categoryId, e.categoryLabel), age: age(e.ageId) })}</p>
      {describeTierEffects(e.categoryId, e.tierIndex) && <p className="text-fa-text">{t('gloss.gives', { text: describeTierEffects(e.categoryId, e.tierIndex) })}</p>}
      {needsLine(e.requiresTech)}
    </>);
  } else if (e.kind === 'resource') {
    title = resName(e.id);
    body = (<>
      <p>{t(`gloss.res.${e.type}`)}</p>
      <p className="text-fa-text">{rich(t('gloss.workedBy'), { yields: yieldList(e.yields), link: <GlossaryLink kind="improvement" id={e.improvement}>{improvementName(e.improvement, glossaryEntry('improvement', e.improvement)?.name)}</GlossaryLink> })}</p>
      {e.knownTech && TECH_TREE[e.knownTech] && <p>{rich(t('gloss.seenWith'), { tech: techLink(TECH_TREE[e.knownTech]) })}</p>}
      {e.knownAge && <p>{t('gloss.seenFrom', { age: age(e.knownAge) })}</p>}
    </>);
  } else if (e.kind === 'improvement') {
    title = improvementName(e.id, e.name);
    body = (<>
      <p>{t('gloss.improvementLine', { n: e.turns })}</p>
      <p className="text-fa-text">{t('gloss.gives', { text: yieldList(e.yields) })}</p>
      {e.resources.length > 0 && <p>{rich(t('gloss.works'), { list: joined(e.resources.map((r) => <GlossaryLink key={r} kind="resource" id={r}>{tileResourceName(r)}</GlossaryLink>)) })}</p>}
      {needsLine(e.requiresTech)}
      {e.upgrades.length > 0 && <p>{rich(t('gloss.moreWith'), { list: joined(e.upgrades.filter((u) => TECH_TREE[u]).map((u) => techLink(TECH_TREE[u]))) })}</p>}
    </>);
  } else if (e.kind === 'term') {
    title = t(`gloss.term.${e.id}`);
    body = (<>
      {t(`gloss.term.${e.id}.text`, termVars()).split('\n').map((line) => <p key={line} className="text-fa-text">{line}</p>)}
      {GLOSSARY_TOPICS[e.id] && <p data-testid="glossary-see-also">{rich(t('gloss.seeAlso'), { list: joined(GLOSSARY_TOPICS[e.id].map((id) => <GlossaryLink key={id} kind="term" id={id}>{t(`gloss.term.${id}`)}</GlossaryLink>)) })}</p>}
    </>);
  } else {
    title = dt(`unit.${e.ageId}.${e.classId}`, e.name);
    body = (<>
      <p>{t('gloss.unitLine', { class: dt(`uclass.${e.classId}`, e.classId), age: age(e.ageId) })}</p>
      <p>{dt(`uclass.${e.classId}.role`, e.role)}</p>
      <p>{t('gloss.power', { attack: e.attack, defense: e.defense })}</p>
      {needsLine(e.needsTech)}
    </>);
  }
  return frame(title, t(`gloss.${e.kind}`), (<>
    <button type="button" onClick={toIndex} className="min-h-[36px] -ms-1 px-1 flex items-center gap-1 text-[12px] text-fa-you underline" data-testid="glossary-to-index"><ChevronLeft className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />{t('gloss.index')}</button>
    {body}
  </>));
};

export default GlossarySheet;
