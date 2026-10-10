import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
  type CookieConsent as Choice,
} from '../utils/cookieConsent';

/**
 * Cookie notice: Meta Pixel only loads after the visitor accepts (Data Privacy Act consent for
 * tracking cookies). A floating card: full width near the bottom on phones; on desktop on the
 * left side, just above the accessibility button so the button stays visible. "Cookie Settings"
 * shows the two cookie types with a switch for the optional one. Shown until a choice is made, and
 * again from the footer's "Cookie Settings" link.
 */
export default function CookieConsent() {
  const [open, setOpen] = useState(() => readCookieConsent() === null);
  const [showSettings, setShowSettings] = useState(false);
  const [allowMeasurement, setAllowMeasurement] = useState(() => readCookieConsent() === 'granted');

  useEffect(() => {
    const reopen = () => {
      setAllowMeasurement(readCookieConsent() === 'granted');
      setShowSettings(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  if (!open) return null;

  function choose(choice: Choice) {
    saveCookieConsent(choice);
    setOpen(false);
    setShowSettings(false);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-notice-title"
      className="fixed inset-x-3 bottom-3 z-[65] flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:bottom-16 sm:left-3 sm:right-auto sm:w-full sm:max-w-md sm:p-5"
    >
      <h2 id="cookie-notice-title" className="font-serif text-lg font-semibold text-ink">
        Cookie Notice
      </h2>

      {!showSettings ? (
        <p className="text-sm text-ink-muted">
          We use cookies to improve your browsing experience, understand website traffic, and help our website work
          smoothly. Tap Accept to allow cookies that help us measure our ads, or Decline to keep only essential cookies.
          You can manage your preferences anytime.{' '}
          <Link to="/privacy-policy#cookies" className="font-medium text-accent underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          <li className="flex items-center justify-between gap-3 p-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">Essential</span>
              <span className="block text-xs text-ink-muted">Keep you signed in, hold your cart and keep the site secure. Always on.</span>
            </span>
            <span className="shrink-0 rounded-full bg-surface-strong px-2.5 py-1 text-xs font-semibold text-ink-muted">Always on</span>
          </li>
          <li className="flex items-center justify-between gap-3 p-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">Measurement and ads (Meta Pixel)</span>
              <span className="block text-xs text-ink-muted">Count visits and see how our Facebook and Instagram ads perform.</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={allowMeasurement}
              aria-label="Measurement and ads cookies"
              onClick={() => setAllowMeasurement((value) => !value)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${allowMeasurement ? 'bg-brand-forest' : 'bg-line'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${allowMeasurement ? 'left-[1.375rem]' : 'left-0.5'}`}
              />
            </button>
          </li>
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {!showSettings ? (
          <>
            <button
              type="button"
              onClick={() => choose('granted')}
              className="flex-1 rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-dark"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => choose('denied')}
              className="flex-1 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-full whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-accent underline underline-offset-2 hover:text-brand-forest-dark sm:w-auto sm:flex-1"
            >
              Cookie Settings
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => choose(allowMeasurement ? 'granted' : 'denied')}
              className="flex-1 rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-dark"
            >
              Save Choices
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="flex-1 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
