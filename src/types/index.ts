export interface Tanker {
  id: string;
  name: string;
  status: 'moving' | 'idle' | 'parked' | 'alert' | 'offline';
  speed: number;
  fuelLevel: number;        // calibrated fuel level as a PERCENTAGE (0–100)
  fuelDistanceCm?: number;  // raw ultrasonic distance to fuel surface, in cm (inverse of fuelLevel)
  loadWeight: number;
  driver: string;
  driverContact: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  ignition: 'on' | 'off';
  lastUpdate: string;
  alerts: Alert[];
  route?: string;
  routeDeviation?: boolean;
  temperature?: number;
  altitude?: number;
  satellites?: number;
  fixQuality?: number;
  hdop?: number;
  rssi?: number;
  uptime?: number;
  bearing?: number;
  eta?: {
    distanceRemaining: number; // km
    durationRemaining: number; // minutes
  };
  deviationDistance?: number; // meters off route, 0 if on route
  hatches?: HatchStatus[];
}

export interface HatchStatus {
  id: string;        // e.g. "inlet_1", "inlet_2", "hatch_1"
  label: string;     // e.g. "Inlet 1", "Main Hatch"
  open: boolean;     // true = reed switch triggered (hatch open)
}

export interface NearbyFacility {
  placeId: string;
  name: string;
  type: string;
  location: { lat: number; lng: number };
  rating?: number;
  isOpen?: boolean;
  distance?: number; // meters from tanker
  photoReference?: string; // Photo URL from Places API
  address?: string;
  phone?: string;
}

export interface Alert {
  id: string;
  tankerId: string;
  type: 'critical' | 'warning' | 'safe';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface SensorData {
  temperature: number;
  vibration: number;
  gasLevel: number;
}

export interface Report {
  id: string;
  tankerId: string;
  type: string;
  date: string;
  duration: string;
  details: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface Route {
  id: string;
  name: string;
  company: 'PSO' | 'Attock' | 'Shell' | 'Hascol';
  startLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  endLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  waypoints: Array<{
    lat: number;
    lng: number;
    name?: string;
    type: 'waypoint' | 'stop' | 'delivery';
  }>;
  assignedTanker?: string;
  assignedDriver?: string;
  assignedDriverContact?: string;
  status: 'active' | 'not-started' | 'completed' | 'unassigned';
  geofenceRadius: number; // in meters
  routeType: 'delivery' | 'return' | 'mixed';
  distance: number; // in km
  estimatedDuration: number; // in minutes
  blackSpots: string[]; // array of black spot IDs
  createdAt: string;
  lastUsed?: string;
  routePath?: Array<{ lat: number; lng: number }>; // road-following path from Directions API
  description?: string;
}

export interface BlackSpot {
  id: string;
  name: string;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  threatLevel: 'low' | 'medium' | 'high';
  confidenceLevel: 'low' | 'medium' | 'high';
  createdAt: string;
  notes?: string;
}

export type GeofenceType = 'restricted_zone' | 'safe_zone' | 'checkpoint' | 'depot' | 'delivery_zone';
export type GeofenceAlertOn = 'entry' | 'exit' | 'both';

export interface Geofence {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radius: number; // meters
  type: GeofenceType;
  alertOn: GeofenceAlertOn;
  color: string;
  active: boolean;
  createdAt: string;
  notes?: string;
}

export interface CoPilot {
  coPilotId: string;
  fullName: string;
  phone: string;
  cnic: string;
  address?: string;
  addedAt: string;
}

export interface DriverInsurance {
  insured: boolean;
  company?: string;
  policyNumber?: string;
  expiry?: string;
}

export interface DriverStats {
  totalTrips: number;
  totalDistance: number;
  safetyScore: number;
  lastAssignment: string | null;
}

export interface Driver {
  id: string;
  driverId: string;
  fullName: string;
  address: string;
  phone: string;
  cnic: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: 'active' | 'inactive' | 'suspended';
  insurance: DriverInsurance | null;
  coPilots: CoPilot[];
  createdAt: string;
  updatedAt: string;
  stats: DriverStats;
}