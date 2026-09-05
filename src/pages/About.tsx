export default function About() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">About GearBNB</h1>
      <p className="text-sm text-ink-muted">
        GearBNB is a camping gear rental service built for anyone who wants to get outdoors without buying and
        storing equipment they'll only use a few times a year. Rent a ready-made package or build your own kit
        from individual gear, pick your dates, and we'll have everything ready for pickup or delivery.
      </p>
      <p className="text-sm text-ink-muted">
        Every renter is ID-verified and every item is covered by a refundable security deposit, so gear stays in
        great shape for the next adventurer.
      </p>
    </div>
  );
}
