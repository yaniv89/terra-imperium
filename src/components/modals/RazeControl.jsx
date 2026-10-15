// Raze a city taken by force (phase W3, razing.js; plans/independent-cities.md 5, decision 3): keep it,
// or burn it one size a turn until it is gone. A placeholder in the city panel until W4's sheets.
// Phone first: one 44 px button, the rule in one line.
import React from 'react';
import { ActionTypes } from '../../data/types';
import { canRaze } from '../../engine/razing';
import { useT } from '../../i18n/useT';
import { nameNow } from '../../i18n/names';
import { reasonText } from '../../i18n/messageText';

const RazeControl = ({ state, dispatch, city }) => {
  const { t } = useT();
  const turnsOf = (n) => t('ind.turns', { count: n });
  const me = state.playerNationId;
  if (!city || city.owner !== me || (!city.conquest && !city.razing)) return null;
  if (city.razing) {
    return (
      <div className="mt-1.5 p-2 rounded bg-red-950/50 border border-red-700/50 text-[11px] text-red-200 space-y-1" data-testid="raze-burning">
        <div>{t('rz.burning', { city: nameNow('city', null, city.name), turns: turnsOf(city.size) })}</div>
        <button type="button" data-testid="stop-razing" onClick={() => dispatch({ type: ActionTypes.STOP_RAZING, payload: { regionId: city.id } })}
          className="w-full min-h-[44px] rounded font-semibold text-xs bg-fa-hover hover:bg-fa-line text-fa-text">{t('rz.stop')}</button>
      </div>
    );
  }
  const check = canRaze(state, me, city.id);
  return (
    <div className="mt-1.5 p-2 rounded bg-fa-raised/60 border border-fa-line/40 text-[11px] text-fa-text space-y-1" data-testid="raze-control">
      <div>{t('rz.takenByForce', { turns: turnsOf(city.size) })}</div>
      {check.ok
        ? <button type="button" data-testid="raze-city" onClick={() => dispatch({ type: ActionTypes.RAZE_CITY, payload: { regionId: city.id } })}
          className="w-full min-h-[44px] rounded font-semibold text-xs bg-red-800 hover:bg-red-700 text-fa-text">{t('rz.raze', { city: nameNow('city', null, city.name) })}</button>
        : <div className="text-fa-muted">{reasonText(check)}</div>}
    </div>
  );
};

export default RazeControl;
