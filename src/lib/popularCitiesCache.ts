const STORAGE_KEY_PREFIX = 'popular_cities:';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface CachedCitiesEntry {
  expiresAt: number;
  cities: string[];
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyForCountry(countryCode: string): string {
  return STORAGE_KEY_PREFIX + countryCode.toUpperCase();
}

export function readPopularCitiesFromCache(countryCode: string): string[] | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(keyForCountry(countryCode));
  if (!raw) return null;
  try {
    const entry: CachedCitiesEntry = JSON.parse(raw);
    if (!entry || typeof entry.expiresAt !== 'number') return null;
    if (Date.now() > entry.expiresAt) {
      storage.removeItem(keyForCountry(countryCode));
      return null;
    }
    return Array.isArray(entry.cities) ? entry.cities : null;
  } catch {
    return null;
  }
}

export function writePopularCitiesToCache(countryCode: string, cities: string[], ttlMs: number = DEFAULT_TTL_MS): void {
  const storage = getStorage();
  if (!storage) return;
  const entry: CachedCitiesEntry = {
    expiresAt: Date.now() + ttlMs,
    cities,
  };
  try {
    storage.setItem(keyForCountry(countryCode), JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}


