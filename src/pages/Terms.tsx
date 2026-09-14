import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BYO_RENTAL_AGREEMENT_URL, TERMS_AND_CONDITIONS_URL } from '../config/legalDocuments';
import { mockPackages } from '../data/mockData';
import { formatCurrency } from '../utils/format';

interface TermsSection {
  id: string;
  title: string;
  bullets: string[];
}

const GENERAL_TERMS: TermsSection[] = [
  {
    id: '4.1',
    title: '4.1 Rental Period',
    bullets: [
      'The rental period commences on the agreed start date and concludes on the agreed return date, as stated in the booking confirmation.',
      'The Renter must return all rented items to GearBnB, or the agreed pick-up point, on or before the end of the rental period.',
    ],
  },
  {
    id: '4.2',
    title: '4.2 Late Returns and Early Returns',
    bullets: [
      'Late returns will incur a 50% package fee per day beyond the agreed return date.',
      'The full security deposit will also be forfeited in cases of late return.',
      'If you anticipate any delay in returning the rented gear, please inform us as early as possible so we can coordinate accordingly.',
      'Early returns do not qualify for partial refunds unless previously agreed upon in writing.',
    ],
  },
  {
    id: '4.3',
    title: '4.3 Care and Responsibility',
    bullets: [
      'The Renter agrees to use all rented equipment responsibly and exclusively for camping purposes.',
      'All gear must be returned in the same good condition as received, complete with all accessories, pegs, ropes, poles, and parts.',
      'The Renter is fully liable for all items throughout the rental period, including loss, theft, and accidental damage.',
      'Inflatable beds must be properly deflated and carefully packed prior to return.',
      'Tents, inflatable beds, and fans must not be subjected to extreme weather or prolonged direct sunlight unnecessarily.',
      'Before returning gear, the Renter should do a final sweep of the campsite to check for pegs, ropes, or small parts left behind or buried in the ground.',
    ],
  },
  {
    id: '4.4',
    title: '4.4 Damage, Cleaning, and Loss Policy',
    bullets: [
      'Normal wear and tear (small dirt marks, sand or dust, light creasing on inflatable beds, minor scuffs from reasonable use) is not charged.',
      'Chargeable conditions include excessive dirt requiring deep cleaning, mud-covered items, burn marks, food/beverage stains, strong odors, improper-packing damage, tears/rips/broken components, and water damage from improper drying.',
      'Lost tent peg or stake: ₱20.00 per piece. Lost guy rope or tent rope: ₱10.00 per piece — deducted automatically from the deposit.',
      'Other lost, missing, or broken items (tent poles, fan parts, chair/table components, bed pumps, or the item itself) are assessed individually at current retail replacement value or actual repair cost.',
      'A standard cleaning fee of ₱150.00 applies to items returned excessively dirty or requiring deep cleaning.',
      'If total deductions exceed the deposit, the Renter agrees to pay the remaining balance upon assessment.',
      'GearBnB reserves the right to assess and communicate any damage, loss, or cleaning charges within 24 hours of return; any amount owed beyond the deposit must be settled within 3 days of notification.',
    ],
  },
  {
    id: '4.5',
    title: '4.5 Cancellation Policy',
    bullets: [
      'Cancellations made 7 or more days before the rental start date: full refund of deposit.',
      'Cancellations made 3 to 6 days before the rental start date: no refund, but the booking can be rescheduled.',
      'Cancellations made fewer than 3 days before the rental start date: no refund, but the booking can be rescheduled.',
    ],
  },
  {
    id: '4.6',
    title: '4.6 Force Majeure',
    bullets: [
      'Covered events (free reschedule or full refund offered): sudden unforeseeable weather changes on the camping day itself, typhoons/earthquakes/floods/landslides, government-imposed travel restrictions or lockdowns, and official road closures or evacuation orders.',
      'Not covered (negligence): proceeding despite prior storm/typhoon warnings, disregarding evacuation notices, improper handling of equipment during foreseeable weather, or failing to secure equipment when warnings were available in advance.',
      'A Renter seeking a waiver must notify GearBnB as soon as reasonably possible and may be required to submit photo/video evidence; GearBnB determines in good faith whether an event qualifies.',
    ],
  },
  {
    id: '4.7',
    title: '4.7 Delivery and Pick-Up',
    bullets: [
      'All delivery and pick-up arrangements must be confirmed at least 24 hours in advance.',
      'Delivery fees, where applicable, are separate from the rental fee and agreed upon prior to the start of the rental.',
      'The Renter must inspect all items upon receipt and immediately report any discrepancies or pre-existing damage — issues not reported at receipt are assumed to have occurred during the rental period.',
    ],
  },
  {
    id: '4.8',
    title: '4.8 Liability',
    bullets: [
      'GearBnB is not liable for any injury, accident, property damage, or loss incurred during use of the rented equipment.',
      'The Renter assumes full responsibility for personal safety and the safety of anyone else using the rented equipment.',
      'The Renter is fully liable for all lost pegs, ropes, broken components, and damaged or missing gear identified upon return.',
    ],
  },
  {
    id: '4.9',
    title: '4.9 Prohibited Use',
    bullets: [
      'Rented equipment must not be sub-rented, loaned, or transferred to any third party without prior written consent from GearBnB.',
      'Commercial or large-scale use of the rented equipment is strictly prohibited under this agreement.',
    ],
  },
];

export default function Terms() {
  const location = useLocation();

  // React Router navigation (the footer's "Gear Care Tips"/"Deposit & Refunds" links, and any
  // direct #hash visit) doesn't get the browser's native scroll-to-fragment behavior the way a
  // full page load does — this reproduces it for the one section ids this page actually has.
  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-2.5 border-b border-line-soft pb-8">
        <h1 className="font-serif text-2xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          Rental Agreement — Terms &amp; Conditions
        </h1>
        <p className="text-base leading-relaxed text-ink-muted">
          This is a summary of GearBnB's signed camping gear rental agreement. Your finalized copy with booking
          details completed will be provided once your reservation is confirmed.
        </p>
        <p className="text-sm leading-relaxed text-ink-muted">
          The general terms below apply to a Package (Kit) booking, signed as the{' '}
          <a
            href={TERMS_AND_CONDITIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2"
          >
            GearBnB Kit T&amp;C Rental Agreement
          </a>
          . A Build Your Own booking signs its own separate{' '}
          <a
            href={BYO_RENTAL_AGREEMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2"
          >
            BYO Rental Agreement
          </a>{' '}
          instead — the same care, damage, cancellation, and liability terms, but with a security deposit set per
          booking based on the items selected rather than a fixed package amount.
        </p>
      </div>

      <section id="deposit" className="flex flex-col gap-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent sm:text-sm">
          Section 3 — Fully Refundable Security Deposit
        </h2>
        <p className="text-base leading-relaxed text-ink-muted">
          A refundable security deposit is required upon confirmation of every booking, returned in full once all
          rented items come back complete and undamaged.
        </p>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[360px] text-left text-sm sm:text-base">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Package</th>
                <th className="px-4 py-3 text-right font-semibold">Deposit Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {mockPackages.map((kit) => (
                <tr key={kit.id}>
                  <td className="px-4 py-3 text-ink">{kit.name}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink">{formatCurrency(kit.depositAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent sm:text-sm">
          Section 4 — General Terms and Conditions
        </h2>
        {GENERAL_TERMS.map((section) => (
          <div
            key={section.id}
            id={section.id}
            className="flex flex-col gap-3 border-t border-line-soft pt-6 first:border-t-0 first:pt-0"
          >
            <h3 className="text-base font-semibold leading-snug text-ink sm:text-lg">{section.title}</h3>
            <ul className="flex flex-col gap-3 text-base leading-relaxed text-ink-muted">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-forest" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="text-sm leading-relaxed text-ink-faint">
        This page summarizes GearBnB's Camping Gear Rental Agreement for reference while browsing. It does not
        replace the finalized agreement you sign upon booking confirmation.
      </p>
    </div>
  );
}
