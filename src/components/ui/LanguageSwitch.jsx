// src/components/ui/LanguageSwitch.jsx
// The language choice, English or עברית (phase H0 of plans/hebrew-support-plan.md). It applies at
// once, no reload, and is saved on the device (src/i18n). The two names are always written in their
// own language so a player can find the way back.
//   row      "Language: [English | עברית]" for the Menu card (Settings)
//   compact  just the two buttons, for the title screen and the start steps
import React from 'react';
import { Languages } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { LANGUAGES } from '../../i18n';
import { Segmented } from './atlas';

const OPTIONS = Object.values(LANGUAGES).map((l) => ({ id: l.id, label: l.native, testId: `lang-${l.id}` }));

const LanguageSwitch = ({ compact = false, className = '' }) => {
  const { t, lang, setLanguage } = useT();
  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`} data-testid="language-switch">
        <Languages className="w-4 h-4 text-fa-muted shrink-0" aria-hidden="true" />
        <Segmented label={t('lang.label')} options={OPTIONS} value={lang} onChange={setLanguage} className="!p-0.5 !gap-0.5 [&_button]:!min-h-[36px] [&_button]:!px-2.5" />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-between gap-3 min-h-[44px] ${className}`} data-testid="language-switch">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold leading-tight">{t('lang.label')}</div>
        <div className="text-[12px] text-fa-muted leading-snug">{t('lang.hint')}</div>
      </div>
      <Segmented label={t('lang.label')} options={OPTIONS} value={lang} onChange={setLanguage} className="shrink-0 w-[11rem]" />
    </div>
  );
};

export default LanguageSwitch;
