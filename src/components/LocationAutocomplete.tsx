'use client';

import { useMemo, useRef, useState } from 'react';
import { AutoComplete } from 'antd';
import { MapPin } from 'lucide-react';
import type { PlaceSuggestion } from '@/types';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  near?: { lat: number; lng: number } | null;
  placeholder?: string;
  size?: 'middle' | 'large';
  'aria-label'?: string;
}

/**
 * antd AutoComplete backed by `/api/autocomplete` (Photon — free, key-less).
 * Debounced; typing plain text still works via the parent's geocode-on-submit.
 */
export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  near,
  placeholder,
  size = 'large',
  'aria-label': ariaLabel,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  const runSearch = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();
    if (q.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const ac = new AbortController();
      controller.current = ac;
      try {
        const params = new URLSearchParams({ q: q.trim() });
        if (near) {
          params.set('lat', String(near.lat));
          params.set('lng', String(near.lng));
        }
        const res = await fetch(`/api/autocomplete?${params}`, { signal: ac.signal });
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        /* aborted / offline */
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const options = useMemo(
    () =>
      // De-dupe labels so each option value is unique.
      Array.from(new Map(suggestions.map((s) => [s.label, s])).values()).map((s) => ({
        value: s.label,
        label: (
          <span className="flex items-start gap-2 py-0.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-sm text-slate-700">{s.label}</span>
          </span>
        ),
      })),
    [suggestions],
  );

  return (
    <AutoComplete
      value={value}
      options={options}
      style={{ width: '100%' }}
      size={size}
      allowClear
      backfill={false}
      filterOption={false}
      notFoundContent={loading ? 'Searching…' : null}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onSearch={runSearch}
      onChange={(v) => onChange(typeof v === 'string' ? v : '')}
      onSelect={(v: string) => {
        const picked = suggestions.find((s) => s.label === v);
        if (picked) onSelect(picked);
      }}
    />
  );
}
