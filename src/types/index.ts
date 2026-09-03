// Core domain types for the Hospital Location & Navigation System.
// Hospital data is sourced from OpenStreetMap (Overpass + Nominatim); the map,
// geocoding autocomplete and directions are provided by Google Maps.

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A healthcare facility (hospital, clinic or doctor's practice) as surfaced to
 * the UI. Shaped from raw OpenStreetMap elements by `src/lib/hospitals.ts`.
 */
export interface Hospital {
  /** Stable id: `${osm_type}/${osm_id}` (e.g. "node/123456"). */
  id: string;
  name: string;
  /** Best-effort single-line address. May be empty when OSM lacks address tags. */
  address: string;
  location: LatLng;
  phone?: string;
  email?: string;
  website?: string;
  /** Raw OSM classification, e.g. ["hospital", "healthcare"]. */
  types: string[];
  /** Normalised service categories this facility is tagged with. */
  services: ServiceCategory[];
  /** Raw `opening_hours` OSM tag, unparsed (e.g. "Mo-Fr 08:00-18:00"). */
  openingHours?: string;
  /** Naive open/closed guess derived from `openingHours`; undefined when unknown. */
  openNow?: boolean;
  /** Straight-line distance from the search origin, in kilometres. */
  distanceKm?: number;
  /** Locality/suburb for compact display. */
  vicinity?: string;
  emergency?: boolean;
}

/**
 * Medical-service categories the user can filter by. Kept deliberately small so
 * it maps cleanly onto OSM `healthcare:speciality` values and name keywords.
 */
export type ServiceCategory =
  | 'emergency'
  | 'general'
  | 'maternity'
  | 'paediatrics'
  | 'surgery'
  | 'cardiology'
  | 'dental'
  | 'ophthalmology'
  | 'orthopaedics'
  | 'radiology'
  | 'psychiatry'
  | 'pharmacy'
  | 'laboratory';

export interface ServiceOption {
  value: ServiceCategory;
  label: string;
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  { value: 'emergency', label: 'Emergency / A&E' },
  { value: 'general', label: 'General medicine' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paediatrics', label: 'Paediatrics' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'dental', label: 'Dental' },
  { value: 'ophthalmology', label: 'Eye care' },
  { value: 'orthopaedics', label: 'Orthopaedics' },
  { value: 'radiology', label: 'Radiology / Imaging' },
  { value: 'psychiatry', label: 'Mental health' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
];

export interface HospitalSearchParams {
  /** Origin for a "near me" / radius search. */
  lat?: number;
  lng?: number;
  /** Search radius in metres (defaults applied server-side). */
  radius?: number;
  /** Free-text hospital-name query (uses Nominatim instead of Overpass). */
  q?: string;
  /** Restrict results to facilities offering this service. */
  service?: ServiceCategory;
  /** Max results to return. */
  limit?: number;
}

/**
 * Travel modes we expose. Maps onto openrouteservice profiles
 * (driving-car / foot-walking / cycling-regular). Public transit is not
 * offered by the free routing provider, so it is intentionally absent.
 */
export type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING';

export interface DirectionsStep {
  instruction: string;
  distanceText: string;
  durationText: string;
}

export interface DirectionsSummary {
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: DirectionsStep[];
  /** Route polyline as an ordered list of points, for drawing on the map. */
  path: LatLng[];
}

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Raw upstream shapes (OpenStreetMap)
// ---------------------------------------------------------------------------

export interface OSMTags {
  [key: string]: string | undefined;
}

/** An element from the Overpass API (`/api/interpreter`). */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OSMTags;
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

/** A place from the Nominatim search/lookup API. */
export interface NominatimPlace {
  place_id: number;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: OSMTags;
  extratags?: OSMTags;
}
