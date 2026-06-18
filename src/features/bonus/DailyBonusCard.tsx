import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { useClaimDailyBonus } from './useDailyBonus';
import { deriveBonusState, rewardForDay, MAX_STREAK_DAY } from './dailyBonus';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

export function DailyBonusCard() {
  const { data: profile } = useProfile();
  const claim = useClaimDailyBonus();
  const [message, setMessage] = useState<string | null>(null);

  if (!profile) return null;

  const state = deriveBonusState(profile);
  const filled = Math.min(state.currentStreak, MAX_STREAK_DAY);
  const nextDay = Math.min(state.prospectiveStreak, MAX_STREAK_DAY);

  async function onClaim() {
    setMessage(null);
    try {
      const res = await claim.mutateAsync();
      if (res.status === 'claimed') {
        setMessage(`+${formatAmount(res.reward)} Tostões · day ${Math.min(res.streak, MAX_STREAK_DAY)} streak!`);
      } else if (res.status === 'play_required') {
        setMessage('Play a round first to unlock today’s bonus.');
      } else {
        setMessage('Already claimed today — come back tomorrow.');
      }
    } catch {
      setMessage('Could not claim right now. Try again.');
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text">Daily bonus</h2>
          <p className="text-sm text-muted">
            {state.status === 'claimed_today'
              ? `Claimed today · ${state.currentStreak} day streak 🔥`
              : state.status === 'play_required'
                ? 'Play one round today to unlock your bonus.'
                : `Claim your day ${nextDay} reward.`}
          </p>
        </div>

        <Button
          onClick={onClaim}
          disabled={state.status !== 'claimable' || claim.isPending}
          className={state.status === 'claimable' ? 'shadow-soft ring-1 ring-gold/40' : ''}
        >
          {state.status === 'claimed_today' ? (
            'Claimed'
          ) : claim.isPending ? (
            'Claiming…'
          ) : (
            <>
              <CoinIcon className="h-4 w-4" />
              Claim {formatAmount(state.claimableReward)}
            </>
          )}
        </Button>
      </div>

      {/* 7-pip progress bar previewing the next reward. */}
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {Array.from({ length: MAX_STREAK_DAY }, (_, i) => {
          const day = i + 1;
          const isFilled = day <= filled;
          const isNext = state.status === 'claimable' && day === nextDay;
          return (
            <div key={day} className="text-center">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  isFilled ? 'bg-gold' : isNext ? 'bg-gold/40' : 'bg-border'
                }`}
              />
              <span
                className={`mt-1 block text-[10px] tabular-nums ${
                  isNext ? 'text-gold' : 'text-muted'
                }`}
              >
                {formatAmount(rewardForDay(day))}
              </span>
            </div>
          );
        })}
      </div>

      {message && <p className="mt-3 text-sm text-positive">{message}</p>}
    </section>
  );
}
