import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

/**
 * The clean action bar: Desistir / Passar / Pagar / Subir plus the raise slider.
 * Purely presentational — every handler and amount is computed in the page and
 * passed in, so game logic is untouched.
 */
interface PokerActionBarProps {
  owe: number;
  callAmount: number;
  raiseTo: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canRaise: boolean;
  busy: boolean;
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
  onFold,
  onCheck,
  onCall,
  onRaise,
  onRaiseChange,
}: PokerActionBarProps) {
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
          Subir para {formatAmount(raiseTo)}
        </Button>
      </div>

      {canRaise && (
        <div className="rounded-[6px] border border-border bg-bg/60 px-4 py-3">
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
            onChange={(e) => onRaiseChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer rounded-full accent-gold"
            aria-label="Valor da subida"
          />
        </div>
      )}
    </div>
  );
}
