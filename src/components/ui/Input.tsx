import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', ...props },
  ref,
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`focus-ring w-full rounded border bg-bg px-3 py-2.5 font-sans text-sm text-body placeholder:text-faint ${
          error ? 'border-negative' : 'border-border focus:border-gold'
        } ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <p className="text-xs text-negative">{error}</p>}
    </div>
  );
});
