const INPUT_CLASS =
  'h-11 flex-1 min-w-0 rounded-lg border border-line px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  autoComplete?: string;
}

/**
 * The one phone-number entry field, reused everywhere this app asks for one (currently: signup
 * only — GearBnB is Philippines-only, and this number is contact information, never an
 * authentication factor). Shows a fixed "+63" prefix so the customer never has to type it
 * themselves — this is purely a VISUAL prefix, never text concatenated into the actual value, so
 * there is no way for it to produce a doubled "+63+63" or similar: `value` is exactly what the
 * customer typed, and ../utils/phone's normalizePhoneNumber does the actual +63 prefixing when it
 * normalizes the value for storage.
 */
export default function PhoneNumberInput({ value, onChange, id, autoComplete = 'tel' }: PhoneNumberInputProps) {
  return (
    <div className="flex gap-2">
      <span
        aria-hidden="true"
        className="flex h-11 shrink-0 items-center rounded-lg border border-line bg-surface-muted px-3 text-sm font-medium text-ink-muted"
      >
        +63
      </span>
      <input
        id={id}
        type="tel"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="917 123 4567"
        className={INPUT_CLASS}
      />
    </div>
  );
}
