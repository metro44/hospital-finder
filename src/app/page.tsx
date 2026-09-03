'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Empty, Result, Segmented } from 'antd';
import { List as ListIcon, Map as MapIcon } from 'lucide-react';
import Header from '@/components/Header';
import SearchBar, { type SearchState } from '@/components/SearchBar';
import HospitalMap from '@/components/HospitalMap';
import HospitalCard from '@/components/HospitalCard';
import HospitalDetails from '@/components/HospitalDetails';
import LoadingState from '@/components/LoadingState';
import { GOOGLE_MAPS_API_KEY } from '@/app/providers';
import { useUserLocation } from '@/lib/useUserLocation';
import { useSavedIds } from '@/lib/useSavedIds';
import { cacheKeyFor, fetchHospitalsWithCache } from '@/lib/hospitalsCache';
import type { DirectionsSummary, Hospital, HospitalSearchParams, TravelMode } from '@/types';

const DEFAULT_SEARCH: SearchState = { mode: 'nearby', q: '', service: '', radiusKm: 8 };

export default function Home() {
  const { location, status, source, requestGps, setManual } = useUserLocation();
  const { ids: savedIds, refresh: refreshSaved } = useSavedIds();
  const { message } = App.useApp();

  const [search, setSearch] = useState<SearchState>(DEFAULT_SEARCH);
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string>();
  const [countryName, setCountryName] = useState<string>();

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

  // Country detection for the "popular cities" chips.
  useEffect(() => {
    try {
      const c = localStorage.getItem('user_country_code');
      const n = localStorage.getItem('user_country_name');
      if (c) setCountryCode(c);
      if (n) setCountryName(n);
    } catch {
      /* ignore */
    }
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((d) => {
        if (d?.country_code) {
          const code = String(d.country_code).toUpperCase();
          setCountryCode(code);
          try {
            localStorage.setItem('user_country_code', code);
          } catch {}
        }
        if (d?.country_name) {
          setCountryName(d.country_name);
          try {
            localStorage.setItem('user_country_name', d.country_name);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (source === 'gps' && !areaLabel) setAreaLabel('your current location');
  }, [source, areaLabel]);

  const params = useMemo<HospitalSearchParams | null>(() => {
    if (search.mode === 'name' && search.q.trim()) {
      return {
        q: search.q.trim(),
        lat: location?.lat,
        lng: location?.lng,
        service: search.service || undefined,
      };
    }
    if (location) {
      return {
        lat: location.lat,
        lng: location.lng,
        radius: search.radiusKm * 1000,
        service: search.service || undefined,
      };
    }
    return null;
  }, [search, location]);

  const query = useQuery<Hospital[]>({
    queryKey: ['hospitals', params ? cacheKeyFor(params) : 'none'],
    queryFn: () => fetchHospitalsWithCache(params as HospitalSearchParams),
    enabled: !!params,
  });

  const hospitals = query.data ?? [];

  const handlePickCity = useCallback(
    async (city: string) => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setManual({ lat: data.lat, lng: data.lng }, 'manual');
        setAreaLabel(data.label?.split(',').slice(0, 2).join(', ') || city);
        setSearch((s) => ({ ...s, mode: 'nearby', q: '' }));
      } catch {
        message.error(`Could not find "${city}"`);
      }
    },
    [setManual, message],
  );

  const handleSelectPlace = useCallback(
    ({ lat, lng, label }: { lat: number; lng: number; label: string }) => {
      setManual({ lat, lng }, 'manual');
      setAreaLabel(label.split(',').slice(0, 2).join(', ') || label);
      setSearch((s) => ({ ...s, mode: 'nearby', q: '' }));
    },
    [setManual],
  );

  const handleUseMyLocation = useCallback(() => {
    setAreaLabel('your current location');
    requestGps();
  }, [requestGps]);

  const startDirections = useCallback((hospital: Hospital) => {
    setRouteTo(hospital);
    setDetailHospital(hospital);
    setSelectedId(hospital.id);
    setDrawerOpen(true);
    setDirectionsSummary(null);
    setDirectionsError(null);
    setDirectionsLoading(true);
    setMobileView('map');
  }, []);

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

  const handleDirectionsSummary = useCallback((summary: DirectionsSummary | null, error?: string) => {
    setDirectionsSummary(summary);
    setDirectionsError(error ?? null);
    setDirectionsLoading(false);
  }, []);

  const viewDetails = useCallback((hospital: Hospital) => {
    setDetailHospital(hospital);
    setSelectedId(hospital.id);
    setDrawerOpen(true);
  }, []);

  const mapPanel = (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-slate-100 shadow-[var(--shadow-card)]"
      style={{
        height: isDesktop ? 'calc(100vh - 5.5rem)' : '62vh',
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

  const resultsPanel = (() => {
    if (!params) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="surface !m-0 px-6 py-12"
          description={
            <span className="text-sm text-slate-500">
              {status === 'denied'
                ? 'Location access is blocked. Enter a city or area above.'
                : 'Allow location access or enter a city to find hospitals near you.'}
            </span>
          }
        />
      );
    }
    if (query.isLoading) return <LoadingState />;
    if (query.isError) {
      return (
        <div className="surface">
          <Result
            status="warning"
            subTitle={(query.error as Error)?.message || 'The data service is unavailable right now.'}
            extra={
              <Button type="primary" onClick={() => query.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      );
    }
    if (hospitals.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="surface !m-0 px-6 py-12"
          description={
            <span className="text-sm text-slate-500">
              {search.service
                ? 'Nothing matched that service here. Widen the radius or clear the filter.'
                : 'No facilities here. Try a wider radius or a nearby city.'}
            </span>
          }
        />
      );
    }
    return (
      <div className="space-y-2.5">
        <p className="px-1 text-[13px] text-slate-500">
          <span className="font-semibold text-slate-700">{hospitals.length}</span>{' '}
          {hospitals.length === 1 ? 'facility' : 'facilities'}
          {areaLabel ? ` near ${areaLabel}` : ''}
        </p>
        {hospitals.map((h) => (
          <HospitalCard
            key={h.id}
            hospital={h}
            active={selectedId === h.id}
            savedInitially={savedIds.has(h.id)}
            onSelect={(hh) => {
              setSelectedId(hh.id);
              if (!isDesktop) setMobileView('map');
            }}
            onViewDetails={viewDetails}
            onDirections={startDirections}
            onUnsave={refreshSaved}
          />
        ))}
      </div>
    );
  })();

  return (
    <div className="min-h-screen gradient-primary">
      <Header />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="lg:flex lg:items-start lg:gap-5">
          {/* Left column — search stays put, only the list scrolls (lg+) */}
          <div className="space-y-4 lg:sticky lg:top-[4.5rem] lg:flex lg:h-[calc(100vh-5.5rem)] lg:w-[400px] lg:shrink-0 lg:flex-col lg:space-y-0">
            <div className="lg:shrink-0">
              <SearchBar
                value={search}
                onChange={setSearch}
                onUseMyLocation={handleUseMyLocation}
                onPickCity={handlePickCity}
                onSelectPlace={handleSelectPlace}
                locationLabel={location ? areaLabel : null}
                locationStatus={status}
                biasPoint={location}
                countryCode={countryCode}
                countryName={countryName}
              />
            </div>

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
              <div className="scrollbar-thin pb-2 lg:mt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1.5">
                {resultsPanel}
              </div>
            )}
          </div>

          {/* Map column */}
          {(isDesktop || mobileView === 'map') && (
            <div className="mt-4 lg:mt-0 lg:min-w-0 lg:flex-1">{mapPanel}</div>
          )}
        </div>
      </main>

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
