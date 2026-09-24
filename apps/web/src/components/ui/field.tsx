import { AnimatePresence, motion } from 'motion/react';
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';

import { cn } from '@/lib/utils';

const control =
  'peer w-full rounded-2xl border border-border bg-surface px-4 text-[15px] text-fg placeholder:text-subtle transition-[border-color,box-shadow] duration-200 outline-none focus:border-accent focus:ring-4 focus:ring-ring aria-[invalid=true]:border-sale aria-[invalid=true]:focus:ring-sale/20 disabled:opacity-60';

interface FieldShellProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  id: string;
  children: ReactNode;
  className?: string | undefined;
}

function FieldShell({ label, error, hint, id, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fg/80">
        {label}
      </label>
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error !== undefined ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="text-[13px] text-sale"
          >
            {error}
          </motion.p>
        ) : hint !== undefined ? (
          <motion.p key="hint" className="text-[13px] text-muted">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, trailing, className, containerClassName, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell label={label} error={error} hint={hint} id={inputId} className={containerClassName}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? `${inputId}-error` : undefined}
          className={cn(control, 'h-12', trailing !== undefined && 'pr-12', className)}
          {...props}
        />
        {trailing !== undefined && (
          <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>
        )}
      </div>
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell label={label} error={error} id={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error !== undefined}
        className={cn(control, 'min-h-32 resize-y py-3', className)}
        {...props}
      />
    </FieldShell>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | undefined;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell label={label} error={error} id={inputId}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={error !== undefined}
        className={cn(control, 'h-12 appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }
>(function Checkbox({ label, className, id, ...props }, ref) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <label
      htmlFor={inputId}
      className={cn('flex cursor-pointer items-center gap-3 text-sm', className)}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="size-[18px] cursor-pointer rounded-md border-border accent-[var(--accent)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
});
