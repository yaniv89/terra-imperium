// src/components/panels/MapTradeBox.jsx
// The nation card's map trading (playtest audit I116, src/engine/mapTrade.js): one folded row that
// says what each side's map would show the other, and, open, the five trades as tiles that say
// before you try whether they would accept (and the price) or why not. The quote is the one the
// reducer applies (mapTradeQuote), so the tile never promises what the trade will not do.
import React, { useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { formatNumber } from '../../utils/helpers';
import { mapTradeQuote } from '../../engine/mapTrade';
import { GAVE_US_MAP } from '../../data/opinion';
import { useT } from '../../i18n/useT';
import { reasonText } from '../../i18n/messageText';
import { t as tNow } from '../../i18n/core';

const tilesText = (g) => `${formatNumber(g.tiles)} ${tNow('mt.tiles', { count: g.tiles }).replace(/^\S+\s*/, '')}${g.cities ? `, ${tNow('mt.cities', { count: g.cities })}` : ''}`;

const TradeTile = ({ label, sub, refuse, onClick, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId}
    className={`text-start rounded-lg border px-2.5 py-1.5 min-h-[44px] hover:bg-fa-hover transition-colors ${refuse ? 'border-dashed border-fa-danger bg-fa-ink/30' : 'border-fa-line bg-fa-raised'}`}>
    <span className="block text-[12px] font-semibold leading-tight text-fa-text">{label}</span>
    {sub && <span className={`block text-[11px] leading-tight mt-0.5 ${refuse ? 'text-fa-danger-text' : 'text-fa-muted'}`}>{sub}</span>}
  </button>
);

const MapTradeBox = ({ nation }) => {
  const { state, dispatch } = useGame();
  const { t } = useT();
  const q = useMemo(() => mapTradeQuote(state, nation.id), [state, nation.id]);
  if (!q.theirs && !q.ok) return null; // fog off, not met, vassal or at war: the card says why elsewhere
  const trade = (kind) => dispatch({ type: ActionTypes.TRADE_MAPS, payload: { nationId: nation.id, kind } });
  const o = q.options;
  const sub = (opt, yes) => (!opt ? null : !opt.accepted ? reasonText(opt) : opt.reason ? reasonText(opt) : yes);
  return (
    <details className="fa-card px-3 py-1.5" data-testid="map-trade">
      <summary className="list-none cursor-pointer flex items-center justify-between gap-2 min-h-[36px]">
        <span className="flex items-center gap-1.5 fa-label"><MapIcon size={13} aria-hidden="true" />{t('mt.maps')}</span>
        <span className="text-[12px] text-fa-muted truncate" data-testid="map-trade-summary">
          {q.ok ? t('mt.summary', { a: formatNumber(q.theirs.tiles), b: formatNumber(q.ours.tiles) }) : t('mt.noTrade')}
        </span>
      </summary>
      {!q.ok ? <p className="text-[12px] text-fa-danger-text pb-1.5" data-testid="map-trade-reason">{reasonText(q)}</p> : (
        <div className="pb-1.5 space-y-1.5">
          <div className="grid grid-cols-2 pl:grid-cols-3 gap-1.5">
            <TradeTile testId="map-swap" label={t('mt.swap')} refuse={!o.swap.accepted} sub={sub(o.swap, t('mt.swapYes'))} onClick={() => trade('swap')} />
            <TradeTile testId="map-give" label={t('mt.give')} refuse={!o.give.accepted} sub={sub(o.give, t('mt.giveYes', { n: GAVE_US_MAP }))} onClick={() => trade('give')} />
            <TradeTile testId="map-ask" label={t('mt.ask')} refuse={!o.ask.accepted} sub={sub(o.ask, t('mt.askYes'))} onClick={() => trade('ask')} />
            <TradeTile testId="map-buy" label={o.buy.gold ? t('mt.buyGold', { gold: formatNumber(o.buy.gold) }) : t('mt.buy')} refuse={!o.buy.accepted || !!o.buy.reason} sub={sub(o.buy, t('mt.buyYes'))} onClick={() => trade('buy')} />
            <TradeTile testId="map-sell" label={o.sell.gold ? t('mt.sellGold', { gold: formatNumber(o.sell.gold) }) : t('mt.sell')} refuse={!o.sell.accepted} sub={sub(o.sell, t('mt.sellYes'))} onClick={() => trade('sell')} />
          </div>
          <p className="text-[11px] text-fa-muted">{t('mt.footer', { theirs: tilesText(q.theirs), ours: tilesText(q.ours) })}</p>
        </div>
      )}
    </details>
  );
};

export default MapTradeBox;
