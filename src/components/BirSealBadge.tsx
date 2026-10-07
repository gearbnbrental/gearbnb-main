/**
 * BIR Registration Seal Badge — required to be prominently displayed and scannable for
 * businesses with an online presence. Cropped from the BIR-issued badge (header and reminder
 * text removed). Kept on a white plate so the QR code has a light quiet zone to scan.
 *
 * Shown on About Us (below the map) and Plan an Event (below the inquiry form, where business
 * customers are most likely to look for proof of registration).
 */
export default function BirSealBadge({ className = '' }: { className?: string }) {
  return (
    <figure
      className={`flex flex-col gap-2 rounded-2xl border border-line/80 bg-white p-3 shadow-sm sm:p-4 ${className}`}
    >
      <img
        src="/images/bir-registration-seal.png"
        alt="BIR Registration Seal Badge 2026: GearBnB is registered with the Bureau of Internal Revenue, RSN 53ARC20260000011659"
        width={985}
        height={313}
        loading="lazy"
        className="h-auto w-full"
      />
      <figcaption className="text-center text-xs text-neutral-500">
        Registered with the Bureau of Internal Revenue. Scan the QR code to verify.
      </figcaption>
    </figure>
  );
}
