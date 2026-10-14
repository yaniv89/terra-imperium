// src/components/battle/BattleResultScreen.jsx
// B08 Result (plans/UI-DESIGN.md): the end of a commanded battle, over the battlefield. What it
// shows IS what the campaign commits (playtest audit CB02): the verdict, the line the campaign
// logs (taken, not yet yours, repelled), and three cards read from the battle's receipt
// (src/engine/battleReceipt.js): the participant ledger's losses in men (the same count as the
// battle report and the Log; those who fled apart, workers and temporary auxiliaries apart), the
// experience each regiment really gains and each general's real fate, and the city as it then
// stands with the gold that reaches the treasury. While the campaign counts the battle the screen
// says so and shows no number; if its count differs from what was seen, a plain notice says which
// one stands. A line compares with Auto (its odds for this same battle). Continue hands the
// result to the campaign. All numbers from battleHudModel.js battleResultModel.
import React, { useMemo } from 'react';
import { Crown, Info } from 'lucide-react';
import { battleResultModel } from './battleHudModel';
import { menText } from '../../engine/battleLedger';

const REASONS = {
  keepTaken: 'The keep was taken and held.',
  // A battle with bases (sim/base.js): a side loses when its last base building falls.
  baseDestroyed: "The defenders' last base building fell.",
  campDestroyed: "The attackers' camp and base buildings were destroyed.",
  defenderRetreated: 'The defenders withdrew from the field.',
  defendersBroken: 'The defenders were broken.',
  attackersBroken: 'The attack was broken.',
  attackerRetreated: 'The attackers withdrew from the field.',
  timeLimit: 'Time ran out: the defenders held their ground.',
  mutualDestruction: 'Neither army is left standing.'
};

const Bar = ({ value, max, color }) => (
  <span className="block h-1.5 rounded-full bg-fa-ink overflow-hidden mt-0.5"><span className="block h-full rounded-full" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} /></span>
);

/**
 * `getCampaign()` (optional): { turnNumber, year, hiredCommanders, ageId, auto: { win } } from the game.
 * `receipt` (optional): the campaign's answer for this battle (battleHudModel.js battleResultModel).
 */
const BattleResultScreen = ({ ended, setup, playerSide, title, getCampaign, receipt, onContinue }) => {
  const campaign = useMemo(() => (getCampaign ? getCampaign() : {}), [getCampaign]);
  const m = useMemo(() => battleResultModel(ended, setup, playerSide, campaign || {}, receipt), [ended, setup, playerSide, campaign, receipt]);
  const tone = m.draw ? 'text-fa-brass' : m.won ? 'text-fa-good' : 'text-fa-danger-text';
  const mins = Math.floor(m.duration / 60); const secs = m.duration % 60;
  const year = campaign?.year != null ? (campaign.year < 0 ? `${-campaign.year} BCE` : `${campaign.year} CE`) : null;
  const pending = m.state === 'pending';
  const counted = m.mine && m.theirs;
  return (
    <div className="absolute inset-x-0 top-11 bottom-0 z-20 bg-fa-ink/90 overflow-y-auto" data-testid="battle-result" data-result-state={m.state}>
      <div className="min-h-full w-full max-w-[64rem] mx-auto flex flex-col lg:justify-center p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-4 flex-wrap px-1">
        <div className="min-w-0">
          <div className="fa-label">{[title, campaign?.turnNumber != null ? `turn ${campaign.turnNumber}` : null, year].filter(Boolean).join(', ')}</div>
          <div className={`fa-heading text-[30px] leading-none ${tone}`} data-testid="battle-verdict">{m.verdict}</div>
        </div>
        <div className="flex-1 min-w-[14rem] text-[13px] leading-snug pb-0.5">
          {m.line && <div className="font-semibold" data-testid="battle-result-line">{m.line}</div>}
          {!pending && <div>{REASONS[m.reason] || ''} <span className="text-fa-muted">The battle lasted {mins} min {secs} s.</span></div>}
        </div>
      </div>
      {m.notice && (
        <div className="mt-2 fa-card px-2.5 py-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-fa-brass" role="status" data-testid="battle-result-notice">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /><span>{m.notice}</span>
        </div>
      )}

      {counted && (
      <div className="grid gap-2 mt-2 grid-cols-1 sm:grid-cols-3 flex-1 lg:flex-none lg:min-h-[17rem] min-h-0">
        <div className="fa-card px-2.5 py-2 flex flex-col" data-testid="battle-result-losses">
          <div className="fa-label">Men lost</div>
          {[['Yours', m.mine, 'var(--fa-you)', 'text-fa-you'], ['Theirs', m.theirs, 'var(--fa-enemy)', 'text-fa-enemy']].map(([label, l, c, t]) => (
            <div key={label} className="mt-1.5">
              <div className="flex justify-between text-[12.5px]"><span className={`font-semibold ${t}`}>{label}</span><span className="fa-num">{menText(l.lost)} of {menText(l.start)}</span></div>
              <Bar value={l.lost} max={l.start} color={c} />
              {l.destroyed > 0 && <div className="text-[11px] text-fa-muted">{l.destroyed} regiment{l.destroyed === 1 ? '' : 's'} destroyed{l.runDown > 0 ? `, ${menText(l.runDown)} men caught after the fighting` : ''}</div>}
              {l.fled > 0 && <div className="text-[11px] text-fa-muted">{menText(l.fled)} men fled the field and live</div>}
            </div>
          ))}
          <div className="text-[11px] text-fa-muted mt-1.5 leading-snug">{m.state === 'committed' ? 'The same count as the battle report and the Log. Men lost are gone for good.' : 'Men lost are gone for good.'}</div>
          {m.aux && <div className="text-[11px] text-fa-muted mt-1 leading-snug" data-testid="battle-result-aux">{m.aux}</div>}
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
              <div className="fa-label">{playerSide === 1 ? (m.city.taken ? 'The city is lost' : 'Your city') : m.city.taken ? 'The city is yours' : 'The city'}</div>
              {m.city.committed ? (
                <div className="text-[12.5px] leading-snug mt-1">
                  {m.city.line ? `${m.city.line} Repairs are free.` : 'The city took no lasting damage.'}
                  {!m.city.taken && m.city.control != null && playerSide === 0 && m.won ? ` Their hold on it is now ${m.city.control}%.` : ''}
                </div>
              ) : (
                <div className="text-[12.5px] leading-snug mt-1">Houses ruined {m.city.ruined} of {m.city.total}{m.city.otherDown ? `; ${m.city.otherDown} other building${m.city.otherDown === 1 ? '' : 's'} down` : ''}. Repairs are free over a few turns.</div>
              )}
            </>
          ) : (
            <>
              <div className="fa-label">After the battle</div>
              <div className="text-[12.5px] leading-snug mt-1">{setup.battleType === 'naval' ? 'Ships sunk are gone for good.' : "A decisive field battle: the loser's regiments still on the field are lost; those that left by an exit survive and step back a tile."}</div>
            </>
          )}
          {m.loot && (
            <div className="mt-auto pt-1.5 border-t border-fa-line" data-testid="battle-result-loot">
              <div className="fa-label">{m.loot.banked ? 'Gold for your treasury' : 'Battle loot'}</div>
              {m.loot.banked
                ? <div className="fa-num text-[13px]">GOLD <span className="text-fa-good">+{m.loot.gold}</span></div>
                : <div className="text-[11.5px] text-fa-muted leading-snug"><span className="fa-num">{m.loot.gold}</span> gold was looted and spent inside the battle. None of it reaches your treasury.</div>}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 min-w-0 text-[12px] text-fa-muted leading-snug" data-testid="battle-result-auto">{pending ? 'One moment: the campaign is checking the battle order by order.' : m.auto}</div>
        <button type="button" onClick={onContinue} disabled={pending} className="fa-btn fa-btn-primary fa-btn-hero !min-h-[50px] !px-8 shrink-0 disabled:opacity-50" data-testid="battle-continue">Continue</button>
      </div>
      </div>
    </div>
  );
};

export default BattleResultScreen;
