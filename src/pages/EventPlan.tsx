import { usePageMeta } from '../hooks/usePageMeta';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { CheckCircleIcon, CheckIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { describeRmsError, submitEventInquiry } from '../utils/rmsApi';

const TODAY = new Date().toISOString().slice(0, 10);

/** sessionStorage key for a form draft stashed right before redirecting a guest to /login —
 *  restored on return so submitting requires an account without making the customer re-type
 *  everything. sessionStorage (not localStorage): this only needs to survive the single
 *  login/signup round trip, not linger indefinitely — same reasoning as AuthContext's own
 *  OAUTH_RETURN_PATH_KEY. */
const DRAFT_STORAGE_KEY = 'gearbnb.eventplan.draft';

/** Whether the customer will specify their own equipment or wants Gearbnb to recommend it. There's
 * no dedicated EventInquiry column for this yet (see submission below) — kept local to this form
 * rather than adding one, per instruction not to touch the RMS schema for this. */
type EquipmentSelectionMode = 'CUSTOMER_SELECTS' | 'GEARBNB_RECOMMENDS';

/** Plain-language marker sent in the existing `requestedEquipment` field when the customer asks
 * Gearbnb to recommend equipment instead of listing any themselves — never a fake/invented
 * equipment list, just a clear signal for the admin reading the inquiry. */
const RECOMMENDATION_REQUESTED_TEXT = 'Equipment preference: Gearbnb recommendation requested — customer asked our team to recommend suitable equipment for this event.';

interface FormState {
  customerName: string;
  contactNumber: string;
  email: string;
  organization: string;
  eventType: string;
  estimatedParticipants: string;
  eventLocation: string;
  eventStartDate: string;
  eventEndDate: string;
  equipmentSelectionMode: EquipmentSelectionMode;
  requestedEquipment: string;
  specialRequests: string;
}

const initialForm: FormState = {
  customerName: '',
  contactNumber: '',
  email: '',
  organization: '',
  eventType: '',
  estimatedParticipants: '',
  eventLocation: '',
  eventStartDate: '',
  eventEndDate: '',
  equipmentSelectionMode: 'CUSTOMER_SELECTS',
  requestedEquipment: '',
  specialRequests: '',
};

const EQUIPMENT_MODE_OPTIONS: { value: EquipmentSelectionMode; title: string; description: string }[] = [
  {
    value: 'CUSTOMER_SELECTS',
    title: 'I know what I need',
    description: 'Continue describing the specific equipment you need for your event.',
  },
  {
    value: 'GEARBNB_RECOMMENDS',
    title: '🎒 Help me choose the right equipment',
    description:
      "Not sure what equipment you need for your event? No worries! Tell us about your event and our Gearbnb team can recommend suitable equipment for you.",
  },
];

const inputClass =
  'rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

function Field({ label, required = true, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">
        {label} {required && <span className="text-red-500 dark:text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}

export default function EventPlan() {
  usePageMeta(
    'Camping Gear Rental for Events & Team Building | GearBnB',
    'Plan your team-building or big event with camping gear rental. Get quality camping gear for groups and make your outdoor event hassle-free.',
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [inquiryNumber, setInquiryNumber] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const isCustomerSelecting = form.equipmentSelectionMode === 'CUSTOMER_SELECTS';

  // Restores whatever was typed before a guest got redirected to log in (see handleSubmit's
  // auth gate below) — one-time, so it never resurrects a draft after the customer has moved on.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      const draft = JSON.parse(raw) as Partial<FormState>;
      setForm((prev) => ({ ...prev, ...draft }));
    } catch {
      // Unavailable or corrupt — the form just starts blank, same as any first visit.
    }
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // An inquiry is a real, permanent record once submitted — gated here, before any validation
    // or network call, so a guest never has the inquiry created out from under them. The RMS
    // endpoint independently re-enforces this (see submitEventInquiry) — this is the friendly
    // layer, not the actual security boundary.
    if (!user) {
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
      } catch {
        // Storage unavailable — the customer just has to re-enter their details after logging in.
      }
      navigate('/login', {
        state: {
          from: location.pathname,
          mode: 'login',
          reason: 'Please log in or create an account to submit your event inquiry.',
        },
      });
      return;
    }

    const participants = Number(form.estimatedParticipants);
    if (!Number.isFinite(participants) || participants < 1) {
      setSubmitError('Enter a valid estimated number of participants.');
      return;
    }
    if (new Date(form.eventEndDate) < new Date(form.eventStartDate)) {
      setSubmitError("Event end can't be before its start.");
      return;
    }
    // Only required when the customer is specifying their own equipment — "Help me choose" never
    // requires (or sends) an equipment list, per the whole point of that option.
    if (isCustomerSelecting && !form.requestedEquipment.trim()) {
      setSubmitError('Let us know what equipment you need, or choose "Help me choose the right equipment" instead.');
      return;
    }

    // An inquiry is a permanent record once submitted — confirmed before actually sending it,
    // same as a real booking submission.
    setShowSubmitConfirm(true);
  }

  async function performSubmit() {
    const participants = Math.round(Number(form.estimatedParticipants));
    setSubmitting(true);
    try {
      // Dates are submitted as end-of-day/start-of-day local timestamps — this is a planning
      // inquiry, not a timed pickup/return, so only the calendar dates actually matter here.
      const result = await submitEventInquiry({
        customerName: form.customerName.trim(),
        contactNumber: form.contactNumber.trim(),
        email: form.email.trim(),
        organization: form.organization.trim() || undefined,
        eventType: form.eventType.trim(),
        estimatedParticipants: participants,
        eventLocation: form.eventLocation.trim(),
        eventStartDate: new Date(`${form.eventStartDate}T00:00:00`).toISOString(),
        eventEndDate: new Date(`${form.eventEndDate}T23:59:59`).toISOString(),
        // The RMS's EventInquiry model has no dedicated "equipment preference" column — reusing
        // this existing free-text field is what Part 4 asks for rather than a schema change; the
        // fixed marker text below is never a fake equipment list, just a clear signal to the admin.
        requestedEquipment: isCustomerSelecting ? form.requestedEquipment.trim() : RECOMMENDATION_REQUESTED_TEXT,
        specialRequests: form.specialRequests.trim() || undefined,
      });
      setShowSubmitConfirm(false);
      setInquiryNumber(result.inquiryNumber);
    } catch (err) {
      // Closes the dialog so the page's own error banner is visible again, same reasoning as
      // PaymentBreakdown's performSubmit.
      setShowSubmitConfirm(false);
      setSubmitError(describeRmsError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (inquiryNumber) {
    const wantsRecommendation = form.equipmentSelectionMode === 'GEARBNB_RECOMMENDS';
    const nextSteps = [
      'Our Gearbnb team reviews your event details.',
      'A Gearbnb representative contacts you through your provided email.',
      wantsRecommendation
        ? "Since you asked us to help choose your equipment, we'll recommend suitable gear based on your event."
        : "We'll go over the equipment you requested and confirm what's available.",
      "If needed, we'll provide a customized quotation for your event.",
    ];

    return (
      // Same card treatment as the form state below (see its own comment) — a customer landing
      // here right after submitting must never see the card suddenly vanish, which would read as
      // a broken transition rather than "the same page, now showing confirmation."
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6">
      <div className="flex w-full flex-col items-center gap-6 rounded-2xl border border-line bg-surface p-6 text-center shadow-sm sm:p-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-forest text-white">
          <CheckCircleIcon className="h-10 w-10" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl font-semibold text-ink">Thank You for Your Inquiry! 🎉</h1>
          <p className="text-sm text-ink-muted">
            Your event inquiry has been successfully submitted. A Gearbnb representative will be reaching out shortly
            through your provided email.
          </p>
          <p className="text-xs text-ink-faint">
            Reference <span className="font-semibold text-ink">{inquiryNumber}</span>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 rounded-xl border border-line-soft bg-surface-muted p-4 text-left sm:p-5">
          <h2 className="text-sm font-semibold text-ink">What happens next?</h2>
          <ol className="flex flex-col gap-2 text-sm text-ink-muted">
            {nextSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-forest/10 text-[11px] font-semibold text-accent">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {wantsRecommendation && (
          <div className="flex w-full items-start gap-3 rounded-xl border border-brand-forest/30 bg-brand-forest/5 p-4 text-left">
            <span className="text-lg leading-none">🎒</span>
            <p className="text-sm text-ink-muted">
              Since you asked us to help choose your equipment, our team will review your event details and
              recommend suitable gear. We may also send you our equipment brochure through email.
            </p>
          </div>
        )}

        <p className="text-xs text-ink-faint">
          This is not a confirmed booking yet — we'll follow up by email or phone with next steps.
        </p>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/catalog"
            className="rounded-lg bg-brand-forest px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
          >
            Browse Rentals
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-brand-forest bg-brand-forest/10 px-6 py-3 text-center text-sm font-semibold text-accent transition-colors hover:bg-brand-forest/15"
          >
            Back to Home
          </Link>
        </div>
      </div>
      </div>
    );
  }

  return (
    // Wrapped in a distinct card (border/rounded/shadow on a `bg-surface` panel, sitting on the
    // page's own background) — matching the client's reference image and the same card pattern
    // already established elsewhere on the site (Login/ForgotPassword/ResetPassword). Previously
    // this form had no card at all — fields sat directly on the bare page background, which is
    // the actual structural gap the reference was pointing at, not a wording/field difference.
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6">
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">Plan an Event</h1>
        <p className="text-sm text-ink-muted">
          Planning a group trip, company outing, or larger event? Tell us what you need and we'll send you a custom
          quote — this isn't an instant booking, just the start of the conversation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your Name">
          <input required type="text" value={form.customerName} onChange={(e) => update('customerName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Contact Number">
          <input required type="tel" value={form.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <Field label="Email">
        <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
      </Field>

      <Field label="Organization / Company" required={false}>
        <input type="text" value={form.organization} onChange={(e) => update('organization', e.target.value)} placeholder="Optional" className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event Type">
          <input
            required
            type="text"
            value={form.eventType}
            onChange={(e) => update('eventType', e.target.value)}
            placeholder="e.g. Corporate outing, birthday, team building"
            className={inputClass}
          />
        </Field>
        <Field label="Estimated Participants">
          <input
            required
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={form.estimatedParticipants}
            onChange={(e) => update('estimatedParticipants', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Event Location / Venue">
        <input required type="text" value={form.eventLocation} onChange={(e) => update('eventLocation', e.target.value)} className={inputClass} />
      </Field>

      {/* grid-cols-2 at every width — same reasoning as Path A/B and Checkout's own Rental
          Dates fields: two native date inputs don't need a full-width row each on a phone. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Field label="Event Start Date">
          <input required type="date" min={TODAY} value={form.eventStartDate} onChange={(e) => update('eventStartDate', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Event End Date">
          <input
            required
            type="date"
            min={form.eventStartDate || TODAY}
            value={form.eventEndDate}
            onChange={(e) => update('eventEndDate', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-ink">
          Equipment / Gear Needed <span className="text-red-500 dark:text-red-400">*</span>
        </span>

        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Equipment selection preference">
          {EQUIPMENT_MODE_OPTIONS.map((option) => {
            const isActive = form.equipmentSelectionMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => update('equipmentSelectionMode', option.value)}
                className={`relative flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-colors ${
                  isActive ? 'border-brand-forest bg-brand-forest/5' : 'border-line bg-surface hover:border-brand-forest/50'
                }`}
              >
                {isActive && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-forest text-white">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                )}
                <span className="pr-6 text-sm font-semibold text-ink">{option.title}</span>
                <span className="text-xs text-ink-muted">{option.description}</span>
              </button>
            );
          })}
        </div>

        {isCustomerSelecting ? (
          <textarea
            required
            rows={3}
            value={form.requestedEquipment}
            onChange={(e) => update('requestedEquipment', e.target.value)}
            placeholder="e.g. 20 tents, camping chairs and tables for 50 pax, lighting..."
            className={`resize-none ${inputClass}`}
          />
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-brand-forest/30 bg-brand-forest/5 p-4">
            <span className="text-lg leading-none">🎒</span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-accent">Let us help! 🎒</p>
              <p className="text-sm text-ink-muted">
                Our Gearbnb team will review your event details and recommend suitable equipment. We may also send
                you our equipment brochure through your provided email.
              </p>
            </div>
          </div>
        )}
      </div>

      <Field label="Special Requests" required={false}>
        <textarea
          rows={2}
          value={form.specialRequests}
          onChange={(e) => update('specialRequests', e.target.value)}
          placeholder="Optional — anything else we should know"
          className={`resize-none ${inputClass}`}
        />
      </Field>

      {submitError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-forest px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
      >
        {submitting ? 'Submitting…' : 'Submit Inquiry'}
      </button>

      <ConfirmDialog
        open={showSubmitConfirm}
        title="Submit this event inquiry?"
        message="This sends your event details to the GearBnB team as a real inquiry — a representative will follow up by email or phone."
        confirmLabel="Submit Inquiry"
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={performSubmit}
      />
    </form>
    </div>
  );
}
