'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Clock, MapPin, Navigation, Phone } from 'lucide-react';
import { message } from 'antd';
import { SignInButton, SignedIn, SignedOut, useAuth } from '@clerk/nextjs';
import type { Hospital } from '@/types';
import { SERVICE_OPTIONS } from '@/types';
import { formatDistanceKm } from '@/lib/geo';
import { deleteBookmark, listBookmarks, saveBookmarkFromHospital } from '@/lib/bookmarks';

interface HospitalCardProps {
  hospital: Hospital;
  active?: boolean;
  savedInitially?: boolean;
  onSelect?: (hospital: Hospital) => void;
  onViewDetails?: (hospital: Hospital) => void;
  onDirections?: (hospital: Hospital) => void;
  onUnsave?: (id: string) => void;
}

const serviceLabel = (value: string) =>
  SERVICE_OPTIONS.find((s) => s.value === value)?.label ?? value;

export default function HospitalCard({
  hospital,
  active,
  savedInitially,
  onSelect,
  onViewDetails,
  onDirections,
  onUnsave,
}: HospitalCardProps) {
  const { isSignedIn } = useAuth();
  const [isSaved, setIsSaved] = useState(Boolean(savedInitially));
  const [busy, setBusy] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Controlled mode: parent supplies saved state, keep local state in sync.
  useEffect(() => {
    if (savedInitially !== undefined) setIsSaved(savedInitially);
  }, [savedInitially]);

  // Uncontrolled mode: the card looks up its own saved state.
  useEffect(() => {
    if (savedInitially !== undefined) return;
    let mounted = true;
    (async () => {
      if (!isSignedIn) return;
      try {
        const bookmarks = await listBookmarks();
        if (mounted) setIsSaved(bookmarks.some((b) => b.placeId === hospital.id));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hospital.id, isSignedIn, savedInitially]);

  const toggleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isSaved) {
        await deleteBookmark(hospital.id);
        setIsSaved(false);
        onUnsave?.(hospital.id);
        messageApi.success('Removed from saved hospitals', 1.5);
      } else {
        await saveBookmarkFromHospital(hospital);
        setIsSaved(true);
        messageApi.success('Saved', 1.5);
      }
    } catch {
      messageApi.error('Could not update saved hospitals', 2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(hospital)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(hospital);
        }
      }}
      className={`bg-white rounded-xl p-4 transition-all cursor-pointer hospital-shadow border ${
        active
          ? 'border-primary-blue ring-1 ring-primary-blue'
          : 'border-[var(--color-accent)] hover:border-primary-blue'
      }`}
    >
      {contextHolder}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2" title={hospital.name}>
            {hospital.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {hospital.types[0] ?? 'healthcare facility'}
          </p>
        </div>
        <SignedIn>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSave();
            }}
            disabled={busy}
            aria-label={isSaved ? 'Remove from saved hospitals' : 'Save hospital'}
            className="p-2 rounded-lg medical-border hover:bg-hospital-gray flex-shrink-0"
          >
            {isSaved ? (
              <BookmarkCheck className="w-4 h-4 text-primary-blue" />
            ) : (
              <Bookmark className="w-4 h-4 text-primary-blue" />
            )}
          </button>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button
              onClick={(e) => e.stopPropagation()}
              aria-label="Sign in to save"
              className="p-2 rounded-lg medical-border hover:bg-hospital-gray flex-shrink-0"
            >
              <Bookmark className="w-4 h-4 text-primary-blue" />
            </button>
          </SignInButton>
        </SignedOut>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-gray-600">
        {(hospital.address || hospital.vicinity) && (
          <p className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-primary-blue flex-shrink-0" />
            <span className="line-clamp-2">{hospital.address || hospital.vicinity}</span>
          </p>
        )}
        {hospital.phone && (
          <p className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary-blue flex-shrink-0" />
            <span>{hospital.phone}</span>
          </p>
        )}
        {hospital.openingHours && (
          <p className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-blue flex-shrink-0" />
            <span>
              {hospital.openNow === true && <span className="text-green-600 font-medium">Open now</span>}
              {hospital.openNow === false && <span className="text-red-500 font-medium">Closed</span>}
              {hospital.openNow === undefined && <span>{hospital.openingHours}</span>}
            </span>
          </p>
        )}
      </div>

      {hospital.services.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hospital.services.slice(0, 4).map((s) => (
            <span key={s} className="chip">
              {serviceLabel(s)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-gray-500">
          {typeof hospital.distanceKm === 'number' ? `${formatDistanceKm(hospital.distanceKm)} away` : ''}
        </div>
        <div className="flex gap-2">
          {onViewDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(hospital);
              }}
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              Details
            </button>
          )}
          {onDirections && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDirections(hospital);
              }}
              className="btn-primary !py-1.5 !px-3 text-xs"
            >
              <Navigation className="w-3.5 h-3.5" />
              Directions
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
