import { Link } from 'react-router-dom';

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function TrailToFlag({ className, flip }: { className?: string; flip?: boolean }) {
  const d = flip
    ? 'M4 8c14 4 6 20 24 22c10 1 16-6 28-4'
    : 'M4 30c14-4 6-20 24-22c10-1 16 6 28 4';
  const flagX = flip ? 56 : 56;
  const flagY = flip ? 30 : 8;
  return (
    <svg viewBox="0 0 64 40" fill="none" className={className}>
      <path d={d} stroke="currentColor" strokeWidth={2} strokeDasharray="1 6" strokeLinecap="round" />
      <path d={`M${flagX} ${flagY - 16}v16`} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d={`M${flagX} ${flagY - 15} ${flagX + 14} ${flagY - 10} ${flagX} ${flagY - 5}Z`} fill="currentColor" />
    </svg>
  );
}

interface PathBlockProps {
  to: string;
  kicker: string;
  subKicker: string;
  headlineTop: string;
  headlineBottom: string;
  accentWord: string;
  bodyPrefix: string;
  bodyStrong: string;
  bodySuffix: string;
  cta: string;
  image: string;
  reverse?: boolean;
}

function PathBlock({
  to,
  kicker,
  subKicker,
  headlineTop,
  headlineBottom,
  accentWord,
  bodyPrefix,
  bodyStrong,
  bodySuffix,
  cta,
  image,
  reverse,
}: PathBlockProps) {
  const photo = (
    <div className="relative mx-auto w-full max-w-sm">
      <TrailToFlag
        flip={reverse}
        className={`absolute -top-6 h-16 w-24 text-brand-forest/50 ${reverse ? '-right-6' : '-left-6'}`}
      />
      <span
        className={`absolute -top-3 z-10 rotate-[-8deg] font-serif text-2xl italic text-brand-forest ${
          reverse ? '-right-2' : '-left-2'
        }`}
      >
        {accentWord}
      </span>
      <div
        className={`flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border-[6px] border-white bg-white p-8 shadow-xl ${
          reverse ? 'rotate-3' : '-rotate-3'
        }`}
      >
        <img src={image} alt="" className="h-full w-full object-contain" />
      </div>
    </div>
  );

  const text = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-forest">{kicker}</span>
        <span className="text-sm text-ink-muted">{subKicker}</span>
      </div>
      <h3 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
        <span className="text-ink">{headlineTop}</span>
        <br />
        <span className="text-brand-olive">{headlineBottom}</span>
      </h3>
      <p className="max-w-md text-sm text-ink-muted sm:text-base">
        {bodyPrefix} <strong className="font-semibold text-ink">{bodyStrong}</strong> {bodySuffix}
      </p>
      <Link
        to={to}
        className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-brand-forest px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-forest-dark"
      >
        {cta}
        <ArrowUpRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );

  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      {reverse ? (
        <>
          <div className="md:order-2">{photo}</div>
          <div className="md:order-1">{text}</div>
        </>
      ) : (
        <>
          {photo}
          {text}
        </>
      )}
    </div>
  );
}

export default function PathSelectionCards() {
  return (
    <div className="flex flex-col gap-16">
      <PathBlock
        to="/catalog/path-a"
        kicker="Ready-Made"
        subKicker="Bundled for effortless booking"
        headlineTop="Choose a"
        headlineBottom="Package"
        accentWord="Adventure"
        bodyPrefix="Grab a ready-made kit like the Nomad or Stargazer Kit —"
        bodyStrong="everything bundled as one simple booking."
        bodySuffix=""
        cta="Explore Packages"
        image="/images/products/tents/8p-blackdog-starchase-13x.png"
      />
      <PathBlock
        to="/catalog/path-b"
        kicker="Fully Custom"
        subKicker="Built exactly your way"
        headlineTop="Build Your"
        headlineBottom="Own Kit"
        accentWord="Custom"
        bodyPrefix="Pick your rental duration, then"
        bodyStrong="mix and match individual gear by category"
        bodySuffix="to fit your trip exactly."
        cta="Start Building"
        image="/images/products/chairs/ultra-light-chair.png"
        reverse
      />
    </div>
  );
}
