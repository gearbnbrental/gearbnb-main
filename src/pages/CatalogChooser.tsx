import { usePageMeta } from '../hooks/usePageMeta';
import PathSelectionCards from '../components/PathSelectionCards';

export default function CatalogChooser() {
  usePageMeta(
    'Camping Kits for Rent in Metro Manila | GearBnB',
    'Browse and rent camping gears in Metro Manila. Explore our selection of quality outdoor equipment and find the perfect gear for your next adventure.',
  );
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">How Do You Want to Gear Up?</h1>
        <p className="max-w-xl text-sm text-ink-muted">
          Choose a ready-made package for a simple, single-unit booking, or build your own kit from individual
          gear to fit your trip exactly.
        </p>
      </div>
      <PathSelectionCards />
    </div>
  );
}
