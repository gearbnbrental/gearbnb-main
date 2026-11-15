/**
 * Rough drive times from where the camper is to a campsite, for "Within 3 hours from me" and the
 * "about 2 hours from you" on the cards. An estimate, not a route: the straight-line distance,
 * stretched for winding roads, at a typical provincial driving speed. Pages always say "about".
 */

export interface Place {
  /** What the camper typed or picked, e.g. "Quezon City, Metro Manila". */
  name: string;
  lat: number;
  lng: number;
}

/** Roads are longer than the straight line between two points. */
const ROAD_FACTOR = 1.35;
/** Average speed including towns, traffic and stops, in km/h. */
const AVERAGE_KMH = 40;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Estimated driving minutes, rounded to 5. */
export function estimateDriveMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const minutes = ((distanceKm(from, to) * ROAD_FACTOR) / AVERAGE_KMH) * 60;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

const STORAGE_KEY = 'gearbnb.campsites.from';

/** The camper's saved starting point, kept only in this browser. */
export function loadSavedPlace(): Place | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const place = JSON.parse(raw) as Partial<Place>;
    return typeof place.name === 'string' && Number.isFinite(place.lat) && Number.isFinite(place.lng) ? (place as Place) : null;
  } catch {
    return null;
  }
}

export function savePlace(place: Place | null): void {
  try {
    if (place) localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or storage blocked: the location just isn't remembered next time.
  }
}
