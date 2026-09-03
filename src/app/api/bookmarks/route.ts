export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(bookmarks);
  } catch (error) {
    console.error('GET /api/bookmarks error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const body = await request.json();
    const { placeId, name, address, phone, website, rating, vicinity, lat, lng } = body ?? {};
    if (!placeId || !name) {
      return NextResponse.json({ error: 'Missing required fields: placeId, name' }, { status: 400 });
    }
    const coords = {
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
    };
    const bookmark = await prisma.bookmark.upsert({
      where: { user_place_unique: { userId, placeId } },
      update: { name, address, phone, website, rating, vicinity, ...coords },
      create: { userId, placeId, name, address, phone, website, rating, vicinity, ...coords },
    });
    return NextResponse.json(bookmark, { status: 201 });
  } catch (error) {
    console.error('POST /api/bookmarks error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


