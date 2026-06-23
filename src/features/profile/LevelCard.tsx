import { useState } from 'react';
import { useClaimLevelRewards } from './useProfile';
import { levelInfo, rewardBetween } from './level';
import { LevelBadge } from './LevelBadge';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount, formatTostoes } from '@/lib/format';
import type { Profile } from '@/types/db';

export function LevelCard({ profile }: { profile: Profile }) {
  const claim = useClaimLevelRewards();
  const [msg, setMsg] = useState<string | null>(null);

  const info = levelInfo(profile.total_wagered);
  const claimed = profile.levels_claimed ?? 0;
  const pendingLevels = Math.max(0, info.level - claimed);
  const pendingReward = pendingLevels > 0 ? rewardBetween(claimed, info.level) : 0;

  async function onClaim() {
    setMsg(null);
    try {
      const res = await claim.mutateAsync();
      if (res.status === 'claimed') setMsg(`Resgatou +${formatTostoes(res.reward ?? 0)} de recompensas de nível!`);
      else setMsg('Sem recompensas por resgatar de momento.');
    } catch {
      setMsg('Não foi possível resgatar agora. Tente outra vez.');
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-display text-lg font-semibold text-gold">
            {info.level}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-medium text-text">Nível {info.level}</h2>
              <LevelBadge level={info.level} />
            </div>
            <p className="font-sans text-sm text-muted-2">
              {formatAmount(profile.total_wagered)} de experiência (apostado)
            </p>
          </div>
        </div>
        {pendingLevels > 0 && (
          <Button variant="primary" onClick={onClaim} disabled={claim.isPending} className="shrink-0">
            {claim.isPending ? 'A resgatar…' : (
              <>
                <CoinIcon className="h-4 w-4" /> Resgatar {formatAmount(pendingReward)}
              </>
            )}
          </Button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between font-mono text-xs tabular-nums text-muted-2">
          <span>Nível {info.level}</span>
          <span>
            {formatAmount(info.intoLevel)} / {formatAmount(info.span)} → Nv {info.level + 1}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={info.progressPct}
          aria-label="Progresso de nível"
        >
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500"
            style={{ width: `${info.progressPct}%` }}
          />
        </div>
      </div>

      {msg && <p className="mt-3 animate-fade-in font-sans text-sm font-medium text-positive">{msg}</p>}
    </section>
  );
}
