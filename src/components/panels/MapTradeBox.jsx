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

const tilesText = (g) => `${formatNumber(g.tiles)} ${g.tiles === 1 ? 'tile' : 'tiles'}${g.cities ? `, ${g.cities} ${g.cities === 1 ? 'city' : 'cities'}` : ''}`;

const TradeTile = ({ label, sub, refuse, onClick, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId}
    className={`text-left rounded-lg border px-2.5 py-1.5 min-h-[44px] hover:bg-fa-hover transition-colors ${refuse ? 'border-dashed border-fa-danger bg-fa-ink/30' : 'border-fa-line bg-fa-raised'}`}>
    <span className="block text-[12px] font-semibold leading-tight text-fa-text">{label}</span>
    {sub && <span className={`block text-[11px] leading-tight mt-0.5 ${refuse ? 'text-fa-danger-text' : 'text-fa-muted'}`}>{sub}</span>}
  </button>
);

const MapTradeBox = ({ nation }) => {
  const { state, dispatch } = useGame();
  const q = useMemo(() => mapTradeQuote(state, nation.id), [state, nation.id]);
  if (!q.theirs && !q.ok) return null; // fog off, not met, vassal or at war: the card says why elsewhere
  const trade = (kind) => dispatch({ type: ActionTypes.TRADE_MAPS, payload: { nationId: nation.id, kind } });
  const o = q.options;
  const sub = (opt, yes) => (!opt ? null : !opt.accepted ? opt.reason : opt.reason || yes);
  return (
    <details className="fa-card px-3 py-1.5" data-testid="map-trade">
      <summary className="list-none cursor-pointer flex items-center justify-between gap-2 min-h-[36px]">
        <span className="flex items-center gap-1.5 fa-label"><MapIcon size={13} aria-hidden="true" />Maps</span>
        <span className="text-[12px] text-fa-muted truncate" data-testid="map-trade-summary">
          {q.ok ? `${formatNumber(q.theirs.tiles)} tiles new to you, ${formatNumber(q.ours.tiles)} to them` : 'No trade'}
        </span>
      </summary>
      {!q.ok ? <p className="text-[12px] text-fa-danger-text pb-1.5" data-testid="map-trade-reason">{q.reason}</p> : (
        <div className="pb-1.5 space-y-1.5">
          <div className="grid grid-cols-2 pl:grid-cols-3 gap-1.5">
            <TradeTile testId="map-swap" label="Swap maps" refuse={!o.swap.accepted} sub={sub(o.swap, 'Would accept')} onClick={() => trade('swap')} />
            <TradeTile testId="map-give" label="Give your map" refuse={!o.give.accepted} sub={sub(o.give, `Opinion +${GAVE_US_MAP}, fading`)} onClick={() => trade('give')} />
            <TradeTile testId="map-ask" label="Ask for theirs" refuse={!o.ask.accepted} sub={sub(o.ask, 'Would give it')} onClick={() => trade('ask')} />
            <TradeTile testId="map-buy" label={`Buy theirs${o.buy.gold ? ` (${formatNumber(o.buy.gold)} gold)` : ''}`} refuse={!o.buy.accepted || !!o.buy.reason} sub={sub(o.buy, 'Would sell')} onClick={() => trade('buy')} />
            <TradeTile testId="map-sell" label={`Sell yours${o.sell.gold ? ` (${formatNumber(o.sell.gold)} gold)` : ''}`} refuse={!o.sell.accepted} sub={sub(o.sell, 'Would pay')} onClick={() => trade('sell')} />
          </div>
          <p className="text-[11px] text-fa-muted">Their map: {tilesText(q.theirs)} you have not explored. Yours: {tilesText(q.ours)} new to them. A map shows the land and sea it covers and the cities on it as they stand now, never armies.</p>
        </div>
      )}
    </details>
  );
};

export default MapTradeBox;
