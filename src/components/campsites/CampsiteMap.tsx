/**
 * The interactive campsite map (MapLibre). Only ever loaded through CampsiteMapSlot, so the map
 * library and its styles download only when a map is actually shown. Markers are GearBnB pins;
 * clicking one opens a small popup with the campsite and a link to its page. When the camper has
 * set their location, a "You're here" marker shows it, and the popup adds the drive there: a route
 * line on the map, the time and distance, and Google Maps directions. Hidden from screen readers:
 * the list next to it has the same campsites as real links.
 *
 * The map starts locked, so scrolling the page past it never zooms or drags it by accident. "View
 * map" switches it on; "Done" (or Escape) locks it again.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import './CampsiteMap.css';
import type { CampsiteSummary } from '../../types/campsite';
import { campsitePath, headlineFee, placeName } from '../../utils/campsites';
import { getRoute, googleDirectionsUrl, routeTimeText, type Route } from '../../utils/routing';
import type { Place } from '../../utils/travel';
import { MAP_STYLE } from './mapStyle';

// MapLibre's helper runs from our own site (not a blob: address), so the Content-Security-Policy
// doesn't need loosening.
maplibregl.setWorkerUrl(mapWorkerUrl);

const canDrawMap = () => {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
};

const PHILIPPINES: maplibregl.LngLatLike = [121.77, 12.88];
const EMPTY_ROUTE: FeatureCollection = { type: 'FeatureCollection', features: [] };

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

const pinSvg = (active: boolean) =>
  `<svg viewBox="0 0 28 36" width="28" height="36" aria-hidden="true"><path d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.6 14 35 14 35s12.5-12.4 12.5-21.8C26.5 6.4 21 1 14 1Z" fill="${
    active ? '#f6c445' : '#2d5a46'
  }" stroke="#fff" stroke-width="2"/><path d="M8.5 19.5 14 10l5.5 9.5Z" fill="${active ? '#2d5a46' : '#fff'}"/></svg>`;

function pinElement(name: string) {
  const element = document.createElement('div');
  element.className = 'cursor-pointer';
  element.title = name;
  element.innerHTML = pinSvg(false);
  return element;
}

/** The camper: a person in a navy circle with a "You're here" label above it. */
function youElement() {
  const element = document.createElement('div');
  element.title = "You're here";
  element.className = 'pointer-events-none';
  element.innerHTML = `<div class="relative h-9 w-9">
    <span class="absolute bottom-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-navy px-2.5 py-1 text-xs font-semibold text-white shadow-md">You&rsquo;re here</span>
    <span class="absolute inset-0 animate-ping rounded-full bg-brand-navy/25 motion-reduce:animate-none"></span>
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true" class="relative">
      <circle cx="18" cy="18" r="13" fill="#20435c" stroke="#fff" stroke-width="3"/>
      <circle cx="18" cy="14" r="3.6" fill="#fff"/>
      <path d="M11.5 25c.6-3.8 3.3-6 6.5-6s5.9 2.2 6.5 6" fill="#fff"/>
    </svg>
  </div>`;
  return element;
}

function popupHtml(campsite: CampsiteSummary, drive: string) {
  const fee = headlineFee(campsite).text;
  return `<div class="flex min-w-48 flex-col gap-1">
    <a href="${campsitePath(campsite)}" data-campsite-link class="block no-underline">
      <strong class="block font-serif text-base leading-snug text-ink">${escapeHtml(campsite.name)}</strong>
      <span class="block text-xs text-ink-muted">${escapeHtml(placeName(campsite))}${fee ? ` · ${escapeHtml(fee)}` : ''}</span>
    </a>
    ${drive}
    <a href="${campsitePath(campsite)}" data-campsite-link class="mt-1 block text-xs font-semibold text-accent no-underline">View campsite &rarr;</a>
  </div>`;
}

const driveLoading = '<span class="block text-xs text-ink-muted">Finding the drive from you&hellip;</span>';
const driveHint = '<span class="block text-xs text-ink-muted">Add your location above to see the drive.</span>';

function driveHtml(route: Route, from: Place, campsite: CampsiteSummary) {
  return `<span class="mt-1 block rounded-lg bg-brand-cream/60 px-2 py-1.5 text-xs text-ink">
      <strong>${routeTimeText(route.minutes)}</strong> drive &middot; ${route.km} km${route.estimated ? ' <span class="text-ink-muted">(estimate)</span>' : ''}
    </span>
    <a href="${googleDirectionsUrl(from, campsite)}" target="_blank" rel="noopener noreferrer" class="block text-xs font-semibold text-brand-navy no-underline">Directions in Google Maps &rarr;</a>`;
}

export interface CampsiteMapProps {
  campsites: readonly CampsiteSummary[];
  /** Highlights this campsite's pin (e.g. the card being hovered). */
  activeSlug?: string | null;
  /** One campsite, zoomed in (a campsite page), instead of fitting them all. */
  single?: boolean;
  /** Where the camper is starting from: shows "You're here" and the drive in each popup. */
  from?: Place | null;
  className?: string;
}

export default function CampsiteMap({ campsites, activeSlug = null, single = false, from = null, className = 'h-96' }: CampsiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const youRef = useRef<maplibregl.Marker | null>(null);
  const fromRef = useRef(from);
  const [active, setActive] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canDrawMap()) return;
    const markers = markersRef.current;
    // Once switched on, MapLibre zooms smoothly every usual way: the mouse wheel, a laptop trackpad
    // pinch, two-finger pinch on phones, double-tap and the +/- buttons. Tilting and turning the
    // map are off, so it always stays flat with north up.
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: PHILIPPINES,
      zoom: 5,
      maxZoom: 18,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    // Map credits (required by the free map data), bottom left, clear of the chat button. They fold
    // into an "i" once the camper moves the map.
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;

    // The drive line: solid for a real route, dashed for a straight-line estimate.
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: EMPTY_ROUTE });
      const line = { 'line-color': '#20435c', 'line-width': 4, 'line-opacity': 0.75 };
      map.addLayer({ id: 'route', type: 'line', source: 'route', filter: ['!', ['get', 'estimated']], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: line });
      map.addLayer({ id: 'route-estimate', type: 'line', source: 'route', filter: ['get', 'estimated'], paint: { ...line, 'line-dasharray': [1.5, 2] } });
    });

    // Popup links to a campsite open it inside the app instead of reloading the page.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a[data-campsite-link]');
      if (!link) return;
      event.preventDefault();
      navigate(link.getAttribute('href') as string);
    };
    container.addEventListener('click', onClick);
    return () => {
      container.removeEventListener('click', onClick);
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [navigate]);

  // Locked: the page scrolls over the map as if it were a picture. On: every gesture works.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const handler of [map.scrollZoom, map.dragPan, map.touchZoomRotate, map.doubleClickZoom, map.boxZoom, map.keyboard]) {
      if (active) handler.enable();
      else handler.disable();
    }
    if (!active) return;
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // Campsite pins, and the drive when one is opened.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const showRoute = (route: Route | null) =>
      (map.getSource('route') as GeoJSONSource | undefined)?.setData(
        route
          ? { type: 'Feature', properties: { estimated: route.estimated }, geometry: { type: 'LineString', coordinates: route.path.map(([lat, lng]) => [lng, lat]) } }
          : EMPTY_ROUTE,
      );
    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();
    for (const campsite of campsites) {
      const popup = new maplibregl.Popup({ offset: 36, maxWidth: '280px', focusAfterOpen: false, className: 'campsite-popup' }).setHTML(popupHtml(campsite, driveHint));
      const marker = new maplibregl.Marker({ element: pinElement(campsite.name), anchor: 'bottom' }).setLngLat([campsite.lng, campsite.lat]).setPopup(popup).addTo(map);
      let request: AbortController | null = null;
      popup.on('open', () => {
        const start = fromRef.current;
        if (!start) {
          popup.setHTML(popupHtml(campsite, driveHint));
          return;
        }
        popup.setHTML(popupHtml(campsite, driveLoading));
        request?.abort();
        const current = new AbortController();
        request = current;
        getRoute(start, campsite, current.signal).then(
          (route) => {
            if (current.signal.aborted || !popup.isOpen()) return;
            showRoute(route);
            const bounds = route.path.reduce(
              (box, [lat, lng]) => box.extend([lng, lat]),
              new maplibregl.LngLatBounds([campsite.lng, campsite.lat], [campsite.lng, campsite.lat]),
            );
            map.fitBounds(bounds, { padding: { top: 180, left: 40, right: 40, bottom: 40 }, maxZoom: 13, duration: 800 });
            popup.setHTML(popupHtml(campsite, driveHtml(route, start, campsite)));
          },
          () => {},
        );
      });
      // The route line goes away with its popup.
      popup.on('close', () => {
        request?.abort();
        showRoute(null);
      });
      markersRef.current.set(campsite.slug, marker);
    }
    if (campsites.length === 0) map.jumpTo({ center: PHILIPPINES, zoom: 5 });
    else if (single || campsites.length === 1) map.jumpTo({ center: [campsites[0].lng, campsites[0].lat], zoom: single ? 13 : 10 });
    else {
      const bounds = new maplibregl.LngLatBounds();
      for (const campsite of campsites) bounds.extend([campsite.lng, campsite.lat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0 });
    }
  }, [campsites, single]);

  // "You're here", and the starting point for the next popup's drive.
  useEffect(() => {
    fromRef.current = from;
    const map = mapRef.current;
    if (!map) return;
    youRef.current?.remove();
    youRef.current = null;
    for (const marker of markersRef.current.values()) marker.getPopup()?.remove();
    if (!from) return;
    youRef.current = new maplibregl.Marker({ element: youElement() }).setLngLat([from.lng, from.lat]).addTo(map);
    youRef.current.getElement().style.zIndex = '3';
  }, [from]);

  useEffect(() => {
    for (const [slug, marker] of markersRef.current) {
      const element = marker.getElement();
      element.innerHTML = pinSvg(slug === activeSlug);
      element.style.zIndex = slug === activeSlug ? '2' : '';
    }
  }, [activeSlug, campsites]);

  return (
    <div aria-hidden="true" className={`relative z-0 w-full overflow-hidden bg-surface-strong ${className}`}>
      <div ref={containerRef} className="campsite-map h-full w-full" />
      {active ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setActive(false)}
          className="absolute right-3 top-3 z-10 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-md ring-1 ring-black/5 transition-colors hover:bg-surface"
        >
          Done
        </button>
      ) : (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setActive(true)}
          className="group absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/5 transition-colors hover:bg-black/10"
        >
          <span className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink shadow-lg ring-1 ring-black/5 transition-transform group-hover:scale-105 motion-reduce:transition-none">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-forest" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4ZM9 4v14M15 6v14" />
            </svg>
            View map
          </span>
        </button>
      )}
    </div>
  );
}
