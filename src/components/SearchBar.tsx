'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Input, Select, Tag } from 'antd';
import { Crosshair, MapPin } from 'lucide-react';
import { SERVICE_OPTIONS, type ServiceCategory } from '@/types';
import { readPopularCitiesFromCache, writePopularCitiesToCache } from '@/lib/popularCitiesCache';
import LocationAutocomplete from './LocationAutocomplete';

export interface SearchState {
  mode: 'nearby' | 'name';
  q: string;
  service: ServiceCategory | '';
  radiusKm: number;
}

interface SearchBarProps {
  value: SearchState;
  onChange: (next: SearchState) => void;
  onUseMyLocation: () => void;
  onPickCity: (city: string) => void;
  onSelectPlace: (place: { lat: number; lng: number; label: string }) => void;
  locationLabel: string | null;
  locationStatus: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';
  biasPoint?: { lat: number; lng: number } | null;
  countryCode?: string;
  countryName?: string;
}

const RADIUS_OPTIONS = [2, 5, 8, 15, 25, 40];

export default function SearchBar({
  value,
  onChange,
  onUseMyLocation,
  onPickCity,
  onSelectPlace,
  locationLabel,
  locationStatus,
  biasPoint,
  countryCode,
  countryName,
}: SearchBarProps) {
  const [nameInput, setNameInput] = useState(value.q);
  const [cityInput, setCityInput] = useState('');
  const [popularCities, setPopularCities] = useState<string[]>([]);

  useEffect(() => setNameInput(value.q), [value.q]);

  useEffect(() => {
    if (!countryCode) return;
    const cached = readPopularCitiesFromCache(countryCode);
    if (cached && cached.length) {
      setPopularCities(cached.slice(0, 8));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/popular-cities?countryCode=${countryCode}`);
        const data = await res.json();
        if (cancelled || !Array.isArray(data.cities)) return;
        writePopularCitiesToCache(countryCode, data.cities);
        setPopularCities(data.cities.slice(0, 8));
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  const submitName = (q: string) => {
    const trimmed = q.trim();
    onChange({ ...value, mode: trimmed ? 'name' : 'nearby', q: trimmed });
  };

  const submitCity = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      onPickCity(cityInput.trim());
      setCityInput('');
    }
  };

  const locating = locationStatus === 'locating';

  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-slate-900">Find a hospital</h2>
        {locationLabel && (
          <span className="hidden max-w-[55%] items-center gap-1 truncate text-xs text-slate-500 sm:flex">
            <MapPin className="h-3 w-3 shrink-0 text-primary-blue" />
            <span className="truncate">around {locationLabel}</span>
          </span>
        )}
      </div>

      {/* Location */}
      <form onSubmit={submitCity} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <LocationAutocomplete
          value={cityInput}
          onChange={setCityInput}
          onSelect={(place) => {
            setCityInput('');
            onSelectPlace(place);
          }}
          near={biasPoint}
          placeholder="City, area or address"
          aria-label="Search area"
        />
        <Button
          type="default"
          size="large"
          htmlType="button"
          onClick={onUseMyLocation}
          loading={locating}
          icon={!locating ? <Crosshair className="h-4 w-4" /> : undefined}
          className="shrink-0"
        >
          {locating ? 'Locating' : 'Use my location'}
        </Button>
      </form>

      {locationStatus === 'denied' && !locationLabel && (
        <Alert
          className="mt-2"
          type="warning"
          showIcon
          message="Location access is blocked — search by city or area above."
        />
      )}

      {/* Name search */}
      <Input.Search
        className="mt-3"
        size="large"
        allowClear
        placeholder="Search by hospital name"
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        onSearch={submitName}
        enterButton="Search"
      />

      {/* Filters */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          size="large"
          value={value.service || undefined}
          placeholder="Any medical service"
          allowClear
          onChange={(v) => onChange({ ...value, service: (v as ServiceCategory) ?? '' })}
          options={SERVICE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <Select
          size="large"
          value={value.radiusKm}
          disabled={value.mode === 'name'}
          onChange={(v) => onChange({ ...value, radiusKm: v })}
          options={RADIUS_OPTIONS.map((km) => ({ value: km, label: `Within ${km} km` }))}
        />
      </div>

      {popularCities.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Popular cities{countryName ? ` in ${countryName}` : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {popularCities.map((city) => (
              <Tag
                key={city}
                className="cursor-pointer select-none border-0 px-2.5 py-1 text-xs transition-colors hover:!bg-blue-50 hover:!text-primary-blue"
                onClick={() => onPickCity(countryName ? `${city}, ${countryName}` : city)}
              >
                {city}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
