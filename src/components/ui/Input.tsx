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
        <label htmlFor={id} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`focus-ring w-full rounded-xl border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted ${
          error ? 'border-negative' : 'border-border'
        } ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <p className="text-xs text-negative">{error}</p>}
    </div>
  );
});
