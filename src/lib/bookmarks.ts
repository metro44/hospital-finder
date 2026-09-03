import type { Hospital } from '@/types';

export interface BookmarkItem {
  id: string;
  userId: string;
  placeId: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  vicinity?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export async function listBookmarks(): Promise<BookmarkItem[]> {
  const res = await fetch('/api/bookmarks', { cache: 'no-store' });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('Failed to load saved hospitals');
  return res.json();
}

export async function saveBookmarkFromHospital(hospital: Hospital): Promise<BookmarkItem> {
  const res = await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placeId: hospital.id,
      name: hospital.name,
      address: hospital.address,
      phone: hospital.phone,
      website: hospital.website,
      vicinity: hospital.vicinity,
      lat: hospital.location?.lat,
      lng: hospital.location?.lng,
    }),
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to save hospital');
  }
  return res.json();
}

export async function deleteBookmark(placeId: string): Promise<void> {
  const res = await fetch(`/api/bookmarks/${encodeURIComponent(placeId)}`, { method: 'DELETE' });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok && res.status !== 204) throw new Error('Failed to remove saved hospital');
}

/** Rebuilds a partial `Hospital` from a stored bookmark for card/map display. */
export function bookmarkToHospital(b: BookmarkItem): Hospital {
  return {
    id: b.placeId,
    name: b.name,
    address: b.address ?? b.vicinity ?? '',
    location: { lat: b.lat ?? 0, lng: b.lng ?? 0 },
    phone: b.phone ?? undefined,
    website: b.website ?? undefined,
    types: [],
    services: [],
    vicinity: b.vicinity ?? undefined,
  };
}
