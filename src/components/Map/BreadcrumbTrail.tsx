import { memo } from 'react';
import { Polyline } from '@react-google-maps/api';
import { TrailPoint } from '../../types/tracking';
import { STATUS_COLORS } from '../../utils/mapUtils';

interface BreadcrumbTrailProps {
  trail: TrailPoint[];
  status: string;
}

export const BreadcrumbTrail = memo(function BreadcrumbTrail({ trail, status }: BreadcrumbTrailProps) {
  if (trail.length < 2) return null;

  const color = STATUS_COLORS[status] || STATUS_COLORS.default;
  const path = trail.map(p => ({ lat: p.lat, lng: p.lng }));

  return (
    <Polyline
      path={path}
      options={{
        strokeOpacity: 0,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillOpacity: 0.7,
              fillColor: color,
              strokeOpacity: 0,
              scale: 3,
            },
            offset: '0',
            repeat: '12px',
          },
        ],
      }}
    />
  );
});
