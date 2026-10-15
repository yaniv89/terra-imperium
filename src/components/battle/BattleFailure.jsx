// src/components/battle/BattleFailure.jsx
// When a commanded battle cannot be set up, cannot start or stops (TacticalBattleHost,
// TacticalBattleScreen): a readable message and the way back to the map, never a frozen field.
// "Fight it on Auto" settles the same battle through the honest auto-resolve and the one outcome
// service (ABANDON_TACTICAL_BATTLE), so nothing is lost; "Try again" reopens it from the start.
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { t as tNow } from '../../i18n/core';
import NumText from './NumText';

const BattleFailure = ({ title, message, detail = null, onAuto, onRetry = null, retryLabel }) => {
  const { t } = useT();
  return (
  <div className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-3" role="alertdialog" aria-labelledby="battle-failure-title" data-testid="battle-failure">
    <div className="fa-panel !bg-fa-panel shadow-2xl w-full max-w-[30rem] max-h-[94dvh] overflow-y-auto rounded-[10px] p-4 text-fa-text">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
        <h2 id="battle-failure-title" className="fa-heading text-[18px] leading-tight">{title || t('bt.fail.title')}</h2>
      </div>
      {message && <p className="mt-2 text-[13px] leading-snug">{message}</p>}
      <p className="mt-1 text-[12px] text-fa-muted leading-snug">{t('bt.fail.nothingLost')}</p>
      {detail && <p className="mt-2 text-[12px] text-fa-muted leading-snug break-words" data-testid="battle-failure-detail"><NumText text={detail} /></p>}
      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        {onRetry && (
          <button type="button" onClick={onRetry} data-testid="battle-failure-retry" className="min-h-[44px] px-4 rounded-lg bg-fa-raised hover:bg-fa-hover border border-fa-line font-semibold text-[13px]">{retryLabel || t('bt.fail.retry')}</button>
        )}
        <button type="button" onClick={onAuto} data-testid="battle-failure-auto" className="min-h-[44px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[13px]">{t('bt.fail.auto')}</button>
      </div>
    </div>
  </div>
  );
};

/**
 * Catches anything the battle screen throws while rendering or mounting (the HUD, the renderer's
 * set-up) and shows BattleFailure instead of taking the whole app down to a blank page.
 */
export class BattleErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[battle] the battle screen failed', error, info?.componentStack || ''); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <BattleFailure title={tNow('bt.fail.couldNotGoOn')} message={tNow('bt.fail.wentWrong')} detail={error?.message || String(error)} onAuto={this.props.onAuto} onRetry={this.props.onRetry} />;
  }
}

export default BattleFailure;
