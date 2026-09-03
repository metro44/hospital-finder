'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '@/types';

type Status = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

interface UserLocationState {
  location: LatLng | null;
  status: Status;
  /** How the current location was obtained. */
  source: 'gps' | 'ip' | 'manual' | null;
  error: string | null;
}

const STORAGE_KEY = 'user_location';

function readStored(): (LatLng & { source: 'gps' | 'ip' | 'manual' }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function persist(loc: LatLng, source: 'gps' | 'ip' | 'manual') {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loc, source }));
  } catch {
    /* ignore */
  }
}

/**
 * Resolves the user's location: browser geolocation first, then a best-effort
 * IP fallback, plus a `setManual` escape hatch for city search. The last good
 * value is cached in localStorage to avoid re-prompting on every navigation.
 */
export function useUserLocation() {
  // Start empty on both server and first client render, then hydrate from
  // localStorage in an effect so SSR markup matches the client.
  const [state, setState] = useState<UserLocationState>({
    location: null,
    status: 'idle',
    source: null,
    error: null,
  });

  useEffect(() => {
    const stored = readStored();
    if (!stored) return;
    setState((s) =>
      s.location
        ? s
        : { location: { lat: stored.lat, lng: stored.lng }, status: 'ready', source: stored.source, error: null },
    );
  }, []);

  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((s) => ({ ...s, status: 'unavailable', error: 'Geolocation is not supported by this browser.' }));
      return;
    }
    setState((s) => ({ ...s, status: 'locating', error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        persist(loc, 'gps');
        setState({ location: loc, status: 'ready', source: 'gps', error: null });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setState((s) => ({
          ...s,
          status: denied ? 'denied' : 'unavailable',
          error: denied
            ? 'Location permission denied. Search by city name instead.'
            : 'Could not determine your location.',
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const setManual = useCallback((loc: LatLng, source: 'ip' | 'manual' = 'manual') => {
    persist(loc, source);
    setState({ location: loc, status: 'ready', source, error: null });
  }, []);

  // Best-effort IP fallback when the user hasn't granted GPS and we have nothing.
  useEffect(() => {
    if (state.location || state.status === 'locating') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || typeof data?.latitude !== 'number') return;
        setState((s) =>
          s.location
            ? s
            : { location: { lat: data.latitude, lng: data.longitude }, status: 'ready', source: 'ip', error: null },
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, requestGps, setManual };
}
