/**
 * The visitor's cookie choice for non-essential tracking (Meta Pixel). Stored in this browser only.
 * index.html reads the same key to load the pixel straight away for someone who already accepted.
 */
export const COOKIE_CONSENT_KEY = 'gearbnb-cookie-consent';
export const OPEN_COOKIE_SETTINGS_EVENT = 'gearbnb:open-cookie-settings';

export type CookieConsent = 'granted' | 'denied';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    /** Defined in index.html: loads Meta Pixel (live site only). */
    gearbnbLoadPixel?: () => void;
  }
}

export function readCookieConsent(): CookieConsent | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function saveCookieConsent(choice: CookieConsent): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {
    // Storage blocked: the choice lasts for this page only, and the banner asks again next visit.
  }
  if (choice === 'granted') {
    window.gearbnbLoadPixel?.();
  } else {
    // Remove Meta's browser cookies if they were set by an earlier "Accept". (The pixel script
    // already loaded in this tab stops being used; it isn't loaded again on the next visit.)
    for (const name of ['_fbp', '_fbc']) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, '')}`;
    }
  }
}

/** Re-opens the cookie banner (the footer's "Cookie settings" link). */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}
