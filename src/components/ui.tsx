import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { Violation } from '../rules';

/**
 * The shared surface. Everything that holds content is one of these, so the glass recipe
 * lives in a single place and the two palettes stay consistent with each other.
 */
export function Card({
  children,
  className = '',
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <div
      className={`glass rounded-2xl p-4 ${elevated ? 'glass-strong' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary:
      'accent-fill text-accent-text shadow-md hover:shadow-lg active:shadow-sm hover:scale-[1.02] transition-all',
    secondary:
      'border border-border/60 bg-text/[0.08] text-text hover:bg-text/[0.14] active:bg-text/[0.1]',
    ghost: 'text-muted hover:text-text hover:bg-text/[0.08]',
    danger: 'bg-danger text-white shadow-md hover:shadow-lg active:shadow-sm hover:scale-[1.02] transition-all',
  }[variant];
  return (
    <button
      {...props}
      className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition duration-150 disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

/** Inputs are inset rather than raised — the opposite treatment to a card. */
export const inputClass =
  'min-h-11 w-full rounded-xl border border-border/60 bg-text/[0.04] px-3 text-base text-text placeholder:text-muted/70 transition focus:border-accent-2/50';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

/**
 * A segmented control. Used for the rule-set toggle, gender and position, where the
 * options are few and seeing them all at once matters more than saving space.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; sublabel?: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1.5 rounded-lg border border-border/40 bg-text/[0.04] p-1.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-9 flex-1 rounded-md px-2.5 text-sm font-semibold transition duration-150 ${
              active
                ? 'accent-fill text-accent-text shadow-md'
                : 'text-muted hover:bg-text/8 hover:text-text'
            }`}
          >
            <span className="block leading-tight">{o.label}</span>
            {o.sublabel ? (
              <span className={`block text-[11px] font-normal ${active ? 'opacity-80' : ''}`}>
                {o.sublabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
}) {
  const styles = {
    neutral: 'bg-text/[0.07] text-muted ring-text/10',
    ok: 'bg-ok/15 text-ok ring-ok/25',
    warn: 'bg-warn/15 text-warn ring-warn/25',
    danger: 'bg-danger/15 text-danger ring-danger/25',
    accent: 'bg-accent-2/15 text-accent-2 ring-accent-2/30',
  }[tone];
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles}`}
    >
      {children}
    </span>
  );
}

/** Rule violations, each shown with the rule it comes from so the verdict is checkable. */
export function Violations({ items }: { items: Violation[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((v, i) => (
        <li
          key={i}
          className={`flex gap-2 rounded-lg px-2.5 py-2 text-xs leading-snug ring-1 ring-inset ${
            v.level === 'error'
              ? 'bg-danger/10 text-danger ring-danger/20'
              : 'bg-warn/10 text-warn ring-warn/20'
          }`}
        >
          <span
            aria-hidden="true"
            className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-current/15 text-[10px] font-bold"
          >
            {v.level === 'error' ? '!' : 'i'}
          </span>
          <span>
            {v.message} <span className="opacity-70">({v.citation})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-text/[0.02] px-4 py-12 text-center">
      <p className="font-semibold tight text-sm">{title}</p>
      {children ? <div className="mt-2 text-xs text-muted">{children}</div> : null}
    </div>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="tight text-[1.75rem] font-bold leading-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm leading-snug text-muted">{subtitle}</p> : null}
    </header>
  );
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="px-4 pt-4 text-sm text-muted hover:text-accent-2 hover:scale-105 transition duration-150"
    >
      ← {label}
    </button>
  );
}

export function ScreenLayout({
  onBack,
  backLabel = 'Back',
  children,
}: {
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <BackButton onClick={onBack} label={backLabel} />
      {children}
    </div>
  );
}
