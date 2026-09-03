import type { Hospital, HospitalSearchParams } from '@/types';

const STORAGE_KEY_PREFIX = 'hospitals_cache:';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

interface CachedEntry {
  expiresAt: number;
  hospitals: Hospital[];
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Cache key derived from the search. Coordinates are rounded to ~1km so small
 * GPS jitter still hits the cache; name queries key on the trimmed text.
 */
export function cacheKeyFor(params: HospitalSearchParams): string {
  if (params.q && params.q.trim()) {
    return `${STORAGE_KEY_PREFIX}q:${params.q.trim().toLowerCase()}`;
  }
  const lat = typeof params.lat === 'number' ? params.lat.toFixed(2) : '?';
  const lng = typeof params.lng === 'number' ? params.lng.toFixed(2) : '?';
  const radius = params.radius ?? 'def';
  const service = params.service ?? 'all';
  return `${STORAGE_KEY_PREFIX}geo:${lat},${lng}:${radius}:${service}`;
}

export function readHospitalsFromCache(params: HospitalSearchParams): Hospital[] | null {
  const storage = getStorage();
  if (!storage) return null;
  const key = cacheKeyFor(params);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const entry: CachedEntry = JSON.parse(raw);
    if (!entry || typeof entry.expiresAt !== 'number') return null;
    if (Date.now() > entry.expiresAt) {
      storage.removeItem(key);
      return null;
    }
    return Array.isArray(entry.hospitals) ? entry.hospitals : null;
  } catch {
    return null;
  }
}

export function writeHospitalsToCache(
  params: HospitalSearchParams,
  hospitals: Hospital[],
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      cacheKeyFor(params),
      JSON.stringify({ expiresAt: Date.now() + ttlMs, hospitals } satisfies CachedEntry),
    );
  } catch {
    // ignore quota errors
  }
}

function toQueryString(params: HospitalSearchParams): string {
  const sp = new URLSearchParams();
  if (params.lat != null) sp.set('lat', String(params.lat));
  if (params.lng != null) sp.set('lng', String(params.lng));
  if (params.radius != null) sp.set('radius', String(params.radius));
  if (params.service) sp.set('service', params.service);
  if (params.q) sp.set('q', params.q);
  if (params.limit != null) sp.set('limit', String(params.limit));
  return sp.toString();
}

/** Cache-first fetch used by the UI. Throws on network / server error. */
export async function fetchHospitalsWithCache(params: HospitalSearchParams): Promise<Hospital[]> {
  const cached = readHospitalsFromCache(params);
  if (cached) return cached;

  const res = await fetch(`/api/hospitals?${toQueryString(params)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Search failed (${res.status})`);
  }
  const data = await res.json();
  const hospitals = (data.hospitals ?? []) as Hospital[];
  writeHospitalsToCache(params, hospitals);
  return hospitals;
}
