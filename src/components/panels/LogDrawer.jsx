// src/components/panels/LogDrawer.jsx
// The event log's actual content (LogConsole), shown as a dismissible overlay opened from
// LogTrigger.jsx rather than an always-embedded panel. Bottom sheet on mobile (consistent with
// RegionInfoModal's own mobile treatment), a right-docked panel at `lg`+ where there's width to
// spare without covering the map/action panel, and on a phone held sideways (`pl:`), where a
// bottom sheet would cover most of a 390 px tall screen.
import React from 'react';
import { X } from 'lucide-react';
import LogConsole from './LogConsole';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';

const LogDrawer = ({ open, onClose }) => {
  const { t } = useT();
  // A sheet the player opened: it takes the screen, and a decision card it covers waits as a chip
  // (useExclusivePanel.js).
  const turn = useInteraction('log', open, { priority: PRIORITY.sheet, user: true, label: tNow('wait.log') });
  if (!open || !turn.shown) return null;

  return (
    <div className="fixed inset-0 z-40 flex lg:justify-end pl:justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full lg:w-96 h-[70vh] lg:h-full mt-auto lg:mt-0 rounded-t-2xl lg:rounded-none
                   pl:w-[min(400px,56vw)] pl:h-full pl:mt-0 pl:rounded-none pl:border-t-0 pl:border-s
                   flex flex-col bg-fa-ink border-t lg:border-t-0 lg:border-s border-fa-line shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* A phone held sideways has about 300 px of height: the log's own header already names it,
            so this second title row goes and the close button hangs off the edge as on a desktop
            (playtest audit I169: the log showed about four lines). */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-fa-line shrink-0 lg:hidden pl:hidden">
          <span className="text-xs font-semibold text-fa-muted">{t('log.title')}</span>
          <button onClick={onClose} className="p-1 hover:bg-fa-raised rounded text-fa-muted hover:text-fa-text" aria-label={t('log.close')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="hidden lg:flex pl:flex pl:-start-12 pl:w-11 pl:h-11 items-center justify-center absolute -start-9 top-2 p-1.5 bg-fa-ink border border-fa-line rounded-lg
                     text-fa-muted hover:text-fa-text hover:bg-fa-raised"
          aria-label={t('log.close')}
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-h-0">
          <LogConsole />
        </div>
      </div>
    </div>
  );
};

export default LogDrawer;
