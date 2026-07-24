import { memo } from 'react';
import { Polyline, Marker, OverlayView } from '@react-google-maps/api';
import { Route } from '../../types';

interface AssignedRouteOverlayProps {
  route: Route;
}

function makeCircleMarker(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" fill="${color}" stroke="white" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const AssignedRouteOverlay = memo(function AssignedRouteOverlay({
  route,
}: AssignedRouteOverlayProps) {
  const path =
    route.routePath && route.routePath.length > 0
      ? route.routePath
      : [
          { lat: route.startLocation.lat, lng: route.startLocation.lng },
          ...(route.waypoints ?? []).map((wp) => ({ lat: wp.lat, lng: wp.lng })),
          { lat: route.endLocation.lat, lng: route.endLocation.lng },
        ];

  if (path.length < 2) return null;

  return (
    <>
      {/* Dashed route polyline */}
      <Polyline
        path={path}
        options={{
          strokeColor: '#009FFD',
          strokeOpacity: 0,
          strokeWeight: 4,
          zIndex: 700,
          icons: [
            {
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 0.8,
                strokeColor: '#009FFD',
                scale: 3,
              },
              offset: '0',
              repeat: '15px',
            },
          ],
        }}
      />

      {/* Start marker */}
      <Marker
        position={{ lat: route.startLocation.lat, lng: route.startLocation.lng }}
        label={{
          text: 'S',
          color: '#FFFFFF',
          fontSize: '10px',
          fontWeight: 'bold',
        }}
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#28B463',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        }}
        title={`Start: ${route.startLocation.address}`}
        zIndex={750}
      />

      {/* End/destination marker */}
      <Marker
        position={{ lat: route.endLocation.lat, lng: route.endLocation.lng }}
        label={{
          text: 'D',
          color: '#FFFFFF',
          fontSize: '10px',
          fontWeight: 'bold',
        }}
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#FF4D4D',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        }}
        title={`Destination: ${route.endLocation.address}`}
        zIndex={750}
      />

      {/* Waypoint markers */}
      {(route.waypoints ?? []).map((wp, i) => {
        const wpColor =
          wp.type === 'delivery'
            ? '#FFB02E'
            : wp.type === 'stop'
              ? '#9B59B6'
              : '#00E5FF';
        return (
          <Marker
            key={`assigned-wp-${i}`}
            position={{ lat: wp.lat, lng: wp.lng }}
            icon={{
              url: makeCircleMarker(wpColor),
              scaledSize: new google.maps.Size(14, 14),
              anchor: new google.maps.Point(7, 7),
            }}
            title={wp.name || `Waypoint ${i + 1}`}
            zIndex={740}
          />
        );
      })}

      {/* Route info label at start */}
      <OverlayView
        position={{ lat: route.startLocation.lat, lng: route.startLocation.lng }}
        mapPaneName="floatPane"
        getPixelPositionOffset={(w) => ({ x: -(w / 2), y: -40 })}
      >
        <div className="bg-[#0C1E2C]/90 border border-[#009FFD]/50 rounded-lg px-3 py-1.5 pointer-events-none whitespace-nowrap shadow-lg">
          <div className="text-[10px] text-[#009FFD] font-mono font-bold">
            {route.name}
          </div>
          <div className="text-[9px] text-[#D9DCE1]/60 font-mono">
            {route.distance} km &bull; ~{Math.floor(route.estimatedDuration / 60)}h{' '}
            {route.estimatedDuration % 60}m
          </div>
        </div>
      </OverlayView>
    </>
  );
});
