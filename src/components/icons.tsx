export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

export function GearPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75 9.75 8.25 15.75 14.25 21.75 8.25M2.25 15.75V19.5A1.5 1.5 0 0 0 3.75 21H20.25A1.5 1.5 0 0 0 21.75 19.5V15.75M2.25 15.75 4.5 13.5"
      />
    </svg>
  );
}

export function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 20.25v-1.5a3.75 3.75 0 0 0-3.75-3.75h-3a3.75 3.75 0 0 0-3.75 3.75v1.5M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
      />
    </svg>
  );
}

export function TruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a.375.375 0 0 1-.375-.375V15m0 0V6.75A2.25 2.25 0 0 1 5.25 4.5h7.5A2.25 2.25 0 0 1 15 6.75v8.25m0 0h3.75m-3.75 0V9.75h3.75a2.25 2.25 0 0 1 1.591.659l1.5 1.5A2.25 2.25 0 0 1 21 13.5v3.375c0 .207-.168.375-.375.375H18.75m0 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0"
      />
    </svg>
  );
}

export function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

export function ChevronIcon({ direction, className }: { direction: 'left' | 'right'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15.75 19.5 8.25 12l7.5-7.5' : 'm8.25 4.5 7.5 7.5-7.5 7.5'}
      />
    </svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.198 0l7.355 12.748c1.154 2-.29 4.5-2.6 4.5H4.646c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Same glyph SocialLinks.tsx uses for Facebook — kept as one shared path so every Facebook
 * button on the site (icon-only or labeled) renders identically. */
export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M14 8.5h2.5V5.5H14c-2.2 0-4 1.8-4 4v2H7.5v3H10V19h3v-4.5h2.5l.5-3H13v-2c0-.55.45-1 1-1Z" />
    </svg>
  );
}

/** Same glyph SocialLinks.tsx uses for TikTok — see FacebookIcon's note above. */
export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M15.5 4.5h-2.3v10.4a2.1 2.1 0 1 1-1.7-2.06V10.5a4.2 4.2 0 1 0 4 4.2V9.4a5.5 5.5 0 0 0 3.2 1V8.1a3.2 3.2 0 0 1-3.2-3.2v-.4Z" />
    </svg>
  );
}

/** Generic chat-bubble glyph for the "Message Us"/Messenger CTAs and the floating help widget —
 * deliberately not a reproduction of Facebook's own Messenger logo (this codebase has no confirmed
 * Messenger destination yet, see config/social.ts's MESSAGE_US_URL), just a plain, recognizable
 * "send a message" indicator. */
export function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 11.5c0 4.14-4.03 7.5-9 7.5-1.06 0-2.08-.15-3.02-.43L4 20l1.08-3.24C4.4 15.6 4 14.14 4 12.5 4 8.36 8.03 5 13 5s8 3.36 8 6.5Z"
      />
    </svg>
  );
}

/** Used only where config/social.ts's CONTACT_EMAIL is actually confirmed non-null — see the
 * footer's "Get in Touch" section, which omits the email row entirely otherwise. */
export function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0-.83.67-1.5 1.5-1.5h16.5c.83 0 1.5.67 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6.75Zm1.5 0 8.25 6 8.25-6"
      />
    </svg>
  );
}

/** A small campfire/flame glyph — used as the "help while you're deciding" icon on the
 * post-package-grid CTA, echoing the client's camping-themed reference. */
export function CampfireIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c1 2 .3 3.1-.4 4.1-.8 1.1-1.6 2.2-.1 4C12.5 9.7 14 8.6 14 7c1.8 1.6 3 3.7 3 5.8A5 5 0 0 1 12 18a5 5 0 0 1-5-5.2C7 10.2 8.6 8.6 9.5 7c-.7 2 .2 3 1 3.5"
      />
      <path strokeLinecap="round" d="M8.25 19.5h7.5" />
    </svg>
  );
}

/** A short arrow — the "→" already used as plain text on several CTA buttons (Go to Cart →, View
 * All Packages) rendered as an actual SVG for contexts where a following-icon reads more cleanly
 * than a literal arrow character (e.g. a small circular affordance). */
export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0-5.5-5.5M19.5 12l-5.5 5.5" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M2.25 12a9.75 9.75 0 1 1 19.5 0 9.75 9.75 0 0 1-19.5 0Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53-1.471-1.47a.75.75 0 0 0-1.06 1.06l2.1 2.1a.75.75 0 0 0 1.14-.094l3.747-5.254Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

/** Small decorative value-card icon ("Simple") — About Us page's "Our Promise" section. */
export function LeafIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 3.75c.414 8.284-4.5 14.25-12.75 14.25H3.75v-3.75C3.75 8.25 9.716 3.336 18 3.75c.75.037 1.5.037 2.25 0Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 20.25 12 12" />
    </svg>
  );
}

/** Small decorative value-card icon ("Prepared") — About Us page's "Our Promise" section. */
export function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M12 3c2.5 1.667 4.833 2.5 7 2.5 0 8.5-4.5 12.5-7 15.5-2.5-3-7-7-7-15.5 2.167 0 4.5-.833 7-2.5Z"
      />
    </svg>
  );
}

/** Small decorative value-card icon ("Memorable") — About Us page's "Our Promise" section. */
export function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.5 9.5-1.5 5-5 1.5 1.5-5 5-1.5Z"
      />
    </svg>
  );
}

/** Section-header icon for payment-related cards (Payment Summary, Payment Breakdown) — My
 *  Bookings' booking-detail cards. */
export function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <rect x="2.25" y="5.25" width="19.5" height="13.5" rx="2" />
      <path strokeLinecap="round" d="M2.25 9.75h19.5" />
      <path strokeLinecap="round" d="M5.25 15h4.5" />
    </svg>
  );
}

/** Section-header icon for the Quick Actions card — My Bookings' booking-detail cards. */
export function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2.25 4.5 13.5h6l-1 8.25L18.5 10.5h-6l.5-8.25Z" />
    </svg>
  );
}

export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.774 3.162 10.066 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}
