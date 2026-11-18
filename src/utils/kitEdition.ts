import type { KitEdition, PackageKit } from '../types/gearbnb';

/**
 * The cart entry for one edition (colour) of a kit: the edition's own id, price, deposit, extra-day rate, stock status
 * and description, never the parent kit's (see KitEdition's own doc comment). Shared by the package catalog's Book Now
 * and the AI cart link, so a package reaches the cart the same way from both.
 *
 * `isOutOfStock` defaults to the edition's own catalog status; the package catalog passes its date-aware value instead.
 */
export function kitForEdition(kit: PackageKit, edition: KitEdition, isOutOfStock: boolean = edition.isOutOfStock ?? false): PackageKit {
  return {
    ...kit,
    id: edition.id,
    name: `${kit.name} (${edition.label})`,
    packageNumber: edition.packageNumber,
    imageUrl: edition.imageUrl,
    pricing: edition.pricing,
    depositAmount: edition.depositAmount,
    extraPerDayPrice: edition.extraPerDayPrice,
    isOutOfStock,
    description: edition.description,
    ...(edition.components ? { components: edition.components } : {}),
    ...(edition.images ? { images: edition.images } : {}),
    editions: undefined,
  };
}
