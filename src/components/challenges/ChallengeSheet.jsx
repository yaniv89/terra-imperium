// src/components/challenges/ChallengeSheet.jsx
// The weekly challenge (differentiation plan U36): ChallengeEntry is the start screen's button and
// sheet (this week's challenge, the leaderboard or a "not connected" note, Start); ChallengeBanner
// is the in-game progress chip that offers Submit once the turn limit is reached.
import React, { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { isoWeekId, challengeForWeek } from '../../engine/challenges';
import { fetchLeaderboard, submitChallenge } from '../../services/challenges';
import { getSupabaseClient, isCloudSaveConfigured } from '../../services/supabaseClient';
import { getCurrentUser } from '../../services/auth';
import { useGame } from '../../context/GameContext';

const client = () => (isCloudSaveConfigured ? getSupabaseClient() : null);
const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-semibold';

export const ChallengeEntry = ({ onStart }) => {
  const { t, name: nm } = useT();
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState(null);
  const challenge = useMemo(() => challengeForWeek(isoWeekId(new Date())), []);
  useEffect(() => { if (open) fetchLeaderboard(client(), challenge.weekId).then(setBoard); }, [open, challenge]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btn} fixed top-2 end-2 z-20 bg-amber-600 hover:bg-amber-500 text-fa-text flex items-center gap-2`} data-testid="challenge-open">
        <Trophy className="w-4 h-4" /> {t('chal.button')}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" data-testid="challenge-sheet">
          <div className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl bg-fa-panel border border-amber-500/40 p-4 text-fa-text">
            <h2 className="text-base font-bold">{t('chal.title', { week: challenge.weekId })}</h2>
            <p className="text-sm mt-1">{t('chal.blurb', { people: nm('people', challenge.people, challenge.people), turns: challenge.turnLimit })}</p>
            <h3 className="text-sm font-semibold mt-3">{t('chal.board')}</h3>
            {board && !board.connected && <p className="text-sm text-amber-300" data-testid="challenge-offline">{t('chal.offline')}</p>}
            {board?.connected && !board.rows.length && <p className="text-sm text-fa-muted">{t('chal.empty')}</p>}
            {board?.connected && <ol className="text-sm mt-1">{board.rows.map((r, i) => <li key={i} className="flex justify-between"><span>{i + 1}. {r.display_name}</span><span>{r.score}</span></li>)}</ol>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => onStart({ challenge })} className={`${btn} flex-1 bg-amber-600 hover:bg-amber-500`} data-testid="challenge-start">{t('chal.start')}</button>
              <button type="button" onClick={() => setOpen(false)} className={`${btn} bg-fa-hover hover:bg-fa-line`}>{t('chal.close')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const ChallengeBanner = () => {
  const { t } = useT();
  const { challengeRun } = useGame();
  const [sent, setSent] = useState(null); // null | 'sending' | 'sent' | an error key
  if (!challengeRun) return null;
  const { turns, challenge } = challengeRun;
  const done = turns >= challenge.turnLimit;
  const send = async () => {
    setSent('sending');
    const sub = challengeRun.submission();
    const c = client();
    const r = await submitChallenge(c, c ? await getCurrentUser(c).catch(() => null) : null, sub);
    setSent(r.ok ? 'sent' : r.reason);
  };
  const note = sent === 'sent' ? t('chal.sent') : sent === 'offline' ? t('chal.fail.offline') : sent === 'signin' ? t('chal.fail.signin') : sent && sent !== 'sending' ? t('chal.fail.other', { reason: sent }) : null;
  return (
    <div className="fixed bottom-20 start-2 z-20 rounded-xl bg-fa-panel border border-amber-500/40 p-2 text-sm text-fa-text" data-testid="challenge-banner">
      <div>{t('chal.progress', { turns: Math.min(turns, challenge.turnLimit), limit: challenge.turnLimit })}</div>
      {done && sent !== 'sent' && <button type="button" onClick={send} disabled={sent === 'sending'} className={`${btn} mt-1 bg-amber-600 hover:bg-amber-500`}>{sent === 'sending' ? t('chal.sending') : t('chal.submit')}</button>}
      {note && <div className="mt-1">{note}</div>}
    </div>
  );
};
