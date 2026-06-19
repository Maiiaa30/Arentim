import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

/**
 * The action bar: Desistir / Passar / Pagar / Subir, plus quick bet-sizing
 * chips and a clamped raise slider. Purely presentational — every handler and
 * amount is computed in the page and passed in, so game logic is untouched.
 */
interface PokerActionBarProps {
  owe: number;
  callAmount: number;
  raiseTo: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canRaise: boolean;
  busy: boolean;
  /** Quick raise-to presets (½ pot, pot, all-in…), already clamped to range. */
  quickBets: { label: string; to: number }[];
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: () => void;
  onRaiseChange: (v: number) => void;
}

export function PokerActionBar({
  owe,
  callAmount,
  raiseTo,
  minRaiseTo,
  maxRaiseTo,
  canRaise,
  busy,
  quickBets,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onRaiseChange,
}: PokerActionBarProps) {
  const sliderDisabled = busy || !canRaise || maxRaiseTo <= minRaiseTo;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button variant="danger" onClick={onFold} disabled={busy} className="min-h-[44px] w-full px-3">
          Desistir
        </Button>
        {owe === 0 ? (
          <Button variant="secondary" onClick={onCheck} disabled={busy} className="min-h-[44px] w-full px-3">
            Passar
          </Button>
        ) : (
          <Button variant="primary" onClick={onCall} disabled={busy} className="min-h-[44px] w-full px-3">
            Pagar {formatAmount(callAmount)}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={onRaise}
          disabled={busy || !canRaise}
          className="col-span-2 min-h-[44px] w-full px-3 sm:col-span-1"
        >
          {owe > 0 ? 'Subir para' : 'Apostar'} {formatAmount(raiseTo)}
        </Button>
      </div>

      {canRaise && (
        <div className="rounded-[6px] border border-border bg-bg/60 px-4 py-3">
          {/* Quick bet-sizing chips */}
          {quickBets.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {quickBets.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => onRaiseChange(q.to)}
                  disabled={busy}
                  aria-pressed={raiseTo === q.to}
                  className={`focus-ring rounded-full border px-2.5 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
                    raiseTo === q.to ? 'border-gold bg-gold/15 text-gold' : 'border-border text-muted hover:text-text'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between font-mono text-[11px] tabular-nums text-muted">
            <span>{formatAmount(minRaiseTo)}</span>
            <span className="flex items-center gap-1 text-gold-light">
              <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(raiseTo)}
            </span>
            <span>{formatAmount(maxRaiseTo)}</span>
          </div>
          <input
            id="raise"
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            value={raiseTo}
            disabled={sliderDisabled}
            onChange={(e) => onRaiseChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer rounded-full accent-gold disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Valor da subida"
          />
        </div>
      )}
    </div>
  );
}
