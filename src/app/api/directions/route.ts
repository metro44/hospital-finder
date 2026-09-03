import { NextRequest, NextResponse } from 'next/server';
import { DirectionsUnavailableError, fetchRoute } from '@/lib/directions';
import type { TravelMode } from '@/types';

const MODES = new Set<TravelMode>(['DRIVING', 'WALKING', 'BICYCLING']);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromLat = Number(searchParams.get('fromLat'));
  const fromLng = Number(searchParams.get('fromLng'));
  const toLat = Number(searchParams.get('toLat'));
  const toLng = Number(searchParams.get('toLng'));
  const mode = (searchParams.get('mode') ?? 'DRIVING') as TravelMode;

  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: 'fromLat, fromLng, toLat, toLng are required' }, { status: 400 });
  }
  if (!MODES.has(mode)) {
    return NextResponse.json({ error: `Unsupported travel mode: ${mode}` }, { status: 400 });
  }

  try {
    const route = await fetchRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }, mode);
    return NextResponse.json({ route });
  } catch (error) {
    if (error instanceof DirectionsUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('GET /api/directions error:', error);
    return NextResponse.json({ error: 'Failed to calculate route' }, { status: 502 });
  }
}
