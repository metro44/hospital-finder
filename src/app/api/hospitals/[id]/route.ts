import { NextRequest, NextResponse } from 'next/server';
import { getHospitalDetails } from '@/lib/hospitals';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // id arrives url-encoded as "node%2F123456"; Next decodes route params.
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Hospital id is required' }, { status: 400 });
    }

    const hospital = await getHospitalDetails(id);
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }
    return NextResponse.json({ hospital });
  } catch (error) {
    console.error('GET /api/hospitals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch hospital details' }, { status: 502 });
  }
}
