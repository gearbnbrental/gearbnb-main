/**
 * Line icons for the campsite amenities and highlights (24×24, 1.6 stroke, currentColor), in the
 * same simple style Airbnb uses for "What this place offers". Decorative: the text beside each one
 * carries the meaning.
 */
import type { ReactNode } from 'react';
import type { AmenityIcon } from '../../utils/campsites';

const PATHS: Record<AmenityIcon, ReactNode> = {
  signal: <path d="M5 19v-3M9.5 19v-6M14 19v-9M18.5 19V6" />,
  restroom: (
    <>
      <path d="M5 10h10v2a5 5 0 0 1-10 0v-2Z" />
      <path d="M7 16.5 6 20h8l-1-3.5M15 10V5a1 1 0 0 0-1-1H9" />
    </>
  ),
  shower: (
    <>
      <path d="M5 20V7a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v1" />
      <path d="M9 8h6M10 12v1M12.5 12v1M15 12v1M11 15.5v1M13.5 15.5v1" />
    </>
  ),
  water: <path d="M12 3.5s-5.5 6-5.5 10a5.5 5.5 0 0 0 11 0c0-4-5.5-10-5.5-10Z" />,
  power: <path d="M13 3 6 13.5h5.5L10.5 21 18 10.5h-5.5L13 3Z" />,
  car: (
    <>
      <path d="M4 16v-3.5L6 8h12l2 4.5V16a1 1 0 0 1-1 1h-1M6 17H5a1 1 0 0 1-1-1M4 12.5h16M9 17h6" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
    </>
  ),
  moto: (
    <>
      <circle cx="5.5" cy="16.5" r="3" />
      <circle cx="18.5" cy="16.5" r="3" />
      <path d="M5.5 16.5 9 11h5l2 5.5M13 7h3l2.5 9.5M9 11 8 8H6" />
    </>
  ),
  parking: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" />
    </>
  ),
  road: <path d="M8 3 4 21M16 3l4 18M12 4v2.5M12 10.5v3M12 17.5V20" />,
  pets: (
    <>
      <circle cx="7" cy="10" r="1.6" />
      <circle cx="10.5" cy="6.5" r="1.6" />
      <circle cx="14.5" cy="6.5" r="1.6" />
      <circle cx="18" cy="10" r="1.6" />
      <path d="M12 12c-2.5 0-5 3-5 5.2 0 1.3 1 2.3 2.3 2.3.9 0 1.7-.5 2.7-.5s1.8.5 2.7.5c1.3 0 2.3-1 2.3-2.3 0-2.2-2.5-5.2-5-5.2Z" />
    </>
  ),
  fire: (
    <>
      <path d="M12 15.5c-2.2 0-3.5-1.5-3.5-3.5 0-2.3 1.8-3.4 2.5-6 1 1.3 1.2 2 1.2 3 .7-.6 1.2-1.3 1.4-2.3 1.3 1.3 1.9 3 1.9 5.3 0 2-1.3 3.5-3.5 3.5Z" />
      <path d="M5 20.5 19 17M5 17l14 3.5" />
    </>
  ),
  cooking: (
    <>
      <path d="M4 11h16M5 11v4a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5v-4M2.5 11H4M20 11h1.5" />
      <path d="M9 4.5c0 1 1 1.5 1 2.5M13.5 4.5c0 1 1 1.5 1 2.5" />
    </>
  ),
  shade: (
    <>
      <path d="M12 3c-4 0-7 3.6-7 8h14c0-4.4-3-8-7-8ZM12 11v10M9 21h6" />
    </>
  ),
  kids: (
    <>
      <circle cx="12" cy="5.5" r="2" />
      <path d="M8 10h8M12 10v5M9.5 21l2.5-6 2.5 6M8 10l-1.5 4M16 10l1.5 4" />
    </>
  ),
  tent: <path d="M3 20h18M4.5 20 12 5l7.5 15M12 5l-2.5 15M12 5l2.5 15" />,
  store: (
    <>
      <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 2.5 2.5h1c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5" />
      <path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    </>
  ),
};

export default function AmenityIconSvg({ icon, className = 'h-6 w-6' }: { icon: AmenityIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[icon]}
    </svg>
  );
}
