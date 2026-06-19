import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

// Aretim buttons: uppercase DM Sans, wide tracking, 4px radius.
// - primary  : solid gold fill — the single decisive action in a flow.
// - secondary: ghost with a softer gold border — fills gold on hover.
// - ghost    : ghost with a full gold border — the signature public-surface CTA.
// - danger   : muted red ghost.
const base =
  'focus-ring inline-flex items-center justify-center gap-2 rounded px-6 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ease-aretim disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-bg hover:bg-gold-light',
  ghost: 'border border-gold text-gold hover:bg-gold hover:text-bg',
  secondary: 'border border-gold/40 text-gold hover:border-gold hover:bg-gold hover:text-bg',
  danger: 'border border-negative/50 text-negative hover:bg-negative hover:text-bg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', className = '', disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
