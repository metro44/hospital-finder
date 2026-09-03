import type { LatLng } from '@/types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Very small `opening_hours` heuristic. OSM values range from "24/7" to full
 * Osmium grammar; we only handle the common cases and return `undefined` when
 * we cannot say for sure so the UI can show "Hours unknown".
 */
export function guessOpenNow(openingHours?: string, now = new Date()): boolean | undefined {
  if (!openingHours) return undefined;
  const value = openingHours.trim().toLowerCase();
  if (value === '24/7' || value === 'mo-su 00:00-24:00') return true;
  if (value.includes('closed') || value === 'off') return false;

  const days = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
  const today = days[now.getDay()];
  const minutes = now.getHours() * 60 + now.getMinutes();

  // Match ranges like "Mo-Fr 08:00-18:00" or "08:00-17:00".
  const rangeRe = /(?:([a-z]{2})-([a-z]{2})\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
  let match: RegExpExecArray | null;
  let sawApplicableRange = false;
  while ((match = rangeRe.exec(value)) !== null) {
    const [, dFrom, dTo, h1, m1, h2, m2] = match;
    if (dFrom && dTo) {
      const fromIdx = days.indexOf(dFrom);
      const toIdx = days.indexOf(dTo);
      const todayIdx = days.indexOf(today);
      const inDayRange =
        fromIdx <= toIdx
          ? todayIdx >= fromIdx && todayIdx <= toIdx
          : todayIdx >= fromIdx || todayIdx <= toIdx;
      if (!inDayRange) continue;
    }
    sawApplicableRange = true;
    const start = Number(h1) * 60 + Number(m1);
    const end = Number(h2) * 60 + Number(m2);
    if (minutes >= start && minutes <= end) return true;
  }
  return sawApplicableRange ? false : undefined;
}
