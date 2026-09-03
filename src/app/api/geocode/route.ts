import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'hospital-finder/1.0 (+https://github.com/)';

/**
 * Forward-geocodes a free-text place (city, address) to coordinates via
 * Nominatim. Used when the user searches by city instead of granting GPS.
 */
export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'Missing query (q)' }, { status: 400 });
  }
  try {
    const { data } = await axios.get(NOMINATIM_ENDPOINT, {
      params: { q, format: 'jsonv2', limit: 1, addressdetails: 1 },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 12000,
    });
    const place = Array.isArray(data) ? data[0] : null;
    if (!place) {
      return NextResponse.json({ error: `No match for "${q}"` }, { status: 404 });
    }
    return NextResponse.json({
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      label: place.display_name as string,
    });
  } catch (error) {
    console.error('GET /api/geocode error:', error);
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 502 });
  }
}
