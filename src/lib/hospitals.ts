import axios from 'axios';
import type {
  Hospital,
  HospitalSearchParams,
  NominatimPlace,
  OSMTags,
  OverpassElement,
  OverpassResponse,
  ServiceCategory,
} from '@/types';
import { guessOpenNow, haversineKm } from '@/lib/geo';

// Overpass mirrors, tried in order. The public instance can be slow or return
// 429/504 under load, so we fail over to the Kumi Systems mirror.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'hospital-finder/1.0 (+https://github.com/)';

const DEFAULT_RADIUS_M = 8000;
const MAX_RADIUS_M = 40000;
const DEFAULT_LIMIT = 60;

/**
 * Maps our normalised service categories onto the OSM tag values and name
 * keywords that indicate a facility offers that service. `healthcare:speciality`
 * is a semicolon-separated list in practice.
 */
const SERVICE_MATCHERS: Record<ServiceCategory, { specialities: string[]; keywords: string[] }> = {
  emergency: { specialities: ['emergency'], keywords: ['emergency', 'a&e', 'accident', 'trauma', 'casualty'] },
  general: { specialities: ['general', 'community'], keywords: ['general hospital', 'medical centre', 'medical center', 'health centre', 'health center'] },
  maternity: { specialities: ['gynaecology', 'obstetrics', 'midwife', 'reproductive_medicine'], keywords: ['maternity', 'materni', 'women', 'obstetric', 'gynae'] },
  paediatrics: { specialities: ['paediatrics', 'pediatrics', 'neonatology'], keywords: ['paediatric', 'pediatric', 'children', "children's"] },
  surgery: { specialities: ['surgery', 'general_surgery', 'plastic_surgery', 'vascular_surgery'], keywords: ['surgery', 'surgical'] },
  cardiology: { specialities: ['cardiology', 'cardiac_surgery'], keywords: ['cardio', 'heart'] },
  dental: { specialities: ['dentistry', 'orthodontics', 'oral_surgery'], keywords: ['dental', 'dentist', 'orthodont'] },
  ophthalmology: { specialities: ['ophthalmology', 'optometry'], keywords: ['eye', 'ophthalm', 'optician', 'optometr', 'vision'] },
  orthopaedics: { specialities: ['orthopaedics', 'orthopedics', 'traumatology'], keywords: ['orthop', 'bone', 'joint', 'spine'] },
  radiology: { specialities: ['radiology', 'diagnostic_radiology', 'nuclear_medicine'], keywords: ['radiolog', 'imaging', 'x-ray', 'mri', 'ct scan', 'ultrasound', 'diagnostic'] },
  psychiatry: { specialities: ['psychiatry', 'psychotherapy', 'mental_health'], keywords: ['psychiatr', 'mental health', 'behavioral', 'behavioural'] },
  pharmacy: { specialities: [], keywords: ['pharmacy', 'chemist', 'drug store', 'drugstore'] },
  laboratory: { specialities: ['laboratory', 'pathology', 'clinical_pathology'], keywords: ['laborator', 'pathology', 'diagnostic lab', 'medical lab'] },
};

function clampRadius(radius?: number): number {
  if (!radius || !Number.isFinite(radius)) return DEFAULT_RADIUS_M;
  return Math.max(500, Math.min(MAX_RADIUS_M, Math.round(radius)));
}

function uniq(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))];
}

function firstTag(tags: OSMTags, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = tags[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function buildAddress(tags: OSMTags): string {
  const parts = [
    firstTag(tags, ['addr:housenumber']),
    firstTag(tags, ['addr:street']),
    firstTag(tags, ['addr:suburb', 'addr:neighbourhood']),
    firstTag(tags, ['addr:city', 'addr:town', 'addr:village']),
    firstTag(tags, ['addr:state']),
    firstTag(tags, ['addr:postcode']),
    firstTag(tags, ['addr:country']),
  ].filter(Boolean);
  return parts.join(', ');
}

function deriveServices(tags: OSMTags, name: string): ServiceCategory[] {
  const haystackParts = [
    tags['healthcare:speciality'],
    tags['healthcare:speciality:en'],
    tags['medical_speciality'],
    tags['speciality'],
    tags['healthcare'],
    tags['amenity'],
    name,
  ]
    .filter(Boolean)
    .join(' ; ')
    .toLowerCase();
  const specialityTokens = haystackParts.split(/[;,\s/|]+/).filter(Boolean);

  const found = new Set<ServiceCategory>();
  (Object.keys(SERVICE_MATCHERS) as ServiceCategory[]).forEach((service) => {
    const { specialities, keywords } = SERVICE_MATCHERS[service];
    const specialityHit = specialities.some((s) => specialityTokens.includes(s));
    const keywordHit = keywords.some((k) => haystackParts.includes(k));
    if (specialityHit || keywordHit) found.add(service);
  });

  // A bare hospital with no other signal is assumed to offer general medicine.
  if (found.size === 0 && (tags.amenity === 'hospital' || tags.healthcare === 'hospital')) {
    found.add('general');
  }
  if (tags.emergency === 'yes') found.add('emergency');
  return [...found];
}

function elementToHospital(el: OverpassElement, origin?: { lat: number; lng: number }): Hospital | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const name =
    firstTag(tags, ['name', 'name:en', 'official_name', 'alt_name']) ?? 'Unnamed facility';
  const openingHours = firstTag(tags, ['opening_hours']);
  const services = deriveServices(tags, name);

  const hospital: Hospital = {
    id: `${el.type}/${el.id}`,
    name,
    address: buildAddress(tags) || firstTag(tags, ['addr:full']) || '',
    location: { lat, lng },
    phone: firstTag(tags, ['phone', 'contact:phone', 'contact:mobile']),
    email: firstTag(tags, ['email', 'contact:email']),
    website: firstTag(tags, ['website', 'contact:website', 'url']),
    types: uniq([tags.amenity, tags.healthcare]),
    services,
    openingHours,
    openNow: guessOpenNow(openingHours),
    vicinity: firstTag(tags, ['addr:suburb', 'addr:city', 'addr:town', 'addr:village']),
    emergency: tags.emergency === 'yes' || services.includes('emergency'),
  };

  if (origin) {
    hospital.distanceKm = haversineKm(origin, hospital.location);
  }
  return hospital;
}

function isHealthcareElement(el: OverpassElement): boolean {
  const tags = el.tags ?? {};
  if (tags.amenity && ['hospital', 'clinic', 'doctors', 'pharmacy'].includes(tags.amenity)) return true;
  if (tags.healthcare) return true;
  return false;
}

async function runOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const { data } = await axios.post<OverpassResponse>(
        endpoint,
        new URLSearchParams({ data: query }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
          timeout: 25000,
        },
      );
      return data?.elements ?? [];
    } catch (error) {
      lastError = error;
      console.error(`Overpass request to ${endpoint} failed:`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Overpass endpoints failed');
}

/**
 * Primary search: healthcare facilities within `radius` metres of a point.
 * Optionally restricted to a single service category.
 */
export async function searchHospitalsNearby(params: HospitalSearchParams): Promise<Hospital[]> {
  const { lat, lng, service } = params;
  if (lat == null || lng == null) return [];
  const radius = clampRadius(params.radius);
  const limit = params.limit ?? DEFAULT_LIMIT;

  const specialityFilter =
    service && SERVICE_MATCHERS[service].specialities.length > 0
      ? `["healthcare:speciality"~"${SERVICE_MATCHERS[service].specialities.join('|')}",i]`
      : '';

  // Grab all amenity=hospital/clinic/doctors plus anything tagged healthcare=*,
  // then filter/rank in JS. `out center` gives ways/relations a coordinate.
  const query = `
    [out:json][timeout:25];
    (
      nwr["amenity"~"^(hospital|clinic|doctors)$"](around:${radius},${lat},${lng});
      nwr["healthcare"](around:${radius},${lat},${lng})${specialityFilter};
    );
    out center tags ${Math.min(limit * 4, 400)};
  `;

  const elements = await runOverpass(query);
  const origin = { lat, lng };
  const seen = new Set<string>();
  let hospitals = elements
    .filter(isHealthcareElement)
    .map((el) => elementToHospital(el, origin))
    .filter((h): h is Hospital => h !== null)
    .filter((h) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });

  if (service) {
    hospitals = hospitals.filter((h) => h.services.includes(service));
  }

  hospitals.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return hospitals.slice(0, limit);
}

/**
 * Name search via Nominatim. Biased towards `origin` when provided so a query
 * like "General Hospital" returns nearby matches first.
 */
export async function searchHospitalsByName(params: HospitalSearchParams): Promise<Hospital[]> {
  const q = params.q?.trim();
  if (!q) return [];
  const limit = params.limit ?? DEFAULT_LIMIT;
  const origin =
    params.lat != null && params.lng != null ? { lat: params.lat, lng: params.lng } : undefined;

  try {
    const { data } = await axios.get<NominatimPlace[]>(`${NOMINATIM_ENDPOINT}/search`, {
      params: {
        q,
        format: 'jsonv2',
        addressdetails: 1,
        extratags: 1,
        namedetails: 1,
        limit: Math.min(limit, 40),
        ...(origin
          ? {
              // ~0.5 degree box around the origin as a soft bias.
              viewbox: `${origin.lng - 0.6},${origin.lat + 0.6},${origin.lng + 0.6},${origin.lat - 0.6}`,
              bounded: 0,
            }
          : {}),
      },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15000,
    });

    let hospitals = (data ?? [])
      .map((place) => nominatimToHospital(place, origin))
      .filter((h): h is Hospital => h !== null)
      .filter(looksLikeHealthcare);

    if (origin) {
      hospitals.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      // Nominatim's viewbox is only a soft bias for generic queries; drop
      // far-flung matches unless that would leave us with almost nothing.
      const near = hospitals.filter((h) => (h.distanceKm ?? Infinity) < 300);
      if (near.length >= 3) hospitals = near;
    }
    return hospitals.slice(0, limit);
  } catch (error) {
    console.error('Nominatim name search failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/** Guards against Nominatim returning unrelated places for a loose query. */
function looksLikeHealthcare(h: Hospital): boolean {
  if (h.types.length > 0 || h.services.length > 0) return true;
  const text = `${h.name} ${h.address}`.toLowerCase();
  return /hospital|clinic|health|medical|pharmac|dental|doctor|surgery|maternity|dispensary|infirmary/.test(text);
}

function nominatimToHospital(
  place: NominatimPlace,
  origin?: { lat: number; lng: number },
): Hospital | null {
  const lat = parseFloat(place.lat);
  const lng = parseFloat(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // `extratags` are genuine OSM tags. `address` holds address components — note
  // Nominatim puts the POI's *name* in `address.amenity`, so we never treat the
  // address block as tags for classification.
  const tags: OSMTags = { ...(place.extratags ?? {}) };
  const addr: OSMTags = place.address ?? {};
  const category =
    place.class === 'amenity' || place.class === 'healthcare' ? place.type : undefined;
  if (category === 'hospital' || category === 'clinic' || category === 'doctors' || category === 'pharmacy') {
    tags.amenity ??= category;
  } else if (place.class === 'healthcare' && category) {
    tags.healthcare ??= category;
  }

  const name = place.name || place.display_name.split(',')[0] || 'Unnamed facility';
  const openingHours = firstTag(tags, ['opening_hours']);

  const hospital: Hospital = {
    id: `${place.osm_type}/${place.osm_id}`,
    name,
    address: place.display_name,
    location: { lat, lng },
    phone: firstTag(tags, ['phone', 'contact:phone']),
    email: firstTag(tags, ['email', 'contact:email']),
    website: firstTag(tags, ['website', 'contact:website']),
    types: uniq([tags.amenity, tags.healthcare, category]),
    services: deriveServices(tags, name),
    openingHours,
    openNow: guessOpenNow(openingHours),
    vicinity: firstTag(addr, ['suburb', 'city', 'town', 'village']),
    emergency: tags.emergency === 'yes',
  };
  if (origin) hospital.distanceKm = haversineKm(origin, hospital.location);
  return hospital;
}

/** Details lookup for a single facility by `${osm_type}/${osm_id}` id. */
export async function getHospitalDetails(id: string): Promise<Hospital | null> {
  const [type, rawId] = id.split('/');
  if (!type || !rawId || Number.isNaN(Number(rawId))) return null;

  const prefix = type === 'node' ? 'N' : type === 'way' ? 'W' : 'R';
  try {
    const { data } = await axios.get<NominatimPlace | NominatimPlace[]>(
      `${NOMINATIM_ENDPOINT}/lookup`,
      {
        params: {
          osm_ids: `${prefix}${rawId}`,
          format: 'jsonv2',
          addressdetails: 1,
          extratags: 1,
          namedetails: 1,
        },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
      },
    );
    const place = Array.isArray(data) ? data[0] : data;
    return place ? nominatimToHospital(place) : null;
  } catch (error) {
    console.error('Nominatim lookup failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Dispatches to name search or nearby search based on the params provided. */
export async function searchHospitals(params: HospitalSearchParams): Promise<Hospital[]> {
  if (params.q && params.q.trim()) return searchHospitalsByName(params);
  return searchHospitalsNearby(params);
}
