// src/components/ui/TitleScreen.jsx
// The title screen every launch shows when a saved game exists (playtest audit X26).
//   Continue   the big default button: the people, turn, year and when it was last played
//   New game   goes to the start steps; the current game is kept under Load, never overwritten
//   Load       the saved games on this device (the autosave and the game before it) and a save file
//   Settings   the usual settings sheet
// Phone landscape first (844x340): the name and the Continue card on the left, the buttons on the
// right. Portrait phones never get here (the rotate screen covers the page).
import React, { useRef, useState } from 'react';
import { Play, Plus, FolderOpen, Settings2, ArrowLeft, Trash2, FileUp } from 'lucide-react';
import { Button } from './atlas';
import ConfirmDialog from './ConfirmDialog';
import { startArt } from './peopleArt';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { SAVE_PROBLEM_TEXT } from '../../engine/saveMigrations';
import { useT } from '../../i18n/useT';
import { agoText } from '../../i18n';
import LanguageSwitch from './LanguageSwitch';
import FullscreenButton from './FullscreenButton';

/** The facts of a save: "Akkad, turn 12, 1850 BCE" and "Last played 3 days ago (date)". */
export const SaveFacts = ({ info, now, className = '' }) => {
  const { t, lang, date, year, name } = useT();
  if (!info || info.status === 'none') return null;
  if (info.status === 'old') return <div className={`text-[13px] text-fa-muted ${className}`}>{t('title.oldSave')}</div>;
  const when = info.yearValue != null ? year(info.yearValue) : info.year;
  const facts = when ? t('title.turnYear', { turn: info.turn, year: when }) : t('title.turn', { turn: info.turn });
  return (
    <div className={className}>
      <div className="text-[15px] font-semibold leading-tight">{name('people', info.nationId, info.nation)}<span className="font-normal text-fa-muted">{facts}{info.gameOver ? t('title.gameOver') : ''}</span></div>
      {info.savedAt != null && <div className="text-[12px] text-fa-muted leading-snug mt-0.5" data-testid="save-played">{t('title.lastPlayed', { ago: agoText(info.savedAt, now, lang) })} <bdi className="whitespace-nowrap">({date(info.savedAt)})</bdi></div>}
    </div>
  );
};

const TitleScreen = ({ slots, initialView = 'main', onContinue, onNewGame, onLoad, onDelete, onImportText, onSettings, now = Date.now() }) => {
  const { t, name } = useT();
  const layout = useLayoutMode();
  const wide = layout === 'desktop';
  const [view, setView] = useState(initialView); // 'main' | 'load'
  const [toDelete, setToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);
  const autosave = slots.find((s) => s.id === 'autosave');
  const background = startArt(wide ? 'background-wide' : 'background-phone') || startArt('background-wide');
  const backdrop = { backgroundImage: background ? `linear-gradient(rgba(16,20,26,0.80), rgba(16,20,26,0.94)), url(${background})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' };
  const frame = 'ps-[max(0.75rem,var(--safe-start))] pe-[max(0.75rem,var(--safe-end))]';

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let result;
    try { result = onImportText(await file.text()); } catch (err) { result = 'corrupt'; }
    if (result !== true) setMessage(SAVE_PROBLEM_TEXT?.[result] || t('title.fileBad'));
  };

  const brand = (
    <div className="min-w-0">
      <h1 className="fa-heading text-[34px] pl:text-[28px] leading-none" data-testid="title-name">{t('title.name')}</h1>
      <p className="text-[13px] text-fa-muted mt-1">{t('title.tagline')}</p>
    </div>
  );

  const main = (
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] gap-4 items-center w-full max-w-[56rem]">
      <div className="space-y-3 min-w-0">
        {brand}
        {autosave && autosave.info.status === 'ok' && (
          <div className="fa-panel p-3" data-testid="title-continue-card">
            <div className="fa-label mb-1">{t('title.lastGame')}</div>
            <SaveFacts info={autosave.info} now={now} />
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <Button variant="primary" hero className="!min-h-[56px] pl:!min-h-[48px]" onClick={onContinue} data-testid="title-continue" autoFocus><Play className="rtl:-scale-x-100 w-5 h-5" aria-hidden="true" />{t('title.continue')}</Button>
        <Button onClick={onNewGame} className="!min-h-[48px] pl:!min-h-[44px]" data-testid="title-new"><Plus className="w-4 h-4" aria-hidden="true" />{t('title.newGame')}</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => { setMessage(''); setView('load'); }} className="!min-h-[44px]" data-testid="title-load"><FolderOpen className="w-4 h-4" aria-hidden="true" />{t('title.load')}</Button>
          <Button onClick={onSettings} className="!min-h-[44px]" data-testid="title-settings"><Settings2 className="w-4 h-4" aria-hidden="true" />{t('title.settings')}</Button>
        </div>
      </div>
    </div>
  );

  const load = (
    <div className="w-full max-w-[40rem] min-h-0 flex flex-col gap-2" data-testid="title-load-view">
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" onClick={() => setView('main')} className="shrink-0" data-testid="title-load-back"><ArrowLeft className="rtl:-scale-x-100 w-4 h-4" aria-hidden="true" />{t('title.back')}</Button>
        <h2 className="fa-heading text-[20px] flex-1">{t('title.loadHeading')}</h2>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain scrollbar-thin grid gap-2 content-start" style={{ maxHeight: 'calc(100dvh - 4.5rem)' }}>
        {slots.length === 0 && <div className="fa-panel p-3 text-[13px] text-fa-muted">{t('title.noSaves')}</div>}
        {slots.map((s) => (
          <div key={s.id} className="fa-panel p-2.5 flex items-center gap-2" data-slot={s.id}>
            <div className="min-w-0 flex-1">
              <div className="fa-label mb-0.5">{t(`title.slot.${s.id}`)}</div>
              <SaveFacts info={s.info} now={now} />
            </div>
            {s.info.status === 'ok' && <Button variant="primary" onClick={() => onLoad(s.key)} className="!min-h-[44px] shrink-0" data-testid={`load-${s.id}`}>{s.id === 'autosave' ? t('title.continue') : t('title.load')}</Button>}
            <Button variant="ghost" onClick={() => setToDelete(s)} className="!min-h-[44px] !min-w-[44px] !px-2 shrink-0" aria-label={t('title.deleteAria', { label: t(`title.slot.${s.id}`) })} data-testid={`delete-${s.id}`}><Trash2 className="w-4 h-4" aria-hidden="true" /></Button>
          </div>
        ))}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => fileRef.current?.click()} className="!min-h-[44px]" data-testid="title-open-file"><FileUp className="w-4 h-4" aria-hidden="true" />{t('title.openFile')}</Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={pickFile} data-testid="title-file-input" />
          {message && <span className="text-[13px]" style={{ color: 'var(--fa-danger-text)' }} role="status">{message}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative h-[100dvh] w-full bg-fa-ink text-fa-text flex flex-col items-center justify-center overflow-y-auto py-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]" style={backdrop} data-testid="title-screen" data-view={view}>
      <div className={`w-full flex justify-center ${frame}`}>{view === 'main' ? main : load}</div>
      {view === 'main' && <LanguageSwitch compact className="absolute top-[max(0.25rem,env(safe-area-inset-top))] end-[max(0.5rem,var(--safe-end))]" />}
      {view === 'main' && <FullscreenButton className="absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] end-[max(0.5rem,var(--safe-end))] !min-h-[36px] text-[12px]" testId="title-fullscreen" />}
      <ConfirmDialog open={!!toDelete} title={t('title.deleteHeading')} confirmLabel={t('title.delete')} cancelLabel={t('title.keep')} danger testId="delete-save-confirm"
        onConfirm={() => { const s = toDelete; setToDelete(null); if (s) onDelete(s.key); }} onCancel={() => setToDelete(null)}>
        {toDelete && <p>{toDelete.info.status === 'ok' ? `${t('title.deleteWhich', { nation: name('people', toDelete.info.nationId, toDelete.info.nation), turn: toDelete.info.turn })} ` : ''}{t('title.cannotUndo')}</p>}
      </ConfirmDialog>
    </div>
  );
};

export default TitleScreen;
