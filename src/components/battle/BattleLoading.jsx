// src/components/battle/BattleLoading.jsx
// The loading screen of a commanded battle: what is being done now, a progress bar over the start's
// stages (startWatch.js) and the seconds so far. It covers the soldiers' models (before the
// battlefield mounts) and the battlefield's own start (the worker's stages, the first frame). A
// long wait says so and offers Auto, so a slow phone is never a dead end; the start fails only when
// no stage arrives for a long time (TacticalBattleScreen.jsx). Phone landscape first.
import React from 'react';
import { useT } from '../../i18n/useT';
import { START_STAGES } from '../../battle/worker/startWatch';
import NumText from './NumText';

// After this long the screen says it is still working and offers Auto.
export const SLOW_START_S = 20;

/** The stage being worked on once `stage` is reached (the next one), for the label. */
export const workingOn = (stage) => {
  const i = START_STAGES.indexOf(stage);
  return i < 0 ? START_STAGES[0] : START_STAGES[Math.min(START_STAGES.length - 1, stage === 'models' ? i : i + 1)];
};

const BattleLoading = ({ stage = 'models', fraction = 0, seconds = null, retry = null, onAuto = null }) => {
  const { t } = useT();
  const doing = workingOn(stage);
  const step = START_STAGES.indexOf(doing) + 1;
  const pct = Math.round(Math.max(0.03, Math.min(1, fraction)) * 100);
  const slow = seconds != null && seconds >= SLOW_START_S;
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950 flex items-center justify-center p-4 pl:p-3 text-slate-200"
      role="status" aria-live="polite" data-testid={stage === 'models' ? 'battle-loading' : 'battle-starting'} data-stage={stage}>
      <div className="w-full max-w-[26rem]">
        <h2 className="fa-heading text-[18px] pl:text-[16px] leading-tight text-center">{t('bt.load.title')}</h2>
        <p className="mt-2 text-[14px] pl:text-[13px] leading-snug text-center" data-testid="battle-loading-stage">{t(`bt.load.${doing}`)}…</p>
        <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full bg-amber-500 rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11.5px] text-slate-400">
          <span><NumText text={t('bt.load.step', { i: step, n: START_STAGES.length })} /></span>
          {seconds != null && <span data-testid="battle-loading-seconds"><NumText text={t('bt.load.seconds', { n: seconds })} /></span>}
        </div>
        {retry && <p className="mt-2 text-[12px] leading-snug text-amber-300 text-center" data-testid="battle-loading-retry">{t(retry === 'inline' ? 'bt.load.retryInline' : 'bt.load.retry')}</p>}
        {slow && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <p className="text-[12px] leading-snug text-slate-400">{t('bt.load.slow')}</p>
            {onAuto && <button type="button" onClick={onAuto} data-testid="battle-loading-auto" className="min-h-[40px] px-3 rounded-lg bg-fa-raised border border-fa-line text-fa-text font-semibold text-[13px]">{t('bt.fail.auto')}</button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default BattleLoading;
