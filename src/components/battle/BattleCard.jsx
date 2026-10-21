// src/components/battle/BattleCard.jsx
// U22: the card before a commanded battle deploys: why this fight differs (ground, walls, supply,
// starvation, plague, militia, reinforcements). A decision card: a tap on the dimmed screen never
// closes it, only Deploy does. The rows come from battleCardModel.js (the battle's own setup).
import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/atlas';
import { useT } from '../../i18n/useT';

const TONE = { good: 'text-fa-good', bad: 'text-fa-danger-text', plain: 'text-fa-text' };

const BattleCard = ({ title, rows, onDeploy }) => {
  const { t } = useT();
  const card = (
    <div className="fixed inset-0 z-[70] bg-black/55 flex items-center justify-center p-2" data-testid="battle-card">
      <div role="dialog" aria-modal="true" aria-labelledby="battle-card-title" className="fa-panel !bg-fa-panel shadow-2xl w-[min(32rem,100%)] max-h-[94dvh] flex flex-col rounded-[10px]">
        <div className="px-3 pt-2 pb-1.5 border-b border-fa-line">
          <h2 id="battle-card-title" className="fa-heading text-[17px] leading-tight">{title}</h2>
          <div className="text-[12px] text-fa-muted">{t('bt.card.sub')}</div>
        </div>
        <ul className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1" data-testid="battle-card-rows">
          {rows.map((r) => <li key={r.id} data-row={r.id} className={`text-[13px] leading-snug ${TONE[r.tone]}`}>{r.text}</li>)}
        </ul>
        <div className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.625rem)] border-t border-fa-line">
          <Button variant="primary" hero onClick={onDeploy} data-testid="battle-card-go" className="!min-h-[48px] w-full">{t('bt.card.deploy')}</Button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? card : createPortal(card, document.body);
};

export default BattleCard;
