import type { ReactNode } from 'react';

interface PagePlaceholderProps {
  title: string;
  description: string;
  /** Which build phase will deliver this surface — shown as a small badge. */
  phase?: string;
  children?: ReactNode;
}

/**
 * Temporary scaffold for routes whose real content arrives in a later phase.
 * Keeps the shell navigable while the app is built out phase by phase.
 */
export function PagePlaceholder({ title, description, phase, children }: PagePlaceholderProps) {
  return (
    <section className="animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-text">{title}</h1>
        {phase && (
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
            {phase}
          </span>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}
