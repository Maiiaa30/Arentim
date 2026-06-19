import type { ReactNode } from 'react';
import { Eyebrow } from '@/components/ui/primitives';

interface PagePlaceholderProps {
  title: string;
  description: string;
  /** Eyebrow overline shown above the heading. */
  phase?: string;
  children?: ReactNode;
}

/**
 * Temporary scaffold for routes whose real content arrives later.
 * Keeps the shell navigable while the app is built out surface by surface.
 */
export function PagePlaceholder({ title, description, phase, children }: PagePlaceholderProps) {
  return (
    <section className="animate-fade-in">
      {phase && <Eyebrow>{phase}</Eyebrow>}
      <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text">{title}</h1>
      <p className="mt-2 max-w-2xl font-sans text-sm text-muted-2">{description}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}
