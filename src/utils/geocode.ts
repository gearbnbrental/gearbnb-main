/**
 * Turns what a camper types ("Quezon City", "Calamba") into a place on the map, for the "Your
 * location" field on Find A Campsite. Uses Photon (photon.komoot.io): free, no key, OpenStreetMap
 * data, fine for a site's own search box at fair use. With VITE_MAPTILER_KEY set it uses MapTiler's
 * paid geocoding instead. Whichever host is used must be in connect-src (public/.htaccess,
 * public/_headers).
 */
import type { Place } from './travel';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

/** The Philippines, as west,south,east,north. */
const PH_BBOX = '116.9,4.5,126.7,21.2';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; city?: string; county?: string; state?: string; countrycode?: string };
}

/** "Quezon City, Metro Manila": the place, then its town and province, without repeats. */
function photonName({ name, city, county, state }: PhotonFeature['properties']) {
  const parts = [name, city, state ?? county].filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join(', ');
}

/** Up to 5 places in the Philippines matching `query`. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (MAPTILER_KEY) {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&country=ph&limit=5&language=en&types=municipality,municipal_district,locality,neighbourhood,place,region,subregion,address,poi`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Place search failed (${response.status})`);
    const data = (await response.json()) as { features?: { place_name?: string; center?: [number, number] }[] };
    return (data.features ?? [])
      .filter((feature) => feature.place_name && feature.center)
      .map((feature) => ({ name: feature.place_name!.replace(/, Philippines$/, ''), lng: feature.center![0], lat: feature.center![1] }));
  }
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=${PH_BBOX}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);
  const data = (await response.json()) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .filter((feature) => feature.properties.countrycode === 'PH' && feature.properties.name)
    .slice(0, 5)
    .map((feature) => ({ name: photonName(feature.properties), lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }));
}
