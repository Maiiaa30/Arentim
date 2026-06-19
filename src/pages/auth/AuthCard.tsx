import type { ReactNode } from 'react';
import { Monogram } from '@/components/ui/primitives';

/** Shared shell for the login / signup screens. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card animate-fade-in p-8">
        <div className="mb-6 flex items-center gap-3">
          <Monogram letter="A" size={36} />
          <span className="font-sans text-base font-medium tracking-[0.4em] text-text">ARENTIM</span>
        </div>
        <p className="eyebrow mb-2">Casa de Jogos</p>
        <h1 className="font-display text-3xl font-medium text-text">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-2">
        Apenas dinheiro de brincadeira — sem moeda real.
      </p>
    </div>
  );
}
