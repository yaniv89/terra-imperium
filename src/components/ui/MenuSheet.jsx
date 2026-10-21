// src/components/ui/MenuSheet.jsx
// The menu hub (human playtest issue 3: nobody found save, load, help or the glossary). Opened from
// Menu on the tab rail (all entries) and the "?" on the top bar (view 'help': Help and Glossary).
// Every entry reuses an existing screen: Save writes the autosave now (GameContext saveNow), Load
// and Back to title open the title screen (its load view lists the save slots), Help replays the
// onboarding cards, Glossary opens the glossary at the player's own people, Settings the sheet.
import React, { useEffect, useRef, useState } from 'react';
import { Menu, Save, FolderOpen, HelpCircle, BookOpen, Settings2, Home } from 'lucide-react';
import { Button, SheetHeader } from './atlas';
import { useLastSave } from '../../context/GameContext';
import { useInteraction, useDismissOverlays, PRIORITY } from '../../hooks/useExclusivePanel';
import { useT } from '../../i18n/useT';

const ENTRIES = [
  { id: 'save', icon: Save, help: false },
  { id: 'load', icon: FolderOpen, help: false },
  { id: 'help', icon: HelpCircle, help: true },
  { id: 'glossary', icon: BookOpen, help: true },
  { id: 'settings', icon: Settings2, help: false },
  { id: 'title', icon: Home, help: false }
];

/** The entries a view lists; each `run` calls its handler (`on.save`, `on.load`, ...). */
export const menuEntries = (view, on) => ENTRIES.filter((e) => view !== 'help' || e.help).map((e) => ({ ...e, run: on[e.id] }));

const MenuSheet = ({ open, view = 'all', onClose, on }) => {
  const { t } = useT();
  const last = useLastSave();
  const [saved, setSaved] = useState(null); // null | 'ok' | 'failed', after the Save button
  const turn = useInteraction('menu', open, { priority: PRIORITY.sheet, user: true, label: t('hub.title') });
  useDismissOverlays(onClose, open);
  if (!open || !turn.shown) return null;
  const close = () => { setSaved(null); onClose(); };
  const pick = (e) => {
    if (e.id === 'save') { setSaved(e.run() ? 'ok' : 'failed'); return; }
    close();
    e.run();
  };
  return (
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-3 sheet-backdrop" onClick={close} data-testid="menu-sheet" data-view={view}>
      <div role="dialog" aria-modal="true" aria-labelledby="menu-title" onClick={(ev) => ev.stopPropagation()}
        className="sheet-panel fa-sheet w-full max-w-sm max-h-[92dvh] flex flex-col rounded-[10px] border border-fa-line shadow-2xl">
        <SheetHeader title={t(view === 'help' ? 'hub.helpTitle' : 'hub.title')} icon={view === 'help' ? HelpCircle : Menu} onClose={close} titleId="menu-title" />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 grid grid-cols-2 gap-2 content-start">
          {menuEntries(view, on).map((e) => (
            <Button key={e.id} onClick={() => pick(e)} className="!min-h-[44px] !justify-start" data-testid={`menu-${e.id}`}>
              <e.icon className="w-4 h-4 shrink-0" aria-hidden="true" />{t(`hub.go.${e.id}`)}
            </Button>
          ))}
          {view !== 'help' && (
            <p className="col-span-2 text-[12px] text-fa-muted" role="status" data-testid="menu-autosave">
              {saved === 'failed' ? t('hub.saveFailed') : last ? t(saved === 'ok' ? 'hub.savedTurn' : 'hub.autosavedTurn', { turn: last.turn }) : t('menu.autosaveNote')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// A brief "Autosaved, turn N" after the autosave of a new turn (not after every quiet-time save).
export const AutosaveToast = () => {
  const { t } = useT();
  const savedTurn = useLastSave()?.turn ?? null;
  const seen = useRef(savedTurn);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (savedTurn == null || savedTurn === seen.current) return undefined;
    const first = seen.current == null;
    seen.current = savedTurn;
    if (first) return undefined;
    setShown(savedTurn);
    const id = setTimeout(() => setShown(null), 2500);
    return () => clearTimeout(id);
  }, [savedTurn]);
  if (shown == null) return null;
  return (
    <div className="fixed top-[calc(var(--header-height,2.25rem)+0.5rem)] start-[max(0.75rem,var(--safe-start))] z-30 pointer-events-none fa-panel !bg-fa-panel/95 px-2.5 py-1 text-[12px] text-fa-muted shadow" role="status" data-testid="autosave-toast">
      {t('hub.autosavedTurn', { turn: shown })}
    </div>
  );
};

export default MenuSheet;
