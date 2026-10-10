/**
 * Settings for the site's accessibility panel (src/components/AccessibilityWidget.tsx), and the
 * pure helpers that turn them into page styles. Saved in this browser only.
 */

export type A11yAlign = 'default' | 'left' | 'center' | 'right';
export type A11yContrast = 'default' | 'dark' | 'light' | 'high';
export type A11ySaturation = 'default' | 'high' | 'low' | 'mono';
export type A11yCursor = 'default' | 'black' | 'white';
export type A11yProfileId = 'seizure' | 'lowVision' | 'adhd' | 'cognitive' | 'keyboard' | 'olderAdults';

export interface A11ySettings {
  /** Whole-page zoom steps: 0 = 100%, each step 10% (range -2..4). */
  contentScale: number;
  /** Text size steps: 0 = default, each step 10% (range -1..4). */
  fontSize: number;
  /** Line height steps 0..3 (default, 1.6, 1.9, 2.2). */
  lineHeight: number;
  /** Letter spacing steps 0..3 (default, 0.05em, 0.1em, 0.15em). */
  letterSpacing: number;
  readableFont: boolean;
  highlightTitles: boolean;
  highlightLinks: boolean;
  align: A11yAlign;
  contrast: A11yContrast;
  saturation: A11ySaturation;
  textColor: string | null;
  titleColor: string | null;
  backgroundColor: string | null;
  hideImages: boolean;
  stopAnimations: boolean;
  readingGuide: boolean;
  readingMask: boolean;
  highlightHover: boolean;
  highlightFocus: boolean;
  cursor: A11yCursor;
  profiles: A11yProfileId[];
}

export const A11Y_DEFAULTS: A11ySettings = {
  contentScale: 0,
  fontSize: 0,
  lineHeight: 0,
  letterSpacing: 0,
  readableFont: false,
  highlightTitles: false,
  highlightLinks: false,
  align: 'default',
  contrast: 'default',
  saturation: 'default',
  textColor: null,
  titleColor: null,
  backgroundColor: null,
  hideImages: false,
  stopAnimations: false,
  readingGuide: false,
  readingMask: false,
  highlightHover: false,
  highlightFocus: false,
  cursor: 'default',
  profiles: [],
};

export const STEP_LIMITS = {
  contentScale: { min: -2, max: 4 },
  fontSize: { min: -1, max: 4 },
  lineHeight: { min: 0, max: 3 },
  letterSpacing: { min: 0, max: 3 },
} as const;

export const LINE_HEIGHTS = ['', '1.6', '1.9', '2.2'];
export const LETTER_SPACINGS = ['', '0.05em', '0.1em', '0.15em'];

type Preset = Partial<Omit<A11ySettings, 'profiles'>>;

/** One-tap profiles: each switches on a set of the adjustments below. */
export const A11Y_PROFILES: { id: A11yProfileId; title: string; description: string; preset: Preset }[] = [
  { id: 'seizure', title: 'Seizure Safety', description: 'Reduce motion and visual triggers', preset: { stopAnimations: true, saturation: 'low' } },
  {
    id: 'lowVision',
    title: 'Low Vision Support',
    description: 'Improve clarity and contrast',
    preset: { fontSize: 1, contrast: 'high', readableFont: true, highlightTitles: true },
  },
  { id: 'adhd', title: 'ADHD Friendly', description: 'Support focus and reduce distractions', preset: { readingMask: true, stopAnimations: true, highlightFocus: true, contrast: 'high' } },
  {
    id: 'cognitive',
    title: 'Reading & Cognitive Support',
    description: 'Simplify reading and navigation',
    preset: { readableFont: true, highlightTitles: true, highlightLinks: true, lineHeight: 1 },
  },
  { id: 'keyboard', title: 'Keyboard Navigation', description: 'Use the website with the keyboard', preset: { highlightFocus: true } },
  {
    id: 'olderAdults',
    title: 'Older Adults',
    description: 'Enhance visibility and reading comfort',
    preset: { fontSize: 1, lineHeight: 1, cursor: 'black', highlightLinks: true },
  },
];

/** Turns a profile on (adds its adjustments) or off (puts back the defaults for its adjustments,
 *  except where another profile that's still on wants them). */
export function toggleProfile(settings: A11ySettings, id: A11yProfileId): A11ySettings {
  const profile = A11Y_PROFILES.find((p) => p.id === id);
  if (!profile) return settings;
  if (!settings.profiles.includes(id)) {
    return { ...settings, ...profile.preset, profiles: [...settings.profiles, id] };
  }
  const remaining = settings.profiles.filter((p) => p !== id);
  const next: A11ySettings = { ...settings, profiles: remaining };
  for (const key of Object.keys(profile.preset) as (keyof Preset)[]) {
    const keeper = A11Y_PROFILES.find((p) => remaining.includes(p.id) && key in p.preset);
    (next as unknown as Record<string, unknown>)[key] = keeper ? keeper.preset[key] : A11Y_DEFAULTS[key];
  }
  return next;
}

/** The CSS filter for the whole page: dark contrast (inverted colours), high contrast, saturation. */
export function pageFilter(settings: A11ySettings): string {
  const parts: string[] = [];
  if (settings.contrast === 'dark') parts.push('invert(1) hue-rotate(180deg)');
  if (settings.contrast === 'high') parts.push('contrast(1.4)');
  if (settings.saturation === 'high') parts.push('saturate(2)');
  if (settings.saturation === 'low') parts.push('saturate(0.5)');
  if (settings.saturation === 'mono') parts.push('grayscale(1)');
  return parts.join(' ');
}

export function isDefault(settings: A11ySettings): boolean {
  return JSON.stringify({ ...settings, profiles: [] }) === JSON.stringify({ ...A11Y_DEFAULTS, profiles: [] }) && settings.profiles.length === 0;
}

const STORAGE_KEY = 'gearbnb-accessibility';

export function readA11ySettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return A11Y_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<A11ySettings>;
    return { ...A11Y_DEFAULTS, ...parsed, profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [] };
  } catch {
    return A11Y_DEFAULTS;
  }
}

export function saveA11ySettings(settings: A11ySettings): void {
  try {
    if (isDefault(settings)) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: the settings still apply for this visit.
  }
}

/** Applies the settings to the page: classes and styles on <html>, zoom on the app root. The
 *  panel itself lives outside the app root, so zoom and the colour pickers never shrink or hide it. */
export function applyA11ySettings(settings: A11ySettings): void {
  const html = document.documentElement;
  const toggles: Record<string, boolean> = {
    'a11y-readable-font': settings.readableFont,
    'a11y-highlight-titles': settings.highlightTitles,
    'a11y-highlight-links': settings.highlightLinks,
    'a11y-align-left': settings.align === 'left',
    'a11y-align-center': settings.align === 'center',
    'a11y-align-right': settings.align === 'right',
    'a11y-dark-contrast': settings.contrast === 'dark',
    'a11y-light-contrast': settings.contrast === 'light',
    'a11y-hide-images': settings.hideImages,
    'a11y-stop-animations': settings.stopAnimations,
    'a11y-highlight-hover': settings.highlightHover,
    'a11y-highlight-focus': settings.highlightFocus,
    'a11y-cursor-black': settings.cursor === 'black',
    'a11y-cursor-white': settings.cursor === 'white',
    'a11y-line-height': settings.lineHeight > 0,
    'a11y-letter-spacing': settings.letterSpacing > 0,
    'a11y-text-color': settings.textColor !== null,
    'a11y-title-color': settings.titleColor !== null,
    'a11y-bg-color': settings.backgroundColor !== null,
  };
  for (const [name, on] of Object.entries(toggles)) html.classList.toggle(name, on);

  html.style.filter = pageFilter(settings);
  html.style.fontSize = settings.fontSize === 0 ? '' : `${100 + settings.fontSize * 10}%`;
  html.style.setProperty('--a11y-line-height', LINE_HEIGHTS[settings.lineHeight] || 'normal');
  html.style.setProperty('--a11y-letter-spacing', LETTER_SPACINGS[settings.letterSpacing] || 'normal');
  html.style.setProperty('--a11y-text-color', settings.textColor ?? 'inherit');
  html.style.setProperty('--a11y-title-color', settings.titleColor ?? 'inherit');
  html.style.setProperty('--a11y-bg-color', settings.backgroundColor ?? 'transparent');

  const root = document.getElementById('root');
  if (root) root.style.zoom = settings.contentScale === 0 ? '' : String(1 + settings.contentScale * 0.1);
}
