// src/components/chronicle/ChronicleSheet.jsx
// The Chronicle reader (differentiation plan U29): the player's story, one chapter per age with its
// border map, famous battles, cities, wars and ambitions, and a button that saves it as a PNG.
// Sits in the Legacy tab and on the game-over screen; read-only, so it needs no game action.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { ageName } from '../../i18n';
import { formatYear, dataText } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { rich } from '../../i18n/rich';
import { AGES } from '../../data/ages';
import { legacyModel } from '../panels/legacyModel';
import GlossaryLink from '../glossary/GlossaryLink';
import { chronicleModel } from './chronicleModel';
import { chronicleBox, chronicleCanvas, drawBorders, saveCanvas } from './chronicleImage';

const MapCanvas = ({ runs, box }) => {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawBorders(ctx, runs, box, 0, 0, cv.width, cv.height);
  }, [runs, box]);
  return <canvas ref={ref} width={240} height={110} className="w-full rounded bg-black/30" aria-hidden="true" />;
};

const ChronicleSheet = ({ state }) => {
  const { t, lang, rtl } = useT();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const chapters = useMemo(() => (open ? chronicleModel(state) : []), [open, state]);
  const box = useMemo(() => (open && chapters.length ? chronicleBox(chapters) : null), [open, chapters]);
  const people = nameNow('people', state.playerNationId, state.nations[state.playerNationId]?.name);
  const title = (c) => t('chron.chapter', { age: ageName(c.age, AGES[c.age]?.name), year: formatYear(c.label, lang) });
  const list = (a) => a.map((n, i) => <React.Fragment key={n}>{i ? ', ' : ''}<GlossaryLink kind="city" id={n}>{nameNow('city', null, n)}</GlossaryLink></React.Fragment>);

  const save = async () => {
    const score = legacyModel(state);
    const rows = chapters.map((c) => ({ title: ageName(c.age, AGES[c.age]?.name), sub: formatYear(c.label, lang), runs: c.runs }));
    await saveCanvas(chronicleCanvas(rows, [t('chron.title', { people }), `${t('legacy.score')}: ${score.total} · ${t('legacy.rank', { rank: score.rank, of: score.of })}`], rtl ? 'rtl' : 'ltr'), t('chron.file', { people }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5" data-testid="chronicle">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-2 text-sm font-semibold text-amber-400 min-h-[36px]">
        <BookOpen className="w-4 h-4" aria-hidden="true" />{open ? t('chron.hide') : t('chron.read')}
      </button>
      {open && (chapters.length ? (
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 pl:grid-cols-2 gap-3">
            {chapters.map((c, i) => (
              <section key={i} className="rounded-md border border-fa-line bg-fa-raised/40 p-2 space-y-1 text-[11px]" data-testid="chronicle-chapter">
                <h4 className="text-xs font-semibold text-fa-text">{title(c)}{c.open ? ` · ${t('chron.now')}` : ''}</h4>
                <MapCanvas runs={c.runs} box={box} />
                <div className="font-semibold text-fa-text">{t('chron.battles')}</div>
                {c.battles.length ? c.battles.map((b, j) => <div key={j}>{t('chron.battleLine', { name: nameNow('battle', null, b.name), n: b.fallen, result: t(`chron.${b.result}`) })}</div>) : <div className="text-fa-muted">{t('chron.noBattles')}</div>}
                {c.founded.length > 0 && <div>{rich(t('chron.founded'), { list: list(c.founded) })}</div>}
                {c.taken.length > 0 && <div>{rich(t('chron.taken'), { list: list(c.taken) })}</div>}
                {c.lost.length > 0 && <div>{rich(t('chron.lostCities'), { list: list(c.lost) })}</div>}
                {c.wars.length > 0 && <div>{t('chron.wars', { list: c.wars.map((n) => nameNow('people', null, n)).join(', ') })}</div>}
                {c.ambitions.length > 0 && <div>{t('chron.ambitions', { list: c.ambitions.map((a) => dataText(`ambition.${a.id}`, a.label)).join(', ') })}</div>}
              </section>
            ))}
          </div>
          <button onClick={save} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-fa-hover hover:bg-fa-line text-fa-text min-h-[36px]">
            <Download className="w-4 h-4" aria-hidden="true" />{saved ? t('chron.saved') : t('chron.save')}
          </button>
        </div>
      ) : <p className="mt-2 text-[11px] text-fa-muted">{t('chron.empty')}</p>)}
    </div>
  );
};

export default ChronicleSheet;
