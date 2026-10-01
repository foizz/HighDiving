import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { Violation } from '../rules';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-accent text-accent-text hover:brightness-110',
    secondary: 'bg-surface-2 text-text border border-border hover:brightness-105',
    ghost: 'text-muted hover:text-text',
    danger: 'bg-danger text-white hover:brightness-110',
  }[variant];
  return (
    <button
      {...props}
      className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 ${styles} ${className}`}
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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 ${className}`}
    />
  );
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
      className="flex gap-1 rounded-xl border border-border bg-surface-2 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
              active ? 'bg-accent text-accent-text' : 'text-muted hover:text-text'
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
    neutral: 'bg-surface-2 text-muted',
    ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/15 text-danger',
    accent: 'bg-accent-2/20 text-accent-2',
  }[tone];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles}`}>
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
          className={`flex gap-2 rounded-lg px-2.5 py-2 text-xs leading-snug ${
            v.level === 'error' ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn'
          }`}
        >
          <span aria-hidden="true" className="font-bold">
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
    <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
    </header>
  );
}
