import axios from 'axios';
import type { DirectionsSummary, LatLng, TravelMode } from '@/types';
import { formatDistanceKm } from '@/lib/geo';

const ORS_BASE = 'https://api.openrouteservice.org';

const PROFILE: Record<TravelMode, string> = {
  DRIVING: 'driving-car',
  WALKING: 'foot-walking',
  BICYCLING: 'cycling-regular',
};

export class DirectionsUnavailableError extends Error {}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

interface ORSDirectionsResponse {
  features: Array<{
    geometry: { coordinates: [number, number][] };
    properties: {
      summary: { distance: number; duration: number };
      segments: Array<{
        steps: Array<{ instruction: string; distance: number; duration: number }>;
      }>;
    };
  }>;
}

/**
 * Computes a route between two points using openrouteservice (free tier:
 * ~2000 requests/day). Requires `ORS_API_KEY`. Throws
 * `DirectionsUnavailableError` when the key is missing or rejected.
 */
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
): Promise<DirectionsSummary> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    throw new DirectionsUnavailableError(
      'Routing is not configured — set ORS_API_KEY (free from openrouteservice.org).',
    );
  }

  try {
    const { data } = await axios.post<ORSDirectionsResponse>(
      `${ORS_BASE}/v2/directions/${PROFILE[mode]}/geojson`,
      {
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        instructions: true,
      },
      {
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        timeout: 15000,
      },
    );

    const feature = data.features?.[0];
    if (!feature) {
      throw new DirectionsUnavailableError('No route could be found between these points.');
    }

    const { distance, duration } = feature.properties.summary;
    const steps = feature.properties.segments.flatMap((seg) =>
      seg.steps.map((s) => ({
        instruction: stripHtml(s.instruction),
        distanceText: formatDistanceKm(s.distance / 1000),
        durationText: formatDuration(s.duration),
      })),
    );

    return {
      distanceText: formatDistanceKm(distance / 1000),
      durationText: formatDuration(duration),
      distanceMeters: distance,
      durationSeconds: duration,
      steps,
      path: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    };
  } catch (error) {
    if (error instanceof DirectionsUnavailableError) throw error;
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401 || status === 403) {
      throw new DirectionsUnavailableError(
        'Routing request was rejected — check the ORS_API_KEY or its daily quota.',
      );
    }
    if (status === 404) {
      throw new DirectionsUnavailableError('No routable path was found for this travel mode.');
    }
    console.error('ORS directions error:', error instanceof Error ? error.message : error);
    throw new DirectionsUnavailableError('The routing service is unavailable right now.');
  }
}
