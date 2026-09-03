import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import type { PlaceSuggestion } from '@/types';

// Photon (https://photon.komoot.io) — free, key-less, OSM-based geocoder built
// for type-ahead search. No sign-up required.
const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
const USER_AGENT = 'hospital-finder/1.0 (+https://github.com/)';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    county?: string;
    country?: string;
  };
}

function buildLabel(p: PhotonFeature['properties']): string {
  const head = p.name ?? [p.housenumber, p.street].filter(Boolean).join(' ');
  const tail = [p.district, p.city ?? p.county, p.state, p.country].filter(Boolean);
  return [head, ...tail].filter(Boolean).join(', ');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const { data } = await axios.get<{ features: PhotonFeature[] }>(PHOTON_ENDPOINT, {
      params: {
        q,
        limit: 6,
        lang: 'en',
        ...(lat && lng ? { lat, lon: lng } : {}),
      },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });

    const suggestions: PlaceSuggestion[] = (data.features ?? [])
      .filter((f) => Array.isArray(f.geometry?.coordinates))
      .map((f) => ({
        label: buildLabel(f.properties),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }))
      .filter((s) => s.label);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('GET /api/autocomplete error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
