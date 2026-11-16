/**
 * GearBnB's own illustrated icon set for the homepage and About Us sections (how renting works,
 * why rent with us, our promise): a 24×24 grid, 1.5 line weight, rounded ends, drawn in
 * currentColor. Shown through IconSpot below. Decorative: the card titles next to them carry the
 * meaning.
 */
import type { ComponentType, ReactNode } from 'react';

interface IconProps {
  className?: string;
}

function GearbnbIcon({ className = 'h-5 w-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * The "spot illustration" look for these icons: no tile, the icon in deep forest green centered
 * over a soft, hand-shaped cream blob, with a small gold dot at the top right. Gold also fills the
 * icons' solid details (stars, flames, the lantern light). `lg` is for the larger promise cards.
 */
export function IconSpot({ icon: Icon, size = 'md' }: { icon: ComponentType<IconProps>; size?: 'md' | 'lg' }) {
  const large = size === 'lg';
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center text-brand-forest-dark ${large ? 'h-16 w-16' : 'h-14 w-14'}`}
    >
      <span className="absolute inset-0.5 -rotate-[8deg] rounded-[58%_42%_55%_45%/52%_44%_56%_48%] bg-brand-cream" />
      <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#f6c445]/85" />
      <Icon className={`relative [&_[fill=currentColor]]:fill-[#e0a100] ${large ? 'h-10 w-10' : 'h-9 w-9'}`} />
    </span>
  );
}

/** A tent and a lantern: choosing your setup. */
export function SelectGearIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M1.75 19.75H22.25" />
      <path d="M2.5 19.75C2.5 14 5.1 9.75 8.25 9.75S14 14 14 19.75" />
      <path d="M8.25 12.9 6.5 19.75M8.25 12.9 10 19.75" />
      <path d="M17.1 10.25a1.65 1.65 0 0 1 3.3 0" />
      <path d="M16.25 12.25h5" />
      <path d="M16.75 12.25c-.35 1.1-.5 2.1-.5 3.25s.15 2.15.5 3.25h4c.35-1.1.5-2.1.5-3.25s-.15-2.15-.5-3.25" />
      <path d="M18.75 17.1c-.6 0-1-.45-1-1 0-.65.5-1 1-1.85.5.85 1 1.2 1 1.85 0 .55-.4 1-1 1Z" fill="currentColor" stroke="none" />
    </GearbnbIcon>
  );
}

/** An ID card with a check: verifying and booking. */
export function VerifyBookIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M12.5 17H4.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v4.25" />
      <circle cx="7.5" cy="9.5" r="1.75" />
      <path d="M4.75 14.25c0-1.55 1.2-2.4 2.75-2.4s2.75.85 2.75 2.4" />
      <path d="M12.25 8.5H16.25M12.25 11.25H14.5" />
      <circle cx="18.25" cy="17" r="3.5" />
      <path d="m16.75 17.1 1 1 2-2.25" />
    </GearbnbIcon>
  );
}

/** A peso coin with a clock: the deposit, paid within 24 hours while we review. */
export function DepositReviewIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M17.20 11.38 A7.25 7.25 0 1 0 11.86 17.51" />
      <path d="M8.6 14.25V6.75H11a2.25 2.25 0 0 1 0 4.5H8.6" />
      <path d="M6.85 9H13.6" />
      <circle cx="17.75" cy="17.25" r="3.5" />
      <path d="M17.75 15.5V17.25L18.9 18.1" />
    </GearbnbIcon>
  );
}

/** A calendar with a tent: reserving your dates. */
export function ReserveDatesIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.25" />
      <path d="M8 3V6.75M16 3V6.75M3 9.5H21" />
      <path d="M8.25 18C8.25 15 9.9 13 12 13S15.75 15 15.75 18" />
      <path d="M12 14.9 10.85 18M12 14.9 13.15 18" />
      <path d="M7 18H17" />
    </GearbnbIcon>
  );
}

/** A car with gear on the roof: pickup or Lalamove/Grab delivery. */
export function PickupDeliveryIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M3.85 17.75H3.75a1.25 1.25 0 0 1-1.25-1.25v-2.25a1.5 1.5 0 0 1 1.5-1.5H5L7 9.5H16l2.5 3.25H20a1.5 1.5 0 0 1 1.5 1.5v2.25a1.25 1.25 0 0 1-1.25 1.25H20.1" />
      <path d="M11 17.75H13" />
      <path d="M5 12.75H18.5M11.6 9.5V12.75" />
      <circle cx="7.6" cy="17.75" r="2" />
      <circle cx="16.4" cy="17.75" r="2" />
      <rect x="6.75" y="4.75" width="10.5" height="2.75" rx="1.375" />
      <path d="M9.5 4.75V9.5M14.5 4.75V9.5" />
    </GearbnbIcon>
  );
}

/** A tent under three stars: quality gear. */
export function QualityGearIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M2 20.5H22" />
      <path d="M3.5 20.5C3.5 14.5 7.25 10.75 12 10.75S20.5 14.5 20.5 20.5" />
      <path d="M12 13.6 9.4 20.5M12 13.6 14.6 20.5" />
      <path d="M6.25 5.20 L6.76 6.39 L8.06 6.51 L7.08 7.37 L7.37 8.64 L6.25 7.97 L5.13 8.64 L5.42 7.37 L4.44 6.51 L5.74 6.39 Z" fill="currentColor" strokeWidth={0.6} />
      <path d="M12.00 2.55 L12.55 3.84 L13.95 3.97 L12.90 4.89 L13.20 6.26 L12.00 5.54 L10.80 6.26 L11.10 4.89 L10.05 3.97 L11.45 3.84 Z" fill="currentColor" strokeWidth={0.6} />
      <path d="M17.75 5.20 L18.26 6.39 L19.56 6.51 L18.58 7.37 L18.87 8.64 L17.75 7.97 L16.63 8.64 L16.92 7.37 L15.94 6.51 L17.24 6.39 Z" fill="currentColor" strokeWidth={0.6} />
    </GearbnbIcon>
  );
}

/** A phone with a tent on screen: booking online, easily. */
export function EasyConvenientIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <rect x="6" y="2.25" width="12" height="19.5" rx="2.5" />
      <path d="M10.75 4.85H13.25" />
      <path d="M8.75 14C8.75 11.45 10.2 9.6 12 9.6S15.25 11.45 15.25 14" />
      <path d="M12 11.4 11.05 14M12 11.4 12.95 14" />
      <path d="M8.25 14H15.75" />
      <rect x="9" y="16.6" width="6" height="2.3" rx="1.15" fill="currentColor" stroke="none" />
    </GearbnbIcon>
  );
}

/** A trail signpost: guidance for beginners. */
export function BeginnerFriendlyIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M12 4.75H18L20.25 7 18 9.25H12Z" />
      <path d="M12 11.5H6L3.75 13.75 6 16H12Z" />
      <path d="M12 2.75V4.75M12 9.25V11.5M12 16V21.25" />
      <path d="M8.5 21.25H15.5" />
    </GearbnbIcon>
  );
}

/** A campfire: memorable trips. */
export function MemorableTripsIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M12 15C9.5 15 8 13.25 8 11 8 8.5 10 7.25 10.75 4.5 11.75 5.75 12 6.5 12 7.5 12.75 6.75 13.25 6 13.5 5 15 6.5 16 8.5 16 11 16 13.25 14.5 15 12 15Z" />
      <path d="M12 15C10.9 15 10.25 14.2 10.25 13.25 10.25 12.15 11.15 11.5 12 10.25 12.85 11.5 13.75 12.15 13.75 13.25 13.75 14.2 13.1 15 12 15Z" fill="currentColor" stroke="none" />
      <path d="M4.5 20.75 19.5 17M4.5 17 19.5 20.75" />
    </GearbnbIcon>
  );
}

/** Two pine trees with a hammock: simple. */
export function PromiseSimpleIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M5 2.75 2.9 6.6H4.1L2.4 10.25H7.6L5.9 6.6H7.1Z" />
      <path d="M19 2.75 16.9 6.6H18.1L16.4 10.25H21.6L19.9 6.6H21.1Z" />
      <path d="M5 10.25V20.75M19 10.25V20.75M2.5 20.75H21.5" />
      <path d="M5 12.25 7.25 14.75M19 12.25 16.75 14.75" />
      <path d="M7.25 14.75C9.5 18.6 14.5 18.6 16.75 14.75" />
      <path d="M7.25 14.75C9.75 16.1 14.25 16.1 16.75 14.75" />
    </GearbnbIcon>
  );
}

/** A packed backpack: prepared. */
export function PromisePreparedIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M10 5.4V4.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v.9" />
      <path d="M6.5 9.5a4.1 4.1 0 0 1 4.1-4.1h2.8a4.1 4.1 0 0 1 4.1 4.1v9.75a1.75 1.75 0 0 1-1.75 1.75h-7.5A1.75 1.75 0 0 1 6.5 19.25Z" />
      <path d="M6.5 11.1c3.4 1.4 7.6 1.4 11 0" />
      <path d="M9.25 14.75h5.5v2.75a1 1 0 0 1-1 1h-3.5a1 1 0 0 1-1-1Z" />
      <path d="M6.5 13.75H5a.75.75 0 0 0-.75.75v3.5A.75.75 0 0 0 5 18.75h1.5M17.5 13.75H19a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-1.5" />
    </GearbnbIcon>
  );
}

/** A sun rising over mountains: memorable. */
export function PromiseMemorableIcon({ className }: IconProps) {
  return (
    <GearbnbIcon className={className}>
      <path d="M2 20.25H22" />
      <path d="M2.75 20.25 8.75 11.5 12.25 16.25 14.75 13.25 21.25 20.25" />
      <path d="M13.25 8.25a2.75 2.75 0 0 1 5.5 0" />
      <path d="M16 2.5V3.75M11.6 4.4l.9.85M20.4 4.4l-.9.85M10 8.25h1.25M20.75 8.25H22" />
    </GearbnbIcon>
  );
}
