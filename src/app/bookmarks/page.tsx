'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Empty, Result, Segmented } from 'antd';
import { ArrowLeft, List as ListIcon, Map as MapIcon } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import Header from '@/components/Header';
import HospitalCard from '@/components/HospitalCard';
import HospitalDetails from '@/components/HospitalDetails';
import HospitalMap from '@/components/HospitalMap';
import LoadingState from '@/components/LoadingState';
import { GOOGLE_MAPS_API_KEY } from '@/app/providers';
import { bookmarkToHospital, listBookmarks, type BookmarkItem } from '@/lib/bookmarks';
import { haversineKm } from '@/lib/geo';
import { useUserLocation } from '@/lib/useUserLocation';
import type { DirectionsSummary, Hospital, TravelMode } from '@/types';

async function fetchHospitalDetails(id: string): Promise<Hospital | null> {
  try {
    const res = await fetch(`/api/hospitals/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.hospital as Hospital | undefined) ?? null;
  } catch {
    return null;
  }
}

export default function SavedHospitalsPage() {
  const { location } = useUserLocation();

  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailHospital, setDetailHospital] = useState<Hospital | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [routeTo, setRouteTo] = useState<Hospital | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [directionsSummary, setDirectionsSummary] = useState<DirectionsSummary | null>(null);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listBookmarks());
    } catch (e) {
      setError(
        e instanceof Error && e.message !== 'unauthorized' ? e.message : 'Failed to load saved hospitals',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hospitals = useMemo(
    () =>
      items.map((b) => {
        const hospital = bookmarkToHospital(b);
        const hasCoords = hospital.location.lat !== 0 || hospital.location.lng !== 0;
        if (location && hasCoords) {
          return { ...hospital, distanceKm: haversineKm(location, hospital.location) };
        }
        return hospital;
      }),
    [items, location],
  );

  const openDetails = useCallback(async (hospital: Hospital) => {
    setDetailHospital(hospital);
    setSelectedId(hospital.id);
    setDrawerOpen(true);
    const full = await fetchHospitalDetails(hospital.id);
    if (!full) return;
    setDetailHospital((current) => {
      if (!current || current.id !== hospital.id) return current;
      return {
        ...full,
        distanceKm: current.distanceKm,
        location:
          full.location.lat || full.location.lng ? full.location : current.location,
      };
    });
  }, []);

  const startDirections = useCallback(
    (hospital: Hospital) => {
      setRouteTo(hospital);
      setDetailHospital(hospital);
      setSelectedId(hospital.id);
      setDrawerOpen(true);
      setDirectionsSummary(null);
      setDirectionsError(null);
      setDirectionsLoading(Boolean(location));
      setMobileView('map');
      void fetchHospitalDetails(hospital.id).then((full) => {
        if (!full) return;
        setDetailHospital((current) => {
          if (!current || current.id !== hospital.id) return current;
          return {
            ...full,
            distanceKm: current.distanceKm,
            location:
              full.location.lat || full.location.lng ? full.location : current.location,
          };
        });
        setRouteTo((current) => (current?.id === hospital.id && full.location ? { ...current, ...full } : current));
      });
    },
    [location],
  );

  const clearDirections = useCallback(() => {
    setRouteTo(null);
    setDirectionsSummary(null);
    setDirectionsError(null);
    setDirectionsLoading(false);
  }, []);

  const handleTravelModeChange = useCallback((mode: TravelMode) => {
    setTravelMode(mode);
    setDirectionsSummary(null);
    setDirectionsError(null);
    setDirectionsLoading(true);
  }, []);

  const handleDirectionsSummary = useCallback((summary: DirectionsSummary | null, errorMsg?: string) => {
    setDirectionsSummary(summary);
    setDirectionsError(errorMsg ?? null);
    setDirectionsLoading(false);
  }, []);

  // When the map is not mounted (no API key, or list-only on mobile), still
  // load a route so the details drawer can show ETA and steps.
  const mapHandlesRoute = Boolean(GOOGLE_MAPS_API_KEY) && (isDesktop || mobileView === 'map');

  useEffect(() => {
    if (!routeTo || !location || mapHandlesRoute) return;
    const dest = routeTo.location;
    if (!dest.lat && !dest.lng) {
      setDirectionsLoading(false);
      setDirectionsError('This saved hospital has no map coordinates.');
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      fromLat: String(location.lat),
      fromLng: String(location.lng),
      toLat: String(dest.lat),
      toLng: String(dest.lng),
      mode: travelMode,
    });

    fetch(`/api/directions?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Could not calculate a route.');
        return data.route as DirectionsSummary;
      })
      .then((route) => {
        setDirectionsSummary(route);
        setDirectionsLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setDirectionsSummary(null);
        setDirectionsError(err instanceof Error ? err.message : 'Could not calculate a route.');
        setDirectionsLoading(false);
      });

    return () => controller.abort();
  }, [routeTo, location, travelMode, mapHandlesRoute]);

  const handleUnsave = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((it) => it.placeId !== id));
      if (detailHospital?.id === id) {
        setDrawerOpen(false);
        setDetailHospital(null);
      }
      if (routeTo?.id === id) clearDirections();
    },
    [clearDirections, detailHospital?.id, routeTo?.id],
  );

  const mapPanel = (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-slate-100 shadow-[var(--shadow-card)]"
      style={{
        height: isDesktop ? 'calc(100vh - 8.5rem)' : '62vh',
        position: isDesktop ? 'sticky' : 'static',
        top: '4.5rem',
      }}
    >
      {GOOGLE_MAPS_API_KEY ? (
        <HospitalMap
          hospitals={hospitals}
          userLocation={location}
          selectedId={selectedId}
          onSelect={setSelectedId}
          routeTo={routeTo}
          travelMode={travelMode}
          onDirections={handleDirectionsSummary}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <MapIcon className="mb-3 h-9 w-9 text-slate-400" />
          <p className="font-medium text-slate-900">Map unavailable</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the interactive map.
          </p>
        </div>
      )}
    </div>
  );

  const listPanel = (
    <div className="space-y-4">
      {hospitals.map((h) => (
        <HospitalCard
          key={h.id}
          hospital={h}
          active={selectedId === h.id}
          savedInitially
          onSelect={(hh) => {
            setSelectedId(hh.id);
            if (!isDesktop) setMobileView('map');
          }}
          onViewDetails={openDetails}
          onDirections={startDirections}
          onUnsave={handleUnsave}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen gradient-primary">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Saved hospitals</h1>
          <Link href="/">
            <Button type="text" size="small" icon={<ArrowLeft className="h-4 w-4" />}>
              Back to search
            </Button>
          </Link>
        </div>

        <SignedOut>
          <div className="surface p-6">
            <p className="mb-4 text-sm text-slate-600">Sign in to see the hospitals you have saved.</p>
            <SignInButton mode="modal">
              <Button type="primary">Sign in</Button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {loading ? (
            <LoadingState count={6} />
          ) : error ? (
            <div className="surface">
              <Result status="warning" subTitle={error} />
            </div>
          ) : items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="surface !m-0 px-6 py-16"
              description={
                <span className="text-sm text-slate-500">
                  No saved hospitals yet. Save one from the search results.
                </span>
              }
            />
          ) : (
            <div className="lg:flex lg:items-start lg:gap-5">
              <div className="space-y-4 lg:sticky lg:top-[4.5rem] lg:flex lg:h-[calc(100vh-8.5rem)] lg:w-[400px] lg:shrink-0 lg:flex-col lg:space-y-0">
                {!isDesktop && (
                  <Segmented
                    block
                    value={mobileView}
                    onChange={(v) => setMobileView(v as 'list' | 'map')}
                    options={[
                      {
                        value: 'list',
                        label: (
                          <span className="flex items-center justify-center gap-2 py-0.5">
                            <ListIcon className="h-4 w-4" /> List
                          </span>
                        ),
                      },
                      {
                        value: 'map',
                        label: (
                          <span className="flex items-center justify-center gap-2 py-0.5">
                            <MapIcon className="h-4 w-4" /> Map
                          </span>
                        ),
                      },
                    ]}
                  />
                )}
                {(isDesktop || mobileView === 'list') && (
                  <div className="scrollbar-thin pb-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1.5">
                    {listPanel}
                  </div>
                )}
              </div>
              {(isDesktop || mobileView === 'map') && (
                <div className="mt-4 lg:mt-0 lg:min-w-0 lg:flex-1">{mapPanel}</div>
              )}
            </div>
          )}
        </SignedIn>
      </div>

      <HospitalDetails
        hospital={detailHospital}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        origin={location}
        routeActive={!!routeTo && routeTo.id === detailHospital?.id}
        travelMode={travelMode}
        onTravelModeChange={handleTravelModeChange}
        directionsSummary={directionsSummary}
        directionsLoading={directionsLoading}
        directionsError={directionsError}
        onStartDirections={() => detailHospital && startDirections(detailHospital)}
        onClearDirections={clearDirections}
      />
    </div>
  );
}
