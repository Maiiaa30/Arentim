import type { ReactNode } from 'react';
import { CoinIcon } from '@/components/CoinIcon';

/** Shared shell for the login / signup screens. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card animate-fade-in p-8">
        <div className="mb-6 flex items-center gap-2">
          <CoinIcon className="h-7 w-7" />
          <span className="font-display text-xl font-bold tracking-tight">
            Arent<span className="text-gold">im</span>
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-text">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Play money only — no real currency involved.</p>
    </div>
  );
}
