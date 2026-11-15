/**
 * The drive from the camper to a campsite, for the route line and time on the Find A Campsite
 * map. The live site uses OpenRouteService with the key in VITE_ORS_KEY (api.openrouteservice.org
 * must be in connect-src). `vite dev` without a key uses OSRM's public demo server, fine for light
 * local testing only. With no key on the live site, or if the route service fails, it falls back
 * to a straight line and the estimate from utils/travel.ts, marked `estimated`.
 *
 * Google's own directions can't be drawn on this map (their terms only allow them on a Google
 * map), so the popup also links to Google Maps with both ends filled in.
 */
import { distanceKm, estimateDriveMinutes } from './travel';

interface Point {
  lat: number;
  lng: number;
}

export interface Route {
  /** The line to draw, as [lat, lng] pairs. */
  path: [number, number][];
  minutes: number;
  km: number;
  /** True when this is the straight-line estimate, not a real road route. */
  estimated: boolean;
}

const ORS_KEY = import.meta.env.VITE_ORS_KEY as string | undefined;

/** "about 1 hr 25 min", "about 40 min" */
export function routeTimeText(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `about ${hours ? `${hours} hr` : ''}${hours && rest ? ' ' : ''}${rest || !hours ? `${rest} min` : ''}`;
}

/** Google Maps driving directions between the two points (free link, opens Google Maps). */
export function googleDirectionsUrl(from: Point, to: Point): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

function estimate(from: Point, to: Point): Route {
  return {
    path: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    minutes: estimateDriveMinutes(from, to),
    km: Math.round(distanceKm(from, to) * 1.35),
    estimated: true,
  };
}

async function roadRoute(from: Point, to: Point, signal?: AbortSignal): Promise<Route | null> {
  if (ORS_KEY) {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_KEY}&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}`;
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      features?: { geometry: { coordinates: [number, number][] }; properties: { summary: { distance: number; duration: number } } }[];
    };
    const feature = data.features?.[0];
    if (!feature) return null;
    return {
      path: feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      minutes: feature.properties.summary.duration / 60,
      km: Math.round(feature.properties.summary.distance / 1000),
      estimated: false,
    };
  }
  if (!import.meta.env.DEV) return null;
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = (await response.json()) as { routes?: { geometry: { coordinates: [number, number][] }; duration: number; distance: number }[] };
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    minutes: route.duration / 60,
    km: Math.round(route.distance / 1000),
    estimated: false,
  };
}

/** The road route when a route service answers, else the straight-line estimate. Never throws
 *  (except when aborted). */
export async function getRoute(from: Point, to: Point, signal?: AbortSignal): Promise<Route> {
  try {
    return (await roadRoute(from, to, signal)) ?? estimate(from, to);
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    return estimate(from, to);
  }
}
