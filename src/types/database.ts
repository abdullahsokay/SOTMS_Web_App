import { Timestamp } from 'firebase/firestore';

// ──────────────────────────────────────────────
// Utility Types
// ──────────────────────────────────────────────

/** Firestore document with auto-generated ID */
export type WithId<T> = T & { id: string };

/** Timestamp that can be either a Firestore Timestamp or ISO string */
export type FirestoreTimestamp = Timestamp | string;

/** GPS coordinates */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Type-safe service response (discriminated union) */
export interface ServiceResult<T> {
  data: T;
  error: null;
}

export interface ServiceError {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type ServiceResponse<T> = ServiceResult<T> | ServiceError;

/** Composable Firestore query options */
export interface QueryFilter {
  field: string;
  operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in';
  value: unknown;
}

export interface QueryOptions {
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: QueryFilter[];
  limitCount?: number;
}

// ──────────────────────────────────────────────
// NEW COLLECTION: tankers/
// ──────────────────────────────────────────────

export type TankerStatus = 'active' | 'inactive' | 'maintenance' | 'decommissioned';

export interface TankerDoc {
  registrationNo: string;
  name: string;
  capacity: number;
  deviceId: string | null;
  driverId: string | null;
  currentStatus: TankerStatus;
  assignedRoute: string | null;
  make: string;
  model: string;
  year: number;
  lastMaintenanceDate: FirestoreTimestamp | null;
  nextMaintenanceDate: FirestoreTimestamp | null;
  insuranceExpiry: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ──────────────────────────────────────────────
// NEW COLLECTION: devices/
// ──────────────────────────────────────────────

export type DeviceType =
  | 'ESP32'
  | 'RaspberryPi4'
  | 'GPS_MODULE'
  | 'FUEL_SENSOR'
  | 'TEMPERATURE_SENSOR'
  | 'WEIGHT_SENSOR'
  | 'DOOR_SENSOR'
  | 'TILT_SENSOR'
  | 'REED_SWITCH';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'maintenance';

export interface DeviceDoc {
  deviceName: string;
  deviceType: DeviceType;
  firmwareVersion: string;
  tankerId: string | null;
  status: DeviceStatus;
  lastSeen: FirestoreTimestamp;
  batteryLevel: number;
  signalStrength: number;
  ipAddress: string | null;
  macAddress: string | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ──────────────────────────────────────────────
// NEW COLLECTION: sensorReadings/
// ──────────────────────────────────────────────

export interface SensorReadingGPS {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
}

export interface SensorReadingDoc {
  deviceId: string;
  tankerId: string;
  timestamp: FirestoreTimestamp;
  gps: SensorReadingGPS;
  fuelLevel: number;
  temperature: number;
  weight: number;
  speed: number;
  doorStatus: 'open' | 'closed';
  tiltAngle: number;
}

// ──────────────────────────────────────────────
// NEW COLLECTION: trips/
// ──────────────────────────────────────────────

export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'delayed';

export interface TripFuelLevels {
  start: number;
  end: number | null;
  consumed: number | null;
}

export interface TripDeviation {
  timestamp: FirestoreTimestamp;
  location: GeoPoint;
  distanceFromRoute: number;
  duration: number;
}

export interface TripDoc {
  tankerId: string;
  driverId: string;
  routeId: string;
  startTime: FirestoreTimestamp;
  endTime: FirestoreTimestamp | null;
  status: TripStatus;
  fuelLevels: TripFuelLevels;
  distanceCovered: number;
  routeDeviations: number;
  deviations: TripDeviation[];
  incidents: string[];
  notes: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ──────────────────────────────────────────────
// NEW COLLECTION: incidents/
// ──────────────────────────────────────────────

export type IncidentType =
  | 'fuel_theft'
  | 'route_deviation'
  | 'over_speed'
  | 'unauthorized_stop'
  | 'door_open'
  | 'temperature_anomaly'
  | 'tilt_warning'
  | 'geofence_breach'
  | 'hatch_open_unauthorized'
  | 'accident'
  | 'leak'
  | 'fire'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'reported' | 'investigating' | 'resolved' | 'closed';

export interface IncidentNote {
  author: string;
  content: string;
  timestamp: FirestoreTimestamp;
}

export interface IncidentDoc {
  tankerId: string;
  tripId: string | null;
  alertId: string | null;
  incidentType: IncidentType;
  description: string;
  severity: IncidentSeverity;
  location: GeoPoint | null;
  timestamp: FirestoreTimestamp;
  responseTime: number | null;
  status: IncidentStatus;
  assignedTo: string | null;
  notes: IncidentNote[];
  resolvedAt: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ──────────────────────────────────────────────
// NEW DOCUMENT: systemConfig/settings
// ──────────────────────────────────────────────

export interface FuelTheftThresholds {
  dropPercentage: number;
  dropTimeWindowSeconds: number;
}

export interface TemperatureThresholds {
  minSafe: number;
  maxSafe: number;
  criticalMax: number;
}

export interface RouteDeviationThresholds {
  warningDistanceMeters: number;
  criticalDistanceMeters: number;
  maxStopDurationSeconds: number;
}

export interface DataSyncConfig {
  sensorReadingIntervalMs: number;
  rtdbUpdateIntervalMs: number;
  gpsHistoryRetentionDays: number;
}

export interface SystemConfigDoc {
  fuelTheft: FuelTheftThresholds;
  temperature: TemperatureThresholds;
  routeDeviation: RouteDeviationThresholds;
  dataSync: DataSyncConfig;
  alertRetentionDays: number;
  maxActiveTripsPerTanker: number;
  updatedAt: FirestoreTimestamp;
  updatedBy: string;
}

// ──────────────────────────────────────────────
// ENHANCED EXISTING: users/ (additive fields)
// ──────────────────────────────────────────────

export type UserRole = 'admin' | 'fleet_manager' | 'driver' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface EnhancedUserFields {
  role: UserRole;
  status: UserStatus;
  lastLogin: FirestoreTimestamp | null;
  permissions: string[];
}

// ──────────────────────────────────────────────
// ENHANCED EXISTING: alerts/ (additive fields)
// ──────────────────────────────────────────────

export interface EnhancedAlertFields {
  severity: 'critical' | 'warning' | 'info';
  isAcknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: FirestoreTimestamp | null;
  resolved: boolean;
  resolvedAt: FirestoreTimestamp | null;
  resolvedBy: string | null;
}

// ──────────────────────────────────────────────
// RTDB Enhanced Structure Types
// ──────────────────────────────────────────────

export interface RTDBDeviceGPS {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
}

export interface RTDBDeviceSensors {
  fuelLevel: number;
  temperature: number;
  weight: number;
  doorOpen: boolean;
  tilt: number;
}

export interface RTDBDeviceStatus {
  online: boolean;
  battery: number;
  signal: number;
}

export interface RTDBRealtimeData {
  tankerId: string;
  lastUpdate: number;
  gps: RTDBDeviceGPS;
  sensors: RTDBDeviceSensors;
  status: RTDBDeviceStatus;
}

export interface RTDBActiveAlert {
  count: number;
  latestAlertId: string | null;
  latestType: string | null;
  latestSeverity: string | null;
  lastUpdated: number;
}
