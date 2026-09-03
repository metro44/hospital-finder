'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Map, Marker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { DirectionsSummary, Hospital, LatLng, TravelMode } from '@/types';
import { formatDistanceKm } from '@/lib/geo';

interface HospitalMapProps {
  hospitals: Hospital[];
  userLocation: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When set, a route from the user's location to this hospital is drawn. */
  routeTo: Hospital | null;
  travelMode: TravelMode;
  onDirections: (summary: DirectionsSummary | null, error?: string) => void;
}

const FALLBACK_CENTER: LatLng = { lat: 20, lng: 0 };

// Inline SVG so we don't touch the `google.maps` global during render (it may
// not be ready yet). A blue dot with a white ring for the user's position.
const USER_LOCATION_ICON =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
      '<circle cx="12" cy="12" r="6" fill="#1d4ed8" stroke="#ffffff" stroke-width="3"/></svg>',
  );

export default function HospitalMap({
  hospitals,
  userLocation,
  selectedId,
  onSelect,
  routeTo,
  travelMode,
  onDirections,
}: HospitalMapProps) {
  const selected = hospitals.find((h) => h.id === selectedId) ?? null;

  const center = useMemo<LatLng>(() => {
    if (userLocation) return userLocation;
    if (hospitals[0]) return hospitals[0].location;
    return FALLBACK_CENTER;
  }, [userLocation, hospitals]);

  return (
    <Map
      className="w-full h-full"
      defaultCenter={center}
      defaultZoom={userLocation ? 13 : 3}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
    >
      <MapController center={center} hospitals={hospitals} selected={selected} hasRoute={!!routeTo} />

      {userLocation && (
        <Marker position={userLocation} title="Your location" icon={USER_LOCATION_ICON} zIndex={999} />
      )}

      <ClusteredMarkers hospitals={hospitals} selectedId={selectedId} onSelect={onSelect} />


      {selected && (
        <InfoWindow position={selected.location} onCloseClick={() => onSelect(null)} pixelOffset={[0, -32]}>
          <div className="max-w-[220px]">
            <p className="font-semibold text-gray-900 text-sm">{selected.name}</p>
            {selected.address && <p className="text-xs text-gray-600 mt-1">{selected.address}</p>}
            {typeof selected.distanceKm === 'number' && (
              <p className="text-xs text-gray-500 mt-1">{formatDistanceKm(selected.distanceKm)} away</p>
            )}
          </div>
        </InfoWindow>
      )}

      {routeTo && userLocation && (
        <RouteLayer
          origin={userLocation}
          destination={routeTo.location}
          travelMode={travelMode}
          onResult={onDirections}
        />
      )}
    </Map>
  );
}

/** Renders hospital markers with distance-based clustering. */
function ClusteredMarkers({
  hospitals,
  selectedId,
  onSelect,
}: {
  hospitals: Hospital[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const map = useMap();
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!map) return;
    clustererRef.current = new MarkerClusterer({ map });
    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      Object.values(markersRef.current).forEach((m) => m.setMap(null));
      markersRef.current = {};
    };
  }, [map]);

  const idKey = hospitals.map((h) => h.id).join('|');
  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!map || !clusterer) return;
    const store = markersRef.current;
    const nextIds = new Set(hospitals.map((h) => h.id));

    for (const id of Object.keys(store)) {
      if (!nextIds.has(id)) {
        store[id].setMap(null);
        delete store[id];
      }
    }
    for (const h of hospitals) {
      if (store[h.id]) continue;
      const marker = new google.maps.Marker({ position: h.location, title: h.name });
      marker.addListener('click', () => selectRef.current(h.id));
      store[h.id] = marker;
    }
    clusterer.clearMarkers();
    clusterer.addMarkers(Object.values(store));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, idKey]);

  useEffect(() => {
    for (const [id, marker] of Object.entries(markersRef.current)) {
      marker.setOpacity(selectedId && selectedId !== id ? 0.55 : 1);
      marker.setZIndex(selectedId === id ? 10 : 1);
    }
  }, [selectedId, idKey]);

  return null;
}

/** Keeps the viewport sensible as results / selection / routing change. */
function MapController({
  center,
  hospitals,
  selected,
  hasRoute,
}: {
  center: LatLng;
  hospitals: Hospital[];
  selected: Hospital | null;
  hasRoute: boolean;
}) {
  const map = useMap();
  const lastFitKey = useRef<string>('');

  useEffect(() => {
    if (!map || hasRoute) return;
    if (selected) {
      map.panTo(selected.location);
      if ((map.getZoom() ?? 0) < 14) map.setZoom(15);
      return;
    }
    if (hospitals.length === 0) {
      map.panTo(center);
      return;
    }
    const key = hospitals.map((h) => h.id).join(',');
    if (key === lastFitKey.current) return;
    lastFitKey.current = key;

    const bounds = new google.maps.LatLngBounds();
    hospitals.forEach((h) => bounds.extend(h.location));
    bounds.extend(center);
    map.fitBounds(bounds, 64);
  }, [map, hospitals, selected, center, hasRoute]);

  return null;
}

/**
 * Fetches a route from `/api/directions` (openrouteservice) and draws it as a
 * polyline on the map, fitting the viewport to it.
 */
function RouteLayer({
  origin,
  destination,
  travelMode,
  onResult,
}: {
  origin: LatLng;
  destination: LatLng;
  travelMode: TravelMode;
  onResult: (summary: DirectionsSummary | null, error?: string) => void;
}) {
  const map = useMap();
  const { lat: oLat, lng: oLng } = origin;
  const { lat: dLat, lng: dLng } = destination;
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    if (!map) return;
    const controller = new AbortController();
    const polyline = new google.maps.Polyline({
      map,
      strokeColor: '#1d4ed8',
      strokeWeight: 5,
      strokeOpacity: 0.85,
    });
    const endpoints = new google.maps.Marker({ map, position: { lat: dLat, lng: dLng }, zIndex: 998 });

    const params = new URLSearchParams({
      fromLat: String(oLat),
      fromLng: String(oLng),
      toLat: String(dLat),
      toLng: String(dLng),
      mode: travelMode,
    });

    fetch(`/api/directions?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Could not calculate a route.');
        return data.route as DirectionsSummary;
      })
      .then((route) => {
        polyline.setPath(route.path);
        const bounds = new google.maps.LatLngBounds();
        route.path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 72);
        resultRef.current(route);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        resultRef.current(null, err instanceof Error ? err.message : 'Could not calculate a route.');
      });

    return () => {
      controller.abort();
      polyline.setMap(null);
      endpoints.setMap(null);
    };
  }, [map, oLat, oLng, dLat, dLng, travelMode]);

  return null;
}
