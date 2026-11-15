import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, MapPinIcon } from '../icons';
import { searchPlaces } from '../../utils/geocode';
import type { Place } from '../../utils/travel';
import {
  MUST_HAVES,
  NEAR_MANILA_LABEL,
  NEAR_ME_LABEL,
  NETWORKS,
  activeFilterCount,
  type CampsiteFilters as Filters,
  type MustHave,
  type NetworkName,
} from '../../utils/campsites';

interface Option {
  label: string;
  count: number;
}

const controlClass =
  'flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 text-left text-sm font-semibold text-ink shadow-sm transition-colors hover:border-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/20';
const labelClass = 'flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-forest-dark';

/** Small line icons for the filter labels. */
function FieldIcon({ kind }: { kind: 'pin' | 'map' | 'tent' | 'sliders' }) {
  const paths = {
    pin: <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
    map: <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14" />,
    tent: <path d="M3 20h18M4.5 20 12 5l7.5 15M12 5l-2.5 15M12 5l2.5 15" />,
    sliders: <path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4.5v5M8 14.5v5" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-accent" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

/**
 * A button that opens a list of tick boxes (pick as many as you like). Closes on a click outside
 * or Escape; the ticks apply as they change.
 */
function CheckboxDropdown({ label, icon, summary, children }: { label: string; icon: 'tent' | 'sliders'; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <span id={labelId} className={labelClass}>
        <FieldIcon kind={icon} />
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${panelId}-summary`}
        onClick={() => setOpen((value) => !value)}
        className={controlClass}
      >
        <span id={`${panelId}-summary`} className={`truncate ${summary ? 'text-ink' : 'font-medium text-ink-muted'}`}>
          {summary || `Select ${label.toLowerCase()}`}
        </span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-accent transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, disabled = false, children }: { checked: boolean; onChange: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${disabled ? 'cursor-not-allowed text-ink-faint' : 'cursor-pointer text-ink hover:bg-line-soft'}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="h-4 w-4 shrink-0 accent-brand-forest" />
      <span className="flex-1">{children}</span>
    </label>
  );
}

/**
 * "Your location": type a town or city and pick it from the suggestions, or use the phone's own
 * location. Used for "Within 3 hours from me" and the drive time on each card.
 */
function LocationField({ value, onChange }: { value: Place | null; onChange: (place: Place | null) => void }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const inputId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(text, controller.signal).then(
        (places) => {
          setSuggestions(places);
          setActive(-1);
          setOpen(true);
          setStatus(places.length ? null : 'No matching place in the Philippines.');
        },
        (error: unknown) => {
          if ((error as Error).name !== 'AbortError') setStatus('Place search isn\u2019t working right now. Try "Use my location".');
        },
      );
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [text]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  function choose(place: Place) {
    onChange(place);
    setText('');
    setSuggestions([]);
    setOpen(false);
    setStatus(null);
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setStatus('Your browser can\u2019t share your location. Type your town instead.');
      return;
    }
    setLocating(true);
    setStatus(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        choose({ name: 'My current location', lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setStatus('We couldn\u2019t get your location. Allow location access, or type your town instead.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className={labelClass}>
        <FieldIcon kind="pin" />
        Your Location
      </label>
      {value ? (
        <div className={`${controlClass} cursor-default`}>
          <span className="flex min-w-0 items-center gap-2">
            <MapPinIcon className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">{value.name}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} aria-label="Clear your location" className="text-lg leading-none text-ink-muted hover:text-ink">
            ×
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setOpen(true);
                setActive((index) => Math.min(suggestions.length - 1, index + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) => Math.max(0, index - 1));
              } else if (event.key === 'Enter' && open && suggestions[active >= 0 ? active : 0]) {
                event.preventDefault();
                choose(suggestions[active >= 0 ? active : 0]);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder="Enter your town or city"
            className={`${controlClass} pr-11 placeholder:font-medium placeholder:text-ink-muted`}
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            aria-label="Use my current location"
            title="Use my current location"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-accent hover:bg-line-soft disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={`h-5 w-5 ${locating ? 'animate-pulse' : ''}`} aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
          <ul
            id={listId}
            role="listbox"
            hidden={!open || suggestions.length === 0}
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
          >
            {suggestions.map((place, index) => (
              <li
                key={`${place.name}-${index}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(place);
                }}
                className={`cursor-pointer px-4 py-2.5 text-sm text-ink ${index === active ? 'bg-line-soft' : 'hover:bg-line-soft'}`}
              >
                {place.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {status && (
        <p role="status" className="text-xs text-ink-muted">
          {status}
        </p>
      )}
    </div>
  );
}

const toggle = <T,>(list: readonly T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

const mustHaveLabel = (key: MustHave) =>
  key === 'nearMe' ? NEAR_ME_LABEL : key === 'nearManila' ? NEAR_MANILA_LABEL : MUST_HAVES.find((item) => item.key === key)!.label;
const networkLabel = (name: NetworkName) => `${NETWORKS.find((network) => network.name === name)!.brands} signal`;

/**
 * The directory's filter bar: Province, Camping Type (tick several) and Filters (must-haves to
 * tick), with the active ones shown as removable chips underneath.
 */
export default function CampsiteFilters({
  filters,
  onChange,
  options,
  showProvince = true,
  from,
  onFromChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  options: { provinces: Option[]; types: Option[] };
  showProvince?: boolean;
  /** Where the camper is starting from. */
  from: Place | null;
  onFromChange: (place: Place | null) => void;
}) {
  const provinceId = useId();
  const set = (next: Partial<Filters>) => onChange({ ...filters, ...next });

  const typeSummary = filters.types.join(', ');
  const mustSummary = [...filters.mustHaves.map(mustHaveLabel), ...filters.networks.map(networkLabel)].join(', ');

  const chips: { label: string; remove: () => void }[] = [
    ...(showProvince && filters.province ? [{ label: filters.province, remove: () => set({ province: '' }) }] : []),
    ...filters.types.map((type) => ({ label: type, remove: () => set({ types: toggle(filters.types, type) }) })),
    ...filters.mustHaves.map((key) => ({ label: mustHaveLabel(key), remove: () => set({ mustHaves: toggle(filters.mustHaves, key) }) })),
    ...filters.networks.map((name) => ({ label: networkLabel(name), remove: () => set({ networks: toggle(filters.networks, name) }) })),
    ...(filters.activity ? [{ label: filters.activity, remove: () => set({ activity: '' }) }] : []),
    ...(filters.maxFee > 0 ? [{ label: `Entrance up to ₱${filters.maxFee}`, remove: () => set({ maxFee: 0 }) }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className={`grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-lg sm:grid-cols-2 sm:p-5 ${showProvince ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <LocationField value={from} onChange={onFromChange} />
        {showProvince && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={provinceId} className={labelClass}>
              <FieldIcon kind="map" />
              Province
            </label>
            <div className="relative">
              <select
                id={provinceId}
                value={filters.province}
                onChange={(event) => set({ province: event.target.value })}
                className={`${controlClass} appearance-none pr-10 ${filters.province ? '' : 'font-medium text-ink-muted'}`}
              >
                <option value="">Select province</option>
                {options.provinces.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
            </div>
          </div>
        )}

        <CheckboxDropdown label="Camping Type" icon="tent" summary={typeSummary}>
          {options.types.length === 0 ? (
            <p className="px-2 py-2 text-sm text-ink-muted">No camping types yet.</p>
          ) : (
            <fieldset>
              <legend className="sr-only">Camping type</legend>
              {options.types.map((option) => (
                <Checkbox key={option.label} checked={filters.types.includes(option.label)} onChange={() => set({ types: toggle(filters.types, option.label) })}>
                  {option.label} <span className="text-ink-muted">({option.count})</span>
                </Checkbox>
              ))}
            </fieldset>
          )}
        </CheckboxDropdown>

        <CheckboxDropdown label="Filters" icon="sliders" summary={mustSummary}>
          <fieldset>
            <legend className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Must have</legend>
            {MUST_HAVES.map((item) => (
              <Checkbox key={item.key} checked={filters.mustHaves.includes(item.key)} onChange={() => set({ mustHaves: toggle(filters.mustHaves, item.key) })}>
                {item.label}
              </Checkbox>
            ))}
            <Checkbox checked={!!from && filters.mustHaves.includes('nearMe')} disabled={!from} onChange={() => set({ mustHaves: toggle(filters.mustHaves, 'nearMe') })}>
              {NEAR_ME_LABEL}
              {!from && <span className="block text-xs text-ink-muted">Add your location first</span>}
            </Checkbox>
          </fieldset>
          <fieldset className="mt-1 border-t border-line-soft pt-1">
            <legend className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Signal on my network</legend>
            {NETWORKS.map((network) => (
              <Checkbox key={network.name} checked={filters.networks.includes(network.name)} onChange={() => set({ networks: toggle(filters.networks, network.name) })}>
                {network.brands}
              </Checkbox>
            ))}
          </fieldset>
        </CheckboxDropdown>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.remove}
              aria-label={`Remove filter: ${chip.label}`}
              className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-ink"
            >
              {chip.label}
              <span aria-hidden="true" className="text-base leading-none">
                ×
              </span>
            </button>
          ))}
          {activeFilterCount(showProvince ? filters : { ...filters, province: '' }) > 1 && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, province: showProvince ? '' : filters.province, types: [], activity: '', mustHaves: [], networks: [], maxFee: 0 })}
              className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
