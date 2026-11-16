/**
 * The look of the campsite map: a clean, Google Maps-like style (mint green land, pale grey towns,
 * sky-blue water, white roads with soft blue-grey edges, few labels).
 *
 * The map data comes from OpenFreeMap (openfreemap.org): free, no account or key, allowed on
 * commercial sites, OpenStreetMap data in the OpenMapTiles format. It's drawn in the browser by
 * MapLibre, so the colours here are ours to change. tiles.openfreemap.org must be allowed in the
 * connect-src Content-Security-Policy (public/.htaccess, public/_headers).
 */
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';

const OFM = 'https://tiles.openfreemap.org';

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const COLOR = {
  land: '#cdf5dd',
  town: '#f4f5f5',
  forest: '#b8eecb',
  park: '#bdeecf',
  sand: '#f4efe3',
  water: '#90d8ee',
  roadEdge: '#a9bcd6',
  road: '#ffffff',
  minorEdge: '#d5dee5',
  boundary: '#7d8590',
  label: '#2b2c30',
  labelMuted: '#5f6368',
  waterLabel: '#3b8aa3',
  halo: '#ffffff',
} as const;

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']];

/** A width that grows with zoom: [zoom, px] pairs, curved like real road maps. */
const grow = (...stops: number[]): ExpressionSpecification =>
  ['interpolate', ['exponential', 1.5], ['zoom'], ...stops] as ExpressionSpecification;

const notTunnel: ExpressionSpecification = ['!=', ['get', 'brunnel'], 'tunnel'];
const roadClass = (...classes: string[]): ExpressionSpecification => ['all', notTunnel, ['match', ['get', 'class'], classes, true, false]];

const MAJOR = ['motorway', 'trunk', 'primary'];
const MIDDLE = ['secondary', 'tertiary'];
const MINOR = ['minor', 'service'];

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
  sources: {
    openmaptiles: { type: 'vector', url: `${OFM}/planet`, attribution: MAP_ATTRIBUTION },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': COLOR.land } },
    {
      id: 'towns',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'quarter', 'commercial', 'industrial', 'retail', 'railway', 'school', 'hospital', 'university', 'college'], true, false],
      paint: { 'fill-color': COLOR.town },
    },
    {
      id: 'forest',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['wood', 'wetland'], true, false],
      paint: { 'fill-color': COLOR.forest, 'fill-opacity': 0.8 },
    },
    {
      id: 'sand',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'sand'],
      paint: { 'fill-color': COLOR.sand },
    },
    { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': COLOR.park } },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: notTunnel,
      paint: { 'fill-color': COLOR.water },
    },
    {
      id: 'rivers',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      filter: notTunnel,
      minzoom: 9,
      paint: {
        'line-color': COLOR.water,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 9, ['match', ['get', 'class'], 'river', 1, 0], 13, ['match', ['get', 'class'], 'river', 3, 0.5], 18, ['match', ['get', 'class'], 'river', 12, 4]],
      },
    },
    {
      id: 'boundary-province',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['>=', ['get', 'admin_level'], 3], ['<=', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]],
      minzoom: 7,
      paint: { 'line-color': COLOR.boundary, 'line-width': 1, 'line-dasharray': [2, 3], 'line-opacity': 0.7 },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1], ['!=', ['get', 'disputed'], 1]],
      paint: { 'line-color': COLOR.boundary, 'line-width': 1.2 },
    },

    // Roads: a soft blue-grey edge under a white middle, like Google's.
    {
      id: 'road-minor-edge',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: roadClass(...MINOR),
      minzoom: 12,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR.minorEdge, 'line-width': grow(12, 1.5, 18, 16) },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: roadClass(...MINOR),
      minzoom: 12,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR.road, 'line-width': grow(12, 0.75, 18, 13) },
    },
    {
      id: 'road-middle-edge',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: roadClass(...MIDDLE),
      minzoom: 8,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR.roadEdge, 'line-width': grow(8, 1, 12, 3, 18, 22) },
    },
    {
      id: 'road-middle',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: roadClass(...MIDDLE),
      minzoom: 10,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR.road, 'line-width': grow(10, 0.5, 12, 1.6, 18, 19) },
    },
    {
      id: 'road-major-edge',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: roadClass(...MAJOR),
      minzoom: 5,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR.roadEdge, 'line-width': grow(5, 0.8, 9, 2.4, 12, 5, 18, 28) },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: roadClass(...MAJOR),
      minzoom: 7,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR.road, 'line-width': grow(7, 0.3, 9, 1.1, 12, 3.4, 18, 24) },
    },

    // Labels: big places first, a few at a time, dark grey with a white halo.
    {
      id: 'label-road',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
      paint: { 'text-color': COLOR.labelMuted, 'text-halo-color': COLOR.halo, 'text-halo-width': 1.5 },
    },
    ...(['point', 'line'] as const).map(
      (placement): LayerSpecification => ({
        id: `label-water-${placement}`,
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        filter: ['match', ['geometry-type'], placement === 'line' ? ['LineString', 'MultiLineString'] : ['Point', 'MultiPoint'], true, false],
        layout: { 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 13, 'symbol-placement': placement, 'text-letter-spacing': 0.05 },
        paint: { 'text-color': COLOR.waterLabel, 'text-halo-color': COLOR.water, 'text-halo-width': 0.5 },
      }),
    ),
    {
      id: 'label-island',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'island'],
      minzoom: 7,
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 13 },
      paint: { 'text-color': COLOR.label, 'text-halo-color': COLOR.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'label-village',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['village', 'suburb'], true, false],
      minzoom: 12,
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
      paint: { 'text-color': COLOR.labelMuted, 'text-halo-color': COLOR.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'label-town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'town'],
      minzoom: 9,
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': grow(9, 12, 14, 15) },
      paint: { 'text-color': COLOR.label, 'text-halo-color': COLOR.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'label-city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'city'],
      minzoom: 5,
      layout: {
        'text-field': NAME,
        'text-font': ['match', ['get', 'capital'], 2, ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'capital'], 2, 15, 12], 10, ['match', ['get', 'capital'], 2, 24, 17]],
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: { 'text-color': COLOR.label, 'text-halo-color': COLOR.halo, 'text-halo-width': 2 },
    },
    {
      id: 'label-country',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'country'],
      maxzoom: 7,
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 },
      paint: { 'text-color': COLOR.labelMuted, 'text-halo-color': COLOR.halo, 'text-halo-width': 1.5 },
    },
  ],
};
