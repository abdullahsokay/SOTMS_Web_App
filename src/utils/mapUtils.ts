// Shared map utilities — single source of truth for getMarkerIcon, darkMapStyle, etc.
// Extracted from MapView.tsx, MapWidget.tsx, RouteMapView.tsx to eliminate duplication.

export const STATUS_COLORS: Record<string, string> = {
  moving: '#28B463',
  idle: '#FFB02E',
  alert: '#FF4D4D',
  offline: '#6B7280',
  default: '#9CA3AF',
};

// Google Maps dark theme styles
export const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

export const containerStyle = { width: '100%', height: '100%' };

export const defaultCenter = { lat: 30.3753, lng: 69.3451 };

// Base64-encoded tanker.png (from src/assets/tanker.png) for embedding in SVG markers
const TANKER_PNG_B64 = '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';

// Tanker marker icon based on status and bearing
// Uses the custom tanker.png silhouette rendered white on a status-colored circle
// bearing: 0=North, 90=East, 180=South, 270=West
// The tanker PNG faces right (east), so rotation = bearing - 90
export function getMarkerIcon(status: string, bearing: number = 0): string {
  const color = STATUS_COLORS[status] || STATUS_COLORS.default;

  const offlineLine = status === 'offline'
    ? '<line x1="10" y1="10" x2="38" y2="38" stroke="#FF4D4D" stroke-width="3" stroke-linecap="round"/>' : '';

  const rotation = bearing - 90;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="48" height="48" viewBox="0 0 48 48">
      <defs>
        <filter id="truckGlow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="toWhite">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>
        </filter>
      </defs>
      <circle cx="24" cy="24" r="20" fill="${color}" stroke="white" stroke-width="2" filter="url(#truckGlow)"/>
      <g transform="rotate(${rotation}, 24, 24)">
        <image href="data:image/png;base64,${TANKER_PNG_B64}" x="6" y="6" width="36" height="36" filter="url(#toWhite)"/>
      </g>
      ${offlineLine}
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Relative time helper
export function getRelativeTime(timestamp: string | number): string {
  const now = Date.now();
  const then = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(then)) return 'Unknown';
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

// RTDB tracking status: uses user-specified thresholds
// >5 km/h = moving, 0.5-5 = idle, <0.5 = stopped (alert), stale >120s = offline
export function getTrackingStatus(speed: number, lastUpdateMs: number): string {
  const isStale = lastUpdateMs > 0 && (Date.now() - lastUpdateMs) > 120000;
  if (isStale) return 'offline';
  if (speed > 5) return 'moving';
  if (speed >= 0.5) return 'idle';
  return 'alert'; // stopped — maps to red via getMarkerIcon
}
