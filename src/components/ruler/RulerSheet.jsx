// src/components/ruler/RulerSheet.jsx
// The Ruler tab (RULER-PLAN 6.2, differentiation plan U14): header, decrees, the ambitions of the age,
// the six attributes, the Virtue tree with a detail bar whose one brass button takes the virtue,
// and the last deeds. It is tab content in the dock, so the dock already registers with
// useInteraction (PanelDrawer.jsx). 44 px targets throughout (844 x 390 reference).
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Check, Lock } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { useT } from '../../i18n/useT';
import { dataText, getLanguage, ageName } from '../../i18n/core';
import { askConfirm } from '../ui/ConfirmActionDialog';
import { virtueConfirm } from '../ui/confirmSpecs';
import { nameNow } from '../../i18n/names';
import { rulerSheetModel } from './rulerSheetModel';
import { rulerPortrait } from './rulerPortrait';
import { PEOPLES } from '../../data/peoples';
import { RENOWN_DEED_LABELS } from '../../data/rulers';

const mask = (url) => ({ WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center bottom', maskPosition: 'center bottom' });

const Portrait = ({ nationId, name, color }) => {
  const p = rulerPortrait(nationId, name);
  return (
    <div className="relative w-[72px] h-[72px] shrink-0 rounded-lg border border-fa-line bg-fa-raised overflow-hidden" aria-hidden="true">
      {p.art ? <img src={p.art} alt="" className="w-full h-full object-cover" /> : (
        <>
          <div className="absolute inset-x-1 top-1 bottom-0" style={{ ...mask(p.bust), background: color }} />
          <span className="absolute inset-x-0 bottom-1 text-center text-[15px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,.7)' }}>{p.initial}</span>
        </>
      )}
    </div>
  );
};

const RulerSheet = () => {
  const { state, dispatch } = useGame();
  const { t } = useT();
  const [picked, setPicked] = useState(null);
  const detailRef = useRef(null);
  // On a short phone screen the cost and the Take button sit under the fold: bring them up.
  useEffect(() => { if (picked) detailRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [picked]);
  const m = rulerSheetModel(state);
  if (!m) return null;
  const nation = state.nations[m.nationId];
  const vName = (v) => dataText(`virtue.${v.id}`, v.name);
  const sel = picked && m.branches.flatMap((b) => b.cells).find((c) => c.id === picked);
  // Two taps: the confirm card shows the cost in virtue points and what is left (playtest issue 10).
  const take = (id) => askConfirm(virtueConfirm(state, id), () => { dispatch({ type: ActionTypes.TAKE_RULER_VIRTUE, payload: { virtueId: id } }); setPicked(null); });
  const raise = (attr) => dispatch({ type: ActionTypes.RAISE_RULER_ATTRIBUTE, payload: { attr } });

  return (
    <div className="p-3 space-y-3 text-fa-text" data-testid="ruler-sheet">
      <div className="flex gap-3 items-center">
        <Portrait nationId={m.nationId} name={nameNow('person', null, m.ruler.name)} color={nation.color} />
        <div className="min-w-0 flex-1">
          <h2 className="fa-heading text-[19px] leading-tight truncate">{t('ruler.title', { name: nameNow('person', null, m.ruler.name), people: getLanguage() === 'he' ? nameNow('people', m.nationId, nation.name) : PEOPLES[m.nationId]?.name || nation.name })}</h2>
          <div className="flex items-baseline gap-2 text-[12px]">
            <span className="font-semibold">{t('ruler.level', { n: m.level })}</span>
            <span className="text-fa-muted font-mono">{m.to > m.from ? t('ruler.renown', { now: m.renown, next: m.to }) : t('ruler.renownMax', { now: m.renown })}</span>
          </div>
          <div className="h-1.5 mt-1 rounded bg-fa-raised overflow-hidden"><div className="h-full bg-fa-you" style={{ width: `${Math.round(m.pct * 100)}%` }} /></div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-fa-muted" data-testid="ruler-points">
            {m.points.attribute + m.points.virtue > 0 ? (
              <>
                {m.points.attribute > 0 && <span className="font-semibold text-fa-text">{t('ruler.attrPoints', { n: m.points.attribute })}</span>}
                {m.points.virtue > 0 && <span className="font-semibold text-fa-text">{t('ruler.virtuePoints', { n: m.points.virtue })}</span>}
              </>
            ) : <span>{t('ruler.noPoints')}</span>}
            <span className="font-mono">{t('ruler.decrees', { value: m.decrees, cap: m.decreeCap })}</span>
          </div>
        </div>
      </div>

      <section aria-label={t('ruler.ambitions')} data-testid="ruler-ambitions">
        <h3 className="text-[11px] uppercase tracking-wide text-fa-muted mb-1">{t('ruler.ambitions')}</h3>
        {m.ambitions.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {m.ambitions.map((a) => (
              <li key={a.id} className={`rounded-lg border px-2 py-1 text-[12px] flex items-center gap-1 ${a.done ? 'border-fa-good text-fa-good' : 'border-fa-line bg-fa-raised/60'}`}>
                {a.done && <Check className="w-3.5 h-3.5" aria-label={t('ruler.ambitionDone')} />}{dataText(`ambition.${a.id}`, a.label)}
              </li>
            ))}
          </ul>
        ) : <p className="text-[12px] text-fa-muted">{t('ruler.ambitionsNone')}</p>}
      </section>

      <div className="flex flex-col md:flex-row gap-3">
        <section aria-label={t('ruler.attributes')} className="md:w-[40%] shrink-0">
          <h3 className="text-[11px] uppercase tracking-wide text-fa-muted mb-1">{t('ruler.attributes')}</h3>
          <ul className="space-y-1">
            {m.attributes.map((a) => (
              <li key={a.id} className="flex items-center gap-2 min-h-[44px] rounded-lg bg-fa-raised/60 px-2" data-testid={`attr-${a.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-[13px]"><span className="font-semibold">{t(`ruler.attr.${a.id}`)}</span><span className="font-mono">{a.value}</span><span className="text-[10px] text-fa-muted font-mono">/ {a.cap}</span></div>
                  <div className="text-[11px] text-fa-muted leading-tight">{a.atCap ? t('ruler.capped') : t(`ruler.attrHelp.${a.id}`)}</div>
                </div>
                {a.can && (
                  <button type="button" onClick={() => raise(a.id)} aria-label={t('ruler.raise', { name: t(`ruler.attr.${a.id}`), n: a.value + 1, cost: a.cost })} className="fa-btn fa-btn-secondary w-11 h-11 !p-0 shrink-0">
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={t('ruler.virtues')} className="min-w-0 flex-1">
          <h3 className="text-[11px] uppercase tracking-wide text-fa-muted mb-1">{t('ruler.virtues')}</h3>
          <div className="grid grid-cols-5 gap-1" data-testid="ruler-tree">
            {m.branches.map((b) => <div key={b.id} className="text-center text-[10px] font-semibold text-fa-muted truncate">{t(`ruler.branch.${b.id}`)}</div>)}
            {m.branches[0].cells.map((_, row) => m.branches.map((b) => {
              const c = b.cells[row];
              const tone = c.state === 'taken' ? 'bg-fa-raised border-fa-text' : c.state === 'open' ? 'bg-fa-panel border-fa-line' : c.state === 'dear' ? 'bg-fa-panel border-fa-line text-fa-muted' : 'border-dashed border-fa-line text-fa-muted';
              return (
                <button key={c.id} type="button" onClick={() => setPicked(c.id)} aria-pressed={picked === c.id} data-state={c.state}
                  className={`min-h-[44px] rounded-lg border px-1 text-[10px] leading-tight flex flex-col items-center justify-center ${tone} ${picked === c.id ? 'ring-2 ring-fa-text' : ''}`}>
                  {c.state === 'locked' && <Lock className="w-3 h-3" aria-hidden="true" />}
                  {c.state === 'taken' && <Check className="w-3 h-3" aria-hidden="true" />}
                  <span className="line-clamp-2">{vName(c.virtue)}</span>
                </button>
              );
            }))}
          </div>
          <div ref={detailRef} className="mt-2 rounded-lg bg-fa-raised/60 p-2 text-[12px] min-h-[64px] scroll-mb-3" data-testid="ruler-detail">
            {sel ? (
              <>
                <div className="font-semibold">{vName(sel.virtue)} <span className="text-fa-muted font-normal font-mono">{sel.state === 'taken' ? t('ruler.virtue.taken') : t('ruler.virtue.cost', { n: sel.virtue.cost })}</span></div>
                <div>{dataText(`virtue.${sel.id}.text`, sel.virtue.text)}</div>
                {sel.virtue.drawback && <div className="text-fa-muted">{t('ruler.drawback', { text: dataText(`virtue.${sel.id}.drawback`, sel.virtue.drawback) })}</div>}
                {sel.state === 'open' && <button type="button" onClick={() => take(sel.id)} className="fa-btn fa-btn-primary mt-1.5 min-h-[44px]">{t('ruler.take', { name: vName(sel.virtue), cost: sel.virtue.cost })}</button>}
                {sel.state !== 'open' && sel.state !== 'taken' && <div className="text-fa-muted mt-1" data-testid="ruler-virtue-block">{sel.opensAge ? t('ruler.opensIn', { age: ageName(sel.opensAge) }) : t(`ruler.block.${sel.block}`)}</div>}
              </>
            ) : <span className="text-fa-muted">{t('ruler.pickVirtue')}</span>}
          </div>
          {m.ruler.traits.length > 0 && (
            <button type="button" onClick={() => dispatch({ type: ActionTypes.RESHAPE_RULER })} className="fa-btn fa-btn-secondary mt-2 min-h-[44px] w-full flex-col !gap-0 text-[12px]">
              {t('ruler.reshape')}<span className="text-[10px] text-fa-muted">{m.reshapeFree ? t('ruler.reshapeFree') : t('ruler.reshapeCost')}</span>
            </button>
          )}
        </section>
      </div>

      <section aria-label={t('ruler.deeds')} data-testid="ruler-deeds">
        <h3 className="text-[11px] uppercase tracking-wide text-fa-muted mb-1">{t('ruler.deeds')}</h3>
        {m.deeds.length ? (
          <ul className="text-[12px] space-y-0.5">
            {m.deeds.map((d, i) => <li key={i}>{t('ruler.deed.line', { turn: d.turn, label: dataText(`renown.${d.id}`, RENOWN_DEED_LABELS[d.id] || d.id), n: d.renown })}</li>)}
          </ul>
        ) : <p className="text-[12px] text-fa-muted">{t('ruler.deedsNone')}</p>}
      </section>
    </div>
  );
};

export default RulerSheet;
