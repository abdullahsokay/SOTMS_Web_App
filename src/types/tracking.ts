/** A single GPS point stored in the RTDB trail */
export interface TrailPoint {
  lat: number;
  lng: number;
  speed: number;
  bearing: number;
  timestamp: number;
}

/** Current position data at /tracking/{vehicleId}/current */
export interface VehicleCurrentPosition {
  lat: number;
  lng: number;
  speed: number;
  bearing: number;
  timestamp: number;
  driver?: string;
  vehicleId: string;
}

/** Full tracking state for one vehicle */
export interface VehicleTrackingData {
  vehicleId: string;
  current: VehicleCurrentPosition;
  trail: TrailPoint[];
}

/** Map of vehicleId → tracking data */
export type TrackingStore = Record<string, VehicleTrackingData>;

// ── GPS Path History Types ──────────────────────────────────────

/** Historical GPS point from Firestore gps_history collection */
export interface HistoricalGPSPoint {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  status: 'moving' | 'idle' | 'stopped';
  timestamp: number;
  routeId?: string;
  offline?: boolean;
}

/** Color-coded path segment for rendering */
export interface PathSegment {
  path: Array<{ lat: number; lng: number }>;
  status: 'moving' | 'idle' | 'stopped';
}

/** Stop marker (idle > 5 min) */
export interface StopMarkerData {
  id: string;
  lat: number;
  lng: number;
  duration: number;
  startTime: number;
  endTime: number;
}

/** Path summary statistics */
export interface PathSummary {
  totalDistance: number;
  totalDuration: number;
  avgSpeed: number;
  maxSpeed: number;
  stopCount: number;
  totalStopTime: number;
}

/** Time range options */
export type PathTimeRange = '6h' | '12h' | '24h' | '7d';
