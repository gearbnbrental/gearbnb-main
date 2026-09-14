import PathSelectionCards from '../components/PathSelectionCards';

export default function CatalogChooser() {
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
