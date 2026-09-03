import { NextRequest, NextResponse } from 'next/server';
import { searchHospitals } from '@/lib/hospitals';
import type { HospitalSearchParams, ServiceCategory } from '@/types';
import { SERVICE_OPTIONS } from '@/types';

const VALID_SERVICES = new Set<string>(SERVICE_OPTIONS.map((s) => s.value));

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || undefined;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = searchParams.get('radius');
    const service = searchParams.get('service')?.trim() || undefined;
    const limit = searchParams.get('limit');

    if (!q && (!lat || !lng)) {
      return NextResponse.json(
        { error: 'Provide either a name query (q) or coordinates (lat & lng).' },
        { status: 400 },
      );
    }
    if (service && !VALID_SERVICES.has(service)) {
      return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 400 });
    }

    const params: HospitalSearchParams = {
      q,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radius: radius ? Number(radius) : undefined,
      service: service as ServiceCategory | undefined,
      limit: limit ? Math.max(1, Math.min(120, Number(limit))) : undefined,
    };

    const hospitals = await searchHospitals(params);
    return NextResponse.json(
      { hospitals },
      { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('GET /api/hospitals error:', error);
    return NextResponse.json(
      { error: 'Upstream map data is unavailable right now. Please try again shortly.' },
      { status: 502 },
    );
  }
}
