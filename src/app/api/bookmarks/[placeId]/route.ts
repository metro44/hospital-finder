export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const url = new URL(request.url);
    const match = url.pathname.match(/\/api\/bookmarks\/([^/]+)/);
    const placeId = match?.[1];
    if (!placeId) {
      return new NextResponse('Missing placeId', { status: 400 });
    }
    await prisma.bookmark.delete({
      where: { user_place_unique: { userId, placeId } },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/bookmarks/[placeId] error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}


