// src/components/glossary/GlossarySheet.jsx
// The glossary sheet (differentiation plan U30): one small card for a people, city, tech or unit,
// opened by a GlossaryLink anywhere (openGlossary). Links inside it open the next entry.
import React, { useEffect, useState } from 'react';
import { OPEN_GLOSSARY } from '../ui/uiEvents';
import { SheetHeader } from '../ui/atlas';
import { useInteraction, useDismissOverlays, PRIORITY } from '../../hooks/useExclusivePanel';
import { useT } from '../../i18n/useT';
import { ageName } from '../../i18n';
import { rich } from '../../i18n/rich';
import { AGES } from '../../data/ages';
import { glossaryEntry } from '../../data/glossary';
import GlossaryLink from './GlossaryLink';

const joined = (nodes) => nodes.flatMap((n, i) => (i ? [', ', n] : [n]));

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
  const e = cur && glossaryEntry(cur.kind, cur.id);
  const card = useInteraction('glossary', !!e, { priority: PRIORITY.sheet, user: true, label: t('gloss.wait') });
  useDismissOverlays(() => setCur(null), !!e);
  if (!e || !card.shown) return null;

  const age = (id) => ageName(id, AGES[id]?.name);
  const people = (id, english) => nm('people', id, english);
  const city = (c) => nm('city', null, c);
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
      {e.prerequisites.length > 0 && <p>{rich(t('gloss.needs'), { list: joined(e.prerequisites.map((r) => <GlossaryLink key={r.id} kind="tech" id={r.id}>{dt(`tech.${r.id}`, r.name)}</GlossaryLink>)) })}</p>}
    </>);
  } else {
    title = dt(`unit.${e.ageId}.${e.classId}`, e.name);
    body = (<>
      <p>{t('gloss.unitLine', { class: dt(`uclass.${e.classId}`, e.classId), age: age(e.ageId) })}</p>
      <p>{dt(`uclass.${e.classId}.role`, e.role)}</p>
      <p>{t('gloss.power', { attack: e.attack, defense: e.defense })}</p>
    </>);
  }
  const close = () => setCur(null);
  return (
    <div className="fixed inset-0 z-[56] bg-black/50 flex items-center justify-center p-3 sheet-backdrop" onClick={close} data-testid="glossary-sheet">
      <div role="dialog" aria-modal="true" aria-labelledby="glossary-title" onClick={(ev) => ev.stopPropagation()}
        className="sheet-panel fa-sheet w-full max-w-md max-h-[92dvh] flex flex-col rounded-[10px] border border-fa-line shadow-2xl">
        <SheetHeader title={title} subtitle={t(`gloss.${e.kind}`)} titleId="glossary-title" onClose={close} />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2 text-[13px] text-fa-muted">{body}</div>
      </div>
    </div>
  );
};

export default GlossarySheet;
