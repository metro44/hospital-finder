'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { listBookmarks } from '@/lib/bookmarks';

/**
 * Fetches the signed-in user's saved-hospital ids once, so a list of
 * `HospitalCard`s can be told their saved state via `savedInitially` instead of
 * each card fetching the whole bookmark list on mount.
 */
export function useSavedIds() {
  const { isSignedIn } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setIds(new Set());
      return;
    }
    try {
      const bookmarks = await listBookmarks();
      setIds(new Set(bookmarks.map((b) => b.placeId)));
    } catch {
      /* ignore */
    }
  }, [isSignedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ids, refresh };
}
