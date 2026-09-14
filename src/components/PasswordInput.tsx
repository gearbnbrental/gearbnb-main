import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

const INPUT_CLASS =
  'h-11 w-full rounded-lg border border-line px-3 pr-11 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  /** 'current-password' for a login/reauthentication field, 'new-password' everywhere a new one is
   *  being chosen — browsers use this to decide whether to offer a saved or a generated password. */
  autoComplete: 'current-password' | 'new-password';
  id?: string;
  minLength?: number;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Rendered on the input itself (not just announced) when the field is in an error state. */
  invalid?: boolean;
}

/**
 * A password field with a show/hide toggle. The toggle only ever flips this input's own `type`
 * between "password" and "text" — the value is never copied anywhere, logged, or persisted, and
 * every field starts hidden, so revealing it is always a deliberate act by the person at the
 * keyboard.
 *
 * Visibility state is deliberately per-instance rather than shared: revealing the "New Password"
 * field must never also reveal "Confirm New Password" sitting right beside it.
 */
export default function PasswordInput({
  value,
  onChange,
  autoComplete,
  id,
  minLength,
  placeholder = '••••••••',
  onFocus,
  onBlur,
  invalid,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={
          invalid
            ? `${INPUT_CLASS} border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500`
            : INPUT_CLASS
        }
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        // The input itself is the labelled control; this is a supplementary toggle, so it gets its
        // own label rather than inheriting the field's.
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        // tabIndex -1 keeps Tab moving straight from this field to the next one (the expected
        // typing path); the toggle stays reachable by click/touch and by shift-tabbing back.
        tabIndex={-1}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-strong hover:text-ink"
      >
        {visible ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
}
