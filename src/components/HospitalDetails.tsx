'use client';

import { Button, Descriptions, Drawer, Tag } from 'antd';
import { Clock, Globe, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import type { DirectionsSummary, Hospital, LatLng, TravelMode } from '@/types';
import { SERVICE_OPTIONS } from '@/types';
import { formatDistanceKm } from '@/lib/geo';
import DirectionsPanel from './DirectionsPanel';

interface HospitalDetailsProps {
  hospital: Hospital | null;
  open: boolean;
  onClose: () => void;
  origin: LatLng | null;
  routeActive: boolean;
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  directionsSummary: DirectionsSummary | null;
  directionsLoading: boolean;
  directionsError: string | null;
  onStartDirections: () => void;
  onClearDirections: () => void;
}

const serviceLabel = (value: string) =>
  SERVICE_OPTIONS.find((s) => s.value === value)?.label ?? value;

const normaliseUrl = (url: string) => (url.startsWith('http') ? url : `https://${url}`);

export default function HospitalDetails({
  hospital,
  open,
  onClose,
  origin,
  routeActive,
  travelMode,
  onTravelModeChange,
  directionsSummary,
  directionsLoading,
  directionsError,
  onStartDirections,
  onClearDirections,
}: HospitalDetailsProps) {
  const mapsUrl = hospital
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        hospital.address || `${hospital.location.lat},${hospital.location.lng}`,
      )}`
    : '#';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={drawerWidth()}
      title={
        hospital ? (
          <div className="pr-6">
            <p className="truncate text-[15px] font-semibold text-slate-900">{hospital.name}</p>
            <p className="mt-0.5 text-xs font-normal text-slate-400">
              <span className="capitalize">{hospital.types[0] ?? 'healthcare facility'}</span>
              {typeof hospital.distanceKm === 'number' && ` · ${formatDistanceKm(hospital.distanceKm)} away`}
            </p>
          </div>
        ) : (
          'Hospital'
        )
      }
    >
      {hospital && (
        <>
          <Descriptions
            column={1}
            size="small"
            colon={false}
            styles={{ label: { width: 84, color: '#64748b' } }}
          >
            <Descriptions.Item label={<IconLabel icon={<MapPin className="h-3.5 w-3.5" />}>Address</IconLabel>}>
              {hospital.address || hospital.vicinity ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary-blue">
                  {hospital.address || hospital.vicinity}
                </a>
              ) : (
                <span className="text-slate-400">Not listed</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={<IconLabel icon={<Phone className="h-3.5 w-3.5" />}>Phone</IconLabel>}>
              {hospital.phone ? (
                <a href={`tel:${hospital.phone}`} className="text-primary-blue">
                  {hospital.phone}
                </a>
              ) : (
                <span className="text-slate-400">Not listed</span>
              )}
            </Descriptions.Item>
            {hospital.email && (
              <Descriptions.Item label={<IconLabel icon={<Mail className="h-3.5 w-3.5" />}>Email</IconLabel>}>
                <a href={`mailto:${hospital.email}`} className="break-all text-primary-blue">
                  {hospital.email}
                </a>
              </Descriptions.Item>
            )}
            {hospital.website && (
              <Descriptions.Item label={<IconLabel icon={<Globe className="h-3.5 w-3.5" />}>Website</IconLabel>}>
                <a
                  href={normaliseUrl(hospital.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary-blue"
                >
                  {hospital.website}
                </a>
              </Descriptions.Item>
            )}
            <Descriptions.Item label={<IconLabel icon={<Clock className="h-3.5 w-3.5" />}>Hours</IconLabel>}>
              <span className="text-slate-700">{hospital.openingHours ?? 'Not listed'}</span>
              {hospital.openNow === true && <Tag className="ml-2" color="green">Open now</Tag>}
              {hospital.openNow === false && <Tag className="ml-2" color="red">Closed</Tag>}
            </Descriptions.Item>
          </Descriptions>

          <div className="mt-4">
            <p className="mb-2 text-[13px] font-semibold text-slate-900">Services</p>
            {hospital.services.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {hospital.services.map((s) => (
                  <Tag key={s} bordered={false}>
                    {serviceLabel(s)}
                  </Tag>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-slate-400">No specific services tagged for this facility.</p>
            )}
          </div>

          {!routeActive ? (
            <Button
              type="primary"
              block
              size="large"
              className="mt-5"
              icon={<Navigation className="h-4 w-4" />}
              onClick={onStartDirections}
            >
              Get directions
            </Button>
          ) : (
            <DirectionsPanel
              hospital={hospital}
              origin={origin}
              travelMode={travelMode}
              onTravelModeChange={onTravelModeChange}
              summary={directionsSummary}
              loading={directionsLoading}
              error={directionsError}
              onClear={onClearDirections}
            />
          )}
        </>
      )}
    </Drawer>
  );
}

function IconLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      {icon}
      {children}
    </span>
  );
}

/** Full-width drawer on phones, fixed panel on larger screens. */
function drawerWidth(): number | string {
  if (typeof window !== 'undefined' && window.innerWidth < 480) return '100%';
  return 420;
}
