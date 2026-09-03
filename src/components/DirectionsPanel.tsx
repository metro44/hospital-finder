'use client';

import { Alert, Button, Segmented, Skeleton, Timeline } from 'antd';
import { Bike, Car, ExternalLink, Footprints } from 'lucide-react';
import type { DirectionsSummary, Hospital, LatLng, TravelMode } from '@/types';

interface DirectionsPanelProps {
  hospital: Hospital;
  origin: LatLng | null;
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  summary: DirectionsSummary | null;
  loading: boolean;
  error?: string | null;
  onClear: () => void;
}

const MODES: { value: TravelMode; label: string; Icon: typeof Car }[] = [
  { value: 'DRIVING', label: 'Drive', Icon: Car },
  { value: 'WALKING', label: 'Walk', Icon: Footprints },
  { value: 'BICYCLING', label: 'Cycle', Icon: Bike },
];

function googleMapsDirUrl(origin: LatLng | null, dest: LatLng, mode: TravelMode): string {
  const params = new URLSearchParams({
    destination: `${dest.lat},${dest.lng}`,
    travelmode: mode.toLowerCase(),
  });
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?api=1&${params.toString()}`;
}

export default function DirectionsPanel({
  hospital,
  origin,
  travelMode,
  onTravelModeChange,
  summary,
  loading,
  error,
  onClear,
}: DirectionsPanelProps) {
  return (
    <div className="mt-5 border-t border-[var(--color-line)] pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[15px] font-semibold text-slate-900">Directions</h4>
        <Button type="text" size="small" onClick={onClear}>
          Clear
        </Button>
      </div>

      <Segmented<TravelMode>
        block
        className="mt-3"
        value={travelMode}
        onChange={onTravelModeChange}
        options={MODES.map(({ value, label, Icon }) => ({
          value,
          label: (
            <span className="flex items-center justify-center gap-1.5 py-0.5 text-[13px]">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ),
        }))}
      />

      {!origin && (
        <Alert
          className="mt-3"
          type="warning"
          showIcon
          message="Set your location to see a route. You can still open Google Maps below."
        />
      )}

      <div className="mt-3">
        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : error ? (
          <Alert type="warning" showIcon message={error} />
        ) : summary ? (
          <>
            <div className="flex items-baseline gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
              <span className="text-lg font-semibold text-slate-900">{summary.durationText}</span>
              <span className="text-sm text-slate-500">{summary.distanceText}</span>
            </div>
            {summary.steps.length > 0 && (
              <Timeline
                className="mt-4 px-1"
                items={summary.steps.map((step) => ({
                  children: (
                    <span className="text-[13px] text-slate-700">
                      {step.instruction}
                      {step.distanceText && (
                        <span className="text-slate-400"> · {step.distanceText}</span>
                      )}
                    </span>
                  ),
                }))}
              />
            )}
          </>
        ) : origin ? (
          <p className="text-sm text-slate-500">No route found for this travel mode.</p>
        ) : null}
      </div>

      <Button
        block
        className="mt-3"
        href={googleMapsDirUrl(origin, hospital.location, travelMode)}
        target="_blank"
        rel="noopener noreferrer"
        icon={<ExternalLink className="h-3.5 w-3.5" />}
      >
        Open in Google Maps
      </Button>
    </div>
  );
}
