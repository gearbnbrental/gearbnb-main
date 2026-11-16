import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GearPlaceholderIcon } from '../icons';
import { availableText, brandAndModelLine, conditionTone, formatShopPrice, shopItemPath, type ShopItem } from '../../utils/shop';

const TONE_CLASS: Record<ReturnType<typeof conditionTone>, string> = {
  new: 'bg-brand-forest text-white',
  good: 'bg-brand-forest/10 text-brand-forest-dark',
  fair: 'bg-amber-100 text-amber-800',
  repair: 'bg-red-100 text-red-700',
  neutral: 'bg-surface-strong text-ink-muted',
};

export function ConditionBadge({ condition, className = '' }: { condition: string; className?: string }) {
  if (!condition) return null;
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold sm:text-xs ${TONE_CLASS[conditionTone(condition)]} ${className}`}>
      {condition}
    </span>
  );
}

/** The price, with the pre-sale price crossed out beside it when the RMS sends one. */
export function ShopPrice({ item, size = 'card' }: { item: ShopItem; size?: 'card' | 'large' }) {
  const priceClass = size === 'large' ? 'text-2xl' : 'text-base sm:text-lg';
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      {item.originalPriceCentavos !== null && (
        <s className="text-xs font-medium text-ink-faint sm:text-sm">
          <span className="sr-only">Was </span>
          {formatShopPrice(item.originalPriceCentavos)}
        </s>
      )}
      <span className={`${priceClass} font-bold text-accent`}>
        {item.originalPriceCentavos !== null && <span className="sr-only">Now </span>}
        {formatShopPrice(item.priceCentavos)}
      </span>
    </p>
  );
}

/** One item in the shop grid. The whole card links to the item's own page (/catalog/camping-gear-sale/<slug>). */
export default function ShopItemCard({ item }: { item: ShopItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  // A square main photo (the recommended 1080 x 1080) fills the square frame; any other shape is
  // shown whole instead of being cropped. The frame is beige like the Build Your Own gear photos,
  // and mix-blend-multiply turns a photo's own white background into that same beige.
  const [square, setSquare] = useState(true);
  const photo = item.images[0];
  const subtitle = brandAndModelLine(item);

  return (
    <Link
      to={shopItemPath(item)}
      state={{ fromShop: true }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-strong">
        {photo && !imageFailed ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              setSquare(naturalHeight > 0 && Math.abs(naturalWidth / naturalHeight - 1) <= 0.1);
            }}
            className={`h-full w-full mix-blend-multiply transition-transform duration-300 group-hover:scale-105 ${square ? 'object-cover' : 'object-contain'}`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-faint">
            <GearPlaceholderIcon className="h-10 w-10" />
            <span className="text-[11px] font-medium">Photo coming soon</span>
          </div>
        )}
        {item.images.length > 1 && !imageFailed && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {item.images.length} photos
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint sm:text-[11px]">{item.category}</p>
        <h2 className="line-clamp-2 text-xs font-semibold leading-snug text-ink sm:text-sm">{item.name}</h2>
        {subtitle && <p className="-mt-1 line-clamp-1 text-[11px] text-ink-muted sm:text-xs">{subtitle}</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ConditionBadge condition={item.condition} />
          <span className="text-[11px] font-medium text-ink-muted sm:text-xs">{availableText(item)}</span>
        </div>
        <div className="mt-auto pt-1">
          <ShopPrice item={item} />
        </div>
      </div>
    </Link>
  );
}
