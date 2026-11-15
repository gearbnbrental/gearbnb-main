import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePromo } from '../../context/PromoContext';
import { recordCampsiteLead } from '../../data/campsites';
import type { Campsite } from '../../types/campsite';
import type { ContactChannel } from '../../utils/campsiteContact';
import { useProductViewOpen } from '../../utils/productView';
import { formatPromoOffer, isPromoBookable } from '../../utils/promo';

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** "15% off your first gear rental" from the live promo, or null when there's none for this visitor. */
function useRentalOfferLine(): string | null {
  const { promo, audience, nowMs } = usePromo();
  if (!promo || !audience || !isPromoBookable(promo, nowMs)) return null;
  const offer = formatPromoOffer(promo);
  return audience === 'everyone' ? `${offer} off GearBnB gear rentals` : `${offer} off your first GearBnB gear rental`;
}

/**
 * What a tap on a campsite's contact button opens. The tap records a lead (the campsite gets an
 * email with the same code; nothing about the camper is sent), and the camper gets the code to
 * mention, plus the campsite's GearBnB offer when it has one. Signed-out campers first see why an
 * account is worth it; "Maybe later" still takes them to the contact, never a dead end.
 */
export default function ContactCampsiteDialog({
  campsite,
  contact,
  onClose,
}: {
  campsite: Pick<Campsite, 'slug' | 'name' | 'gearbnbOffer' | 'gearbnbOfferTerms'>;
  contact: ContactChannel;
  onClose: () => void;
}) {
  useProductViewOpen();
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const rentalOffer = useRentalOfferLine();
  const [step, setStep] = useState<'sign-in' | 'contact'>(user ? 'contact' : 'sign-in');
  const [code, setCode] = useState<string | null>(null);
  const [codeFailed, setCodeFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // The tap itself is the lead: recorded once, as the dialog opens.
  useEffect(() => {
    let active = true;
    recordCampsiteLead(campsite.slug, contact.channel).then(
      (next) => active && setCode(next),
      () => active && setCodeFailed(true),
    );
    return () => {
      active = false;
    };
  }, [campsite.slug, contact.channel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reason = `Sign in to contact ${campsite.name}.`;
  async function continueWithGoogle() {
    setSigningIn(true);
    const result = await signInWithGoogle(pathname);
    // On success the whole page leaves for Google; only a failure comes back here.
    if (result.error) setSigningIn(false);
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const benefits = [
    `We'll tell ${campsite.name} you found them through GearBnB`,
    campsite.gearbnbOffer && `${campsite.gearbnbOffer} at ${campsite.name} with your GearBnB code`,
    'Leave a review after your trip',
    rentalOffer && `Get ${rentalOffer}`,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-campsite-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        {step === 'sign-in' ? (
          <>
            <h2 id="contact-campsite-title" className="font-serif text-xl font-bold text-ink sm:text-2xl">
              Sign in to contact {campsite.name}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {benefits.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-forest/10 text-brand-forest">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={signingIn}
                className="rounded-lg bg-brand-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:opacity-60"
              >
                {signingIn ? 'Opening Google…' : 'Continue with Google'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: pathname, mode: 'login', reason } })}
                className="rounded-lg border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong"
              >
                Sign in with email
              </button>
              <button type="button" onClick={() => setStep('contact')} className="py-2 text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                Maybe later
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="contact-campsite-title" className="font-serif text-xl font-bold text-ink sm:text-2xl">
              Contact {campsite.name}
            </h2>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-brand-forest/40 bg-brand-forest/5 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Your GearBnB code</p>
              {code ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-bold tracking-wider text-ink">{code}</span>
                  <button type="button" onClick={copyCode} className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink hover:bg-surface-strong">
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ) : codeFailed ? (
                <p className="text-sm text-ink-muted">We couldn&rsquo;t get your code just now. Tell them you found them on GearBnB.</p>
              ) : (
                <span className="h-8 w-32 animate-pulse rounded bg-surface-strong" aria-label="Getting your code" />
              )}
              {!codeFailed && (
                <p className="text-sm text-ink">
                  Mention it when you {contact.verb}
                  {campsite.gearbnbOffer ? (
                    <>
                      {' '}
                      to get <span className="font-semibold">{campsite.gearbnbOffer}</span>.
                    </>
                  ) : (
                    ' so they know you found them on GearBnB.'
                  )}
                </p>
              )}
              {campsite.gearbnbOffer && campsite.gearbnbOfferTerms && <p className="text-xs text-ink-muted">{campsite.gearbnbOfferTerms}</p>}
            </div>
            <a
              href={contact.href}
              {...(contact.newTab ? { target: '_blank', rel: 'nofollow noopener noreferrer' } : {})}
              className="rounded-lg bg-brand-forest px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              {contact.openLabel}
            </a>
            <button type="button" onClick={onClose} className="py-1 text-sm font-medium text-ink-muted hover:text-ink">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
