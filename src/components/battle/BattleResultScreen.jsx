// src/components/battle/BattleResultScreen.jsx
// B08 Result (plans/UI-DESIGN.md): the end of a commanded battle, over the battlefield. The verdict
// and why it ended, then three cards: losses (men are strength on the map; workers apart), the
// experience each regiment gains with its formula and the general's fate (the same 25% roll the
// campaign makes when a general's regiment is destroyed), and the city: what carries to the map
// under the 50% rule (houses ruined, at most half), with the loot. A line compares with Auto (its
// odds for this same battle). Continue hands the result to the campaign (one outcome service for
// Command and Auto). All numbers from battleHudModel.js battleResultModel.
import React, { useMemo } from 'react';
import { Crown } from 'lucide-react';
import { battleResultModel } from './battleHudModel';

const REASONS = {
  keepTaken: 'The keep was taken and held: a decisive capture.',
  defendersBroken: 'The defenders were broken.',
  attackersBroken: 'The attack was broken.',
  attackerRetreated: 'The attackers withdrew from the field.',
  timeLimit: 'Time ran out: the defenders held their ground.',
  mutualDestruction: 'Neither army is left standing.'
};

const Bar = ({ value, max, color }) => (
  <span className="block h-1.5 rounded-full bg-fa-ink overflow-hidden mt-0.5"><span className="block h-full rounded-full" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} /></span>
);

/** `getCampaign()` (optional): { turnNumber, year, hiredCommanders, ageId, auto: { win } } from the game. */
const BattleResultScreen = ({ ended, setup, playerSide, title, getCampaign, onContinue }) => {
  const campaign = useMemo(() => (getCampaign ? getCampaign() : {}), [getCampaign]);
  const m = useMemo(() => battleResultModel(ended, setup, playerSide, campaign || {}), [ended, setup, playerSide, campaign]);
  const tone = m.draw ? 'text-fa-brass' : m.won ? 'text-fa-good' : 'text-fa-danger-text';
  const mins = Math.floor(m.duration / 60); const secs = m.duration % 60;
  const year = campaign?.year != null ? (campaign.year < 0 ? `${-campaign.year} BCE` : `${campaign.year} CE`) : null;
  return (
    <div className="absolute inset-x-0 top-11 bottom-0 z-20 bg-fa-ink/90 overflow-y-auto" data-testid="battle-result">
      <div className="min-h-full w-full max-w-[64rem] mx-auto flex flex-col lg:justify-center p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-4 flex-wrap px-1">
        <div className="min-w-0">
          <div className="fa-label">{[title, campaign?.turnNumber != null ? `turn ${campaign.turnNumber}` : null, year].filter(Boolean).join(', ')}</div>
          <div className={`fa-heading text-[30px] leading-none ${tone}`} data-testid="battle-verdict">{m.verdict}</div>
        </div>
        <div className="flex-1 min-w-[14rem] text-[13px] leading-snug pb-0.5">{REASONS[m.reason] || ''} <span className="text-fa-muted">The battle lasted {mins} min {secs} s.</span></div>
      </div>

      <div className="grid gap-2 mt-2 grid-cols-1 sm:grid-cols-3 flex-1 lg:flex-none lg:min-h-[17rem] min-h-0">
        <div className="fa-card px-2.5 py-2 flex flex-col" data-testid="battle-result-losses">
          <div className="fa-label">Losses</div>
          {[['Yours', m.mine, 'var(--fa-you)', 'text-fa-you'], ['Theirs', m.theirs, 'var(--fa-enemy)', 'text-fa-enemy']].map(([label, l, c, t]) => (
            <div key={label} className="mt-1.5">
              <div className="flex justify-between text-[12.5px]"><span className={`font-semibold ${t}`}>{label}</span><span className="fa-num">{l.lost} of {l.start}</span></div>
              <Bar value={l.lost} max={l.start} color={c} />
              {l.destroyed > 0 && <div className="text-[11px] text-fa-muted">{l.destroyed} regiment{l.destroyed === 1 ? '' : 's'} destroyed</div>}
            </div>
          ))}
          <div className="text-[11px] text-fa-muted mt-1.5 leading-snug">Men are strength on the map: the units lost are gone for good.</div>
          {m.workersLost != null && <div className="mt-auto pt-1.5 border-t border-fa-line flex justify-between text-[12px]"><span>Workers lost</span><span className="fa-num">{m.workersLost}</span></div>}
        </div>

        <div className="fa-card px-2.5 py-2 flex flex-col" data-testid="battle-result-xp">
          <div className="fa-label">Experience</div>
          <div className="mt-1 space-y-0.5 overflow-y-auto max-h-[7.5rem]">
            {m.xp.length === 0 && <div className="text-[12px] text-fa-muted">No regiment of yours came through to learn from it.</div>}
            {m.xp.slice(0, 6).map((x) => (
              <div key={x.id} className="flex justify-between gap-2 text-[12.5px]"><span className="truncate">{x.name}</span><span className="fa-num text-fa-good shrink-0">+{x.gained} XP{x.rankUp ? `, ${x.rankUp}` : ''}</span></div>
            ))}
          </div>
          <div className="text-[11px] text-fa-muted mt-1 leading-snug">{m.xpRule}.</div>
          <div className="mt-auto pt-1.5 border-t border-fa-line space-y-0.5" data-testid="battle-result-general">
            {m.generals.length === 0 && <div className="text-[11.5px] text-fa-muted">No general led this army.</div>}
            {m.generals.map((g) => (
              <div key={g.name} className="flex items-start gap-1.5 text-[12px]"><Crown className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${g.fate === 'fell' ? 'text-fa-danger-text' : 'text-fa-brass'}`} aria-hidden="true" /><span>{g.text}</span></div>
            ))}
          </div>
        </div>

        <div className="fa-card px-2.5 py-2 flex flex-col" data-testid="battle-result-city">
          {m.city ? (
            <>
              <div className="fa-label">{playerSide === 1 ? 'Your city keeps' : m.won ? 'What you inherit' : 'The city'}</div>
              <div className="text-[12.5px] leading-snug mt-1">Houses ruined {m.city.ruined} of {m.city.total} (at most {m.city.maxLost} can be lost, the 50% rule){m.city.otherDown ? `; ${m.city.otherDown} other building${m.city.otherDown === 1 ? '' : 's'} down` : ''}. Repairs are free over a few turns.</div>
              <div className="relative flex h-1.5 mt-1.5 rounded-full overflow-hidden bg-fa-ink">
                <span style={{ width: `${(m.city.carried / Math.max(1, m.city.total)) * 100}%`, background: 'var(--fa-danger)' }} />
                <span style={{ width: `${(m.city.kept / Math.max(1, m.city.total)) * 100}%`, background: 'var(--fa-good)' }} />
                <span className="absolute inset-y-[-1px] w-0.5 bg-fa-text" style={{ left: '50%' }} />
              </div>
              <div className="flex gap-3 text-[10.5px] text-fa-muted mt-0.5"><span>Ruined {m.city.carried}</span><span>Kept {m.city.kept}</span><span>50% line at {m.city.maxLost}</span></div>
            </>
          ) : (
            <>
              <div className="fa-label">After the battle</div>
              <div className="text-[12.5px] leading-snug mt-1">{setup.battleType === 'naval' ? 'Ships sunk are gone for good.' : "A decisive field battle: the loser's regiments still on the field are lost; those that left by an exit survive and step back a tile."}</div>
            </>
          )}
          {m.loot && (
            <div className="mt-auto pt-1.5 border-t border-fa-line">
              <div className="fa-label">Loot</div>
              <div className="fa-num text-[13px]">GOLD <span className="text-fa-good">+{m.loot.gold}</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 min-w-0 text-[12px] text-fa-muted leading-snug" data-testid="battle-result-auto">{m.auto}</div>
        <button type="button" onClick={onContinue} className="fa-btn fa-btn-primary fa-btn-hero !min-h-[50px] !px-8 shrink-0" data-testid="battle-continue">Continue</button>
      </div>
      </div>
    </div>
  );
};

export default BattleResultScreen;
