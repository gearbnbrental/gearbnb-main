import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { STICKY_FOOTER_ROUTES } from './FloatingHelp';
import {
  A11Y_DEFAULTS,
  A11Y_PROFILES,
  STEP_LIMITS,
  applyA11ySettings,
  isDefault,
  readA11ySettings,
  saveA11ySettings,
  toggleProfile,
  type A11ySettings,
} from '../utils/accessibility';

const COLORS = ['#1d4ed8', '#7e22ce', '#b91c1c', '#c2410c', '#0f766e', '#3f6212', '#ffffff', '#000000'];
const USEFUL_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Catalog', to: '/catalog' },
  { label: 'Packages', to: '/catalog/camping-packages' },
  { label: 'Build Your Own', to: '/catalog/build-your-own' },
  { label: 'Plan an Event', to: '/plan-an-event' },
  { label: 'About Us', to: '/about-us' },
  { label: 'My Bookings', to: '/my-bookings' },
  { label: 'Cart', to: '/cart' },
];

function Icon({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  scale: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  font: 'M4 7V5h10v2M9 5v14M7 19h4M15 13h6M18 10v9',
  lineHeight: 'M3 7l3-3 3 3M6 4v16M3 17l3 3 3-3M12 6h9M12 12h9M12 18h9',
  letterSpacing: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  readable: 'M4 18l5-12 5 12M6 14h6M16 8h5M16 12h5M16 16h5',
  titles: 'M6 4v16M18 4v16M6 12h12',
  links: 'M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1',
  alignLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alignCenter: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alignRight: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  dark: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  light: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  contrast: 'M12 3a9 9 0 100 18V3z M12 3a9 9 0 010 18',
  drop: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M3 3l18 18',
  stop: 'M13 3L5 13h6l-1 8 8-10h-6l1-8z',
  guide: 'M3 12h18M3 9h18M3 15h18',
  mask: 'M3 4h18v5H3zM3 15h18v5H3z',
  hover: 'M5 5h14v14H5zM9 9h6v6H9z',
  focus: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z',
  cursor: 'M5 3l13 9-6 1 4 7-3 1.5-4-7-4 4z',
  close: 'M6 6l12 12M18 6L6 18',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  link: 'M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1',
} as const;

function Tile({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-[13px] font-medium transition-colors ${
        active ? 'border-brand-forest bg-brand-forest text-white' : 'border-transparent bg-[#f3f5f7] text-ink hover:border-line'
      }`}
    >
      <Icon d={icon} />
      {label}
    </button>
  );
}

function Stepper({
  icon,
  label,
  value,
  min,
  max,
  format,
  onChange,
}: {
  icon: string;
  label: string;
  value: number;
  min: number;
  max: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-xl bg-[#f3f5f7] p-3">
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <Icon d={icon} className="h-4 w-4" />
        {label}
      </span>
      <div className="flex w-full max-w-[14rem] items-center justify-between rounded-full bg-white p-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-forest text-white disabled:opacity-40"
        >
          −
        </button>
        <span className="text-xs font-semibold text-accent" aria-live="polite">
          {value === 0 ? 'Default' : format(value)}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-forest text-white disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string | null; onChange: (color: string | null) => void }) {
  return (
    <div className="col-span-2 flex flex-col items-center gap-2 rounded-xl bg-[#f3f5f7] p-3">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div className="flex flex-wrap justify-center gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`${label}: ${color}`}
            aria-pressed={value === color}
            className={`h-6 w-6 rounded-full border border-black/15 ${value === color ? 'ring-2 ring-brand-forest ring-offset-2' : ''}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-ink-muted underline">
          Cancel
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Accessibility panel: a round button in the bottom-left corner opens a panel with one-tap
 * profiles and individual adjustments (text size, contrast, colours, reading aids, cursor...).
 * Settings are remembered in this browser and re-applied on every visit.
 */
export default function AccessibilityWidget() {
  const [settings, setSettings] = useState<A11ySettings>(() => readA11ySettings());
  const [open, setOpen] = useState(false);
  const [pointerY, setPointerY] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lifted = STICKY_FOOTER_ROUTES.has(location.pathname);

  useEffect(() => {
    applyA11ySettings(settings);
    saveA11ySettings(settings);
  }, [settings]);

  // The app root gets re-rendered on route changes but keeps its element, so zoom stays applied;
  // this re-applies once after each navigation just in case.
  useEffect(() => {
    applyA11ySettings(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const needsPointer = settings.readingGuide || settings.readingMask;
  useEffect(() => {
    if (!needsPointer) return;
    const move = (event: PointerEvent) => setPointerY(event.clientY);
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [needsPointer]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const set = <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const flip = (key: 'readableFont' | 'highlightTitles' | 'highlightLinks' | 'hideImages' | 'stopAnimations' | 'readingGuide' | 'readingMask' | 'highlightHover' | 'highlightFocus') =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  const pick = <K extends 'align' | 'contrast' | 'saturation' | 'cursor'>(key: K, value: A11ySettings[K]) =>
    setSettings((s) => ({ ...s, [key]: s[key] === value ? 'default' : value }));
  const percent = (step: number) => `${step > 0 ? '+' : ''}${step * 10}%`;
  const level = (step: number) => `Level ${step}`;

  const band = 64;

  return createPortal(
    <div className="a11y-widget">
      {/* Reading guide and reading mask follow the pointer; they never block clicks. */}
      {settings.readingGuide && pointerY !== null && (
        <div aria-hidden="true" className="a11y-invert-back pointer-events-none fixed inset-x-0 z-[78] h-2 rounded-full bg-amber-400/80 shadow" style={{ top: pointerY + 14 }} />
      )}
      {settings.readingMask && pointerY !== null && (
        <>
          <div aria-hidden="true" className="a11y-invert-back pointer-events-none fixed inset-x-0 top-0 z-[78] bg-black/60" style={{ height: Math.max(0, pointerY - band / 2) }} />
          <div aria-hidden="true" className="a11y-invert-back pointer-events-none fixed inset-x-0 bottom-0 z-[78] bg-black/60" style={{ top: pointerY + band / 2 }} />
        </>
      )}

      {/* The client's own accessibility icon (public/images/accessibility-icon.png): a green
          circle with a white figure, transparent outside the circle. Kept small (36px) and tucked
          into the corner, in the page's side gutter below the content, so it stays out of the way
          while scrolling; still above the 24px minimum tap size. On pages with the sticky cart bar
          (65px tall) it sits just above the bar, with the same small gap. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Accessibility settings"
        aria-expanded={open}
        className={`hide-in-product-view a11y-invert-back fixed left-1.5 z-50 h-9 w-9 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:left-3 ${
          lifted ? 'bottom-[4.75rem]' : 'bottom-2 sm:bottom-3'
        }`}
      >
        <img src="/images/accessibility-icon.png" alt="" width={36} height={36} className="h-9 w-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]" />
        {!isDefault(settings) && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400" />
        )}
      </button>

      {open && (
        <div className="a11y-invert-back fixed inset-0 z-[80] flex justify-end bg-black/30" onClick={() => setOpen(false)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="a11y-title"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col bg-[#eef1f4] shadow-2xl"
          >
            <div className="shrink-0 bg-brand-forest px-4 pb-4 pt-3 text-white">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setOpen(false)} aria-label="Close accessibility settings" className="rounded-full p-1 hover:bg-white/15">
                  <Icon d={ICONS.close} />
                </button>
                <h2 id="a11y-title" className="text-lg font-semibold">
                  Accessibility Adjustments
                </h2>
                <span className="w-7" aria-hidden="true" />
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setSettings(A11Y_DEFAULTS)}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-accent hover:bg-white/90"
                >
                  <Icon d={ICONS.reset} className="h-4 w-4" />
                  Reset Settings
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
              <Section title="Customize your browsing experience">
                <ul className="divide-y divide-line">
                  {A11Y_PROFILES.map((profile) => {
                    const on = settings.profiles.includes(profile.id);
                    return (
                      <li key={profile.id} className="flex items-center gap-3 py-2.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={profile.title}
                          onClick={() => setSettings((s) => toggleProfile(s, profile.id))}
                          className="flex shrink-0 rounded-full bg-[#f3f5f7] p-1 text-[11px] font-bold"
                        >
                          <span className={`rounded-full px-2.5 py-1 ${!on ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'}`}>OFF</span>
                          <span className={`rounded-full px-2.5 py-1 ${on ? 'bg-brand-forest text-white shadow-sm' : 'text-ink-muted'}`}>ON</span>
                        </button>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink">{profile.title}</span>
                          <span className="block text-xs text-ink-muted">{profile.description}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Section>

              <Section title="Content Adjustments">
                <div className="grid grid-cols-3 gap-2">
                  <Stepper icon={ICONS.scale} label="Content Scaling" value={settings.contentScale} {...STEP_LIMITS.contentScale} format={percent} onChange={(v) => set('contentScale', v)} />
                  <Tile icon={ICONS.readable} label="Readable Font" active={settings.readableFont} onClick={() => flip('readableFont')} />
                  <Stepper icon={ICONS.font} label="Font Size" value={settings.fontSize} {...STEP_LIMITS.fontSize} format={percent} onChange={(v) => set('fontSize', v)} />
                  <Tile icon={ICONS.titles} label="Highlight Titles" active={settings.highlightTitles} onClick={() => flip('highlightTitles')} />
                  <Stepper icon={ICONS.lineHeight} label="Line Height" value={settings.lineHeight} {...STEP_LIMITS.lineHeight} format={level} onChange={(v) => set('lineHeight', v)} />
                  <Tile icon={ICONS.links} label="Highlight Links" active={settings.highlightLinks} onClick={() => flip('highlightLinks')} />
                  <Stepper icon={ICONS.letterSpacing} label="Letter Spacing" value={settings.letterSpacing} {...STEP_LIMITS.letterSpacing} format={level} onChange={(v) => set('letterSpacing', v)} />
                  <Tile icon={ICONS.alignLeft} label="Align Left" active={settings.align === 'left'} onClick={() => pick('align', 'left')} />
                  <Tile icon={ICONS.alignCenter} label="Align Center" active={settings.align === 'center'} onClick={() => pick('align', 'center')} />
                  <Tile icon={ICONS.alignRight} label="Align Right" active={settings.align === 'right'} onClick={() => pick('align', 'right')} />
                </div>
              </Section>

              <Section title="Color Adjustments">
                <div className="grid grid-cols-3 gap-2">
                  <Tile icon={ICONS.dark} label="Dark Contrast" active={settings.contrast === 'dark'} onClick={() => pick('contrast', 'dark')} />
                  <Tile icon={ICONS.light} label="Light Contrast" active={settings.contrast === 'light'} onClick={() => pick('contrast', 'light')} />
                  <Tile icon={ICONS.contrast} label="High Contrast" active={settings.contrast === 'high'} onClick={() => pick('contrast', 'high')} />
                  <Tile icon={ICONS.drop} label="High Saturation" active={settings.saturation === 'high'} onClick={() => pick('saturation', 'high')} />
                  <Tile icon={ICONS.drop} label="Monochrome" active={settings.saturation === 'mono'} onClick={() => pick('saturation', 'mono')} />
                  <Tile icon={ICONS.drop} label="Low Saturation" active={settings.saturation === 'low'} onClick={() => pick('saturation', 'low')} />
                  <div className="col-span-3 grid grid-cols-2 gap-2 [&>*]:col-span-2">
                    <ColorPicker label="Adjust Text Colors" value={settings.textColor} onChange={(c) => set('textColor', c)} />
                    <ColorPicker label="Adjust Title Colors" value={settings.titleColor} onChange={(c) => set('titleColor', c)} />
                    <ColorPicker label="Adjust Background Colors" value={settings.backgroundColor} onChange={(c) => set('backgroundColor', c)} />
                  </div>
                </div>
              </Section>

              <Section title="Orientation Adjustments">
                <div className="grid grid-cols-3 gap-2">
                  <Tile icon={ICONS.image} label="Hide Images" active={settings.hideImages} onClick={() => flip('hideImages')} />
                  <Tile icon={ICONS.stop} label="Stop Animations" active={settings.stopAnimations} onClick={() => flip('stopAnimations')} />
                  <Tile icon={ICONS.guide} label="Reading Guide" active={settings.readingGuide} onClick={() => flip('readingGuide')} />
                  <Tile icon={ICONS.mask} label="Reading Mask" active={settings.readingMask} onClick={() => flip('readingMask')} />
                  <Tile icon={ICONS.hover} label="Highlight Hover" active={settings.highlightHover} onClick={() => flip('highlightHover')} />
                  <Tile icon={ICONS.focus} label="Highlight Focus" active={settings.highlightFocus} onClick={() => flip('highlightFocus')} />
                  <Tile icon={ICONS.cursor} label="Big Black Cursor" active={settings.cursor === 'black'} onClick={() => pick('cursor', 'black')} />
                  <Tile icon={ICONS.cursor} label="Big White Cursor" active={settings.cursor === 'white'} onClick={() => pick('cursor', 'white')} />
                  <label className="col-span-3 flex flex-col items-center gap-2 rounded-xl bg-[#f3f5f7] p-3">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <Icon d={ICONS.link} className="h-4 w-4" />
                      Useful Links
                    </span>
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        navigate(e.target.value);
                        setOpen(false);
                      }}
                      className="w-full rounded-full border border-line bg-white px-4 py-2 text-sm text-ink"
                    >
                      <option value="">Select a page</option>
                      {USEFUL_LINKS.map((link) => (
                        <option key={link.to} value={link.to}>
                          {link.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
