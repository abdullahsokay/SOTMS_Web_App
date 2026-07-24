/**
 * functions/src/config.ts
 *
 * Server-side mirror of the app's monitoring constants and pure helpers.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  IMPORTANT — THESE VALUES ARE DUPLICATED FROM THE REACT APP ON PURPOSE.│
 * │  Keep them in sync with:                                               │
 * │    - src/config/constants.ts   (thresholds, PAKISTAN_BOUNDS)           │
 * │    - src/utils/fuelCalc.ts      (DEFAULT_CALIBRATION, distanceToFuel…) │
 * │    - src/utils/geo.ts           (getDistanceFromLatLonInKm, getTime)   │
 * │    - src/contexts/GPSContext.tsx (AUTHORIZED_ZONES, parseHatches,      │
 * │                                   getFuelLevelCm, isInAuthorizedZone)  │
 * │                                                                        │
 * │  The Cloud Functions runtime cannot import the browser `src/` tree     │
 * │  (different tsconfig / module system / React deps), so the logic is    │
 * │  copied verbatim here. A shared workspace package that both the app    │
 * │  and functions consume is the correct long-term fix — future work.     │
 * └───────────────────────────────────────────────────────────────────────┘
 */

// ─────────────────────────────────────────────────────────────────────────
//  Thresholds  (mirror of src/config/constants.ts)
// ─────────────────────────────────────────────────────────────────────────

/** No fresh ESP data within this window => device considered offline (ms). */
export const OFFLINE_THRESHOLD_MS = 15_000;

/** Speed above which a tanker is flagged for overspeeding (km/h). */
export const OVERSPEED_LIMIT_KMH = 80;

/** Calculated speeds above this are treated as GPS noise and discarded (km/h). */
export const SPEED_SANITY_CAP_KMH = 150;

/** Speed at/below which a tanker is treated as idle rather than moving (km/h). */
export const MOVING_SPEED_THRESHOLD_KMH = 2;

/** Approximate lat/lng bounding box of Pakistan, used to reject out-of-region GPS. */
export const PAKISTAN_BOUNDS = {
  north: 37.5,
  south: 23,
  east: 78,
  west: 60,
} as const;

// ─────────────────────────────────────────────────────────────────────────
//  Server-only tuning (not present in the app)
// ─────────────────────────────────────────────────────────────────────────

/** How long Firestore `sensorReadings` history is retained before pruning (days). */
export const HISTORY_RETENTION_DAYS = 30;

/**
 * Alert de-duplication bucket (ms). Deterministic alert doc IDs embed
 * `Math.floor(now / ALERT_DEDUP_BUCKET_MS)` so that repeated Cloud Function
 * triggers within the same window resolve to the SAME document id and are
 * therefore idempotent (created once, never duplicated).
 */
export const ALERT_DEDUP_BUCKET_MS = 10 * 60 * 1000; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────
//  Fuel calibration  (mirror of src/utils/fuelCalc.ts)
// ─────────────────────────────────────────────────────────────────────────

export interface TankCalibration {
  /** Sensor reading (cm) when the tank is full — surface near the sensor. */
  fullDistanceCm: number;
  /** Sensor reading (cm) when the tank is empty — surface at the tank floor. */
  emptyDistanceCm: number;
}

/**
 * Default calibration — PLACEHOLDER values matching the app's crude 100cm
 * tank-height assumption. MUST be replaced with real per-tank field
 * calibration before production use. (Mirrors DEFAULT_CALIBRATION.)
 */
export const DEFAULT_CALIBRATION: TankCalibration = {
  fullDistanceCm: 0,
  emptyDistanceCm: 100,
};

/**
 * Convert a raw ultrasonic distance (cm) to fuel percentage (0–100).
 * Distance is inversely proportional to fill level: small distance = full tank.
 * Clamped to [0, 100], rounded; returns 0 for non-finite input / invalid span.
 * (Verbatim from src/utils/fuelCalc.ts `distanceToFuelPercent`.)
 */
export function distanceToFuelPercent(
  distanceCm: number,
  cal: TankCalibration = DEFAULT_CALIBRATION,
): number {
  const span = cal.emptyDistanceCm - cal.fullDistanceCm;
  if (!Number.isFinite(distanceCm) || span <= 0) return 0;
  const pct = ((cal.emptyDistanceCm - distanceCm) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// ─────────────────────────────────────────────────────────────────────────
//  Authorized zones  (mirror of GPSContext.tsx AUTHORIZED_ZONES)
// ─────────────────────────────────────────────────────────────────────────

export interface AuthorizedZone {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

/**
 * Depots and major oil terminals in Pakistan where hatches are ALLOWED to be
 * opened. A hatch opening OUTSIDE every one of these zones is a critical event.
 * (Verbatim from GPSContext.tsx.)
 */
export const AUTHORIZED_ZONES: AuthorizedZone[] = [
  { name: 'Karachi Port Terminal', lat: 24.8465, lng: 67.0098, radiusKm: 1.5 },
  { name: 'Karachi Refinery', lat: 24.82, lng: 66.99, radiusKm: 1.0 },
  { name: 'Mahmood Kot Terminal', lat: 29.56, lng: 70.72, radiusKm: 1.0 },
  { name: 'Machike Terminal', lat: 31.63, lng: 74.06, radiusKm: 1.0 },
  { name: 'Shikarpur Terminal', lat: 27.95, lng: 68.65, radiusKm: 1.0 },
  { name: 'Faisalabad Depot', lat: 31.4187, lng: 73.0791, radiusKm: 0.8 },
  { name: 'Lahore Depot', lat: 31.5204, lng: 74.3587, radiusKm: 0.8 },
  { name: 'Islamabad Depot', lat: 33.6844, lng: 73.0479, radiusKm: 0.8 },
  { name: 'Rawalpindi Depot', lat: 33.5651, lng: 73.0169, radiusKm: 0.8 },
  { name: 'Multan Depot', lat: 30.1575, lng: 71.5249, radiusKm: 0.8 },
];

// ─────────────────────────────────────────────────────────────────────────
//  Geo math  (mirror of src/utils/geo.ts)
// ─────────────────────────────────────────────────────────────────────────

/** Convert degrees to radians. */
export function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Great-circle (Haversine) distance between two lat/lon points (km).
 * (Verbatim from src/utils/geo.ts.)
 */
export function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Robust timestamp → epoch-ms parser.
 * Handles epoch seconds, epoch ms, ISO strings, and Firebase Timestamps.
 * Numbers below 1e11 are treated as epoch-seconds and scaled to ms.
 * (Verbatim from src/utils/geo.ts `getTime`.)
 */
export function getTime(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') {
    if (val > 0 && val < 1e11) return val * 1000; // seconds → ms
    return val; // already ms
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof val === 'string') {
    const date = new Date(val);
    return !isNaN(date.getTime()) ? date.getTime() : 0;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────
//  Domain helpers  (mirror of GPSContext.tsx)
// ─────────────────────────────────────────────────────────────────────────

/** Shape of the `latest` node each ESP writes under devices/<id>/latest. */
export interface EspLatestData {
  distance_cm?: number;
  ultrasonic?: Record<string, number>;
  gps?: {
    latitude?: number;
    longitude?: number;
    satellites?: number;
    status?: string;
  };
  rssi?: number;
  timestamp?: string | number;
  uptime_ms?: number;
  temperature_c?: number;
  reed?: Record<string, boolean | number>;
  hatches?: Record<string, boolean | number>;
  [key: string]: unknown;
}

/** Dynamic device→tanker mapping stored at /config/deviceTankerMap/{deviceId}. */
export interface DeviceTankerMapping {
  tankerId: string;
  tankerName: string;
  driver?: string;
}

export interface HatchStatus {
  id: string;
  label: string;
  open: boolean;
}

/**
 * Extract primary fuel level (cm) from ESP data. ESP sends 3 ultrasonic
 * sensors — sensor_1 is the fuel level; falls back to distance_cm.
 * (Verbatim logic from GPSContext.tsx `getFuelLevelCm`.)
 */
export function getFuelLevelCm(data: EspLatestData): number {
  if (data.ultrasonic && typeof data.ultrasonic === 'object') {
    const s1 = data.ultrasonic.sensor_1;
    if (typeof s1 === 'number' && s1 >= 0) return s1;
    for (const val of Object.values(data.ultrasonic)) {
      if (typeof val === 'number' && val >= 0) return val;
    }
  }
  return typeof data.distance_cm === 'number' ? data.distance_cm : 0;
}

/**
 * Check if a position is within ANY authorized zone.
 * (Verbatim logic from GPSContext.tsx `isInAuthorizedZone`.)
 */
export function isInAuthorizedZone(
  lat: number,
  lng: number,
): { authorized: boolean; nearestZone?: string } {
  for (const zone of AUTHORIZED_ZONES) {
    const dist = getDistanceFromLatLonInKm(lat, lng, zone.lat, zone.lng);
    if (dist <= zone.radiusKm) {
      return { authorized: true, nearestZone: zone.name };
    }
  }
  return { authorized: false };
}

/**
 * Is a coordinate inside the Pakistan bounding box (and not the 0,0 junk fix)?
 * Mirrors the GPSContext `lat < 23 || lat > 37 || lng < 60 || lng > 78` filter,
 * using PAKISTAN_BOUNDS as the single source of truth.
 */
export function isWithinPakistan(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return (
    lat >= PAKISTAN_BOUNDS.south &&
    lat <= PAKISTAN_BOUNDS.north &&
    lng >= PAKISTAN_BOUNDS.west &&
    lng <= PAKISTAN_BOUNDS.east
  );
}

/**
 * Parse hatches/reed switches from ESP data. Handles nested objects
 * (hatches/reed/reed_switch/hatch) and flat fields (hatch1, reed_2, …).
 * Convention: reed value true/1 => CLOSED (magnet present); false/0 => OPEN.
 * (Verbatim logic from GPSContext.tsx `parseHatches`.)
 */
export function parseHatches(data: EspLatestData): HatchStatus[] {
  const results: HatchStatus[] = [];
  const seen = new Set<string>();

  function addHatch(id: string, open: boolean): void {
    if (seen.has(id)) return;
    seen.add(id);
    const num = id.match(/(\d+)/)?.[1] || id;
    results.push({ id, label: `Hatch ${num}`, open: Boolean(open) });
  }

  // 1. Nested objects
  for (const key of ['hatches', 'reed', 'reed_switch', 'hatch']) {
    const nested = data[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const [subKey, val] of Object.entries(
        nested as Record<string, unknown>,
      )) {
        if (typeof val === 'boolean' || typeof val === 'number') {
          const isClosed = val === true || val === 1;
          addHatch(`hatch_${subKey.replace(/\D/g, '') || subKey}`, !isClosed);
        }
      }
    }
  }

  // 2. Flat fields
  for (const [key, val] of Object.entries(data)) {
    const match = key.match(/^(?:hatch|reed|reed_switch)[_]?(\d+)$/i);
    if (match && (typeof val === 'boolean' || typeof val === 'number')) {
      const isClosed = val === true || val === 1;
      addHatch(`hatch_${match[1]}`, !isClosed);
    }
  }

  results.sort((a, b) => {
    const aNum = parseInt(a.id.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.id.replace(/\D/g, '')) || 0;
    return aNum - bNum;
  });

  return results;
}

/** Fallback tanker name when no /config/deviceTankerMap entry exists. */
export function fallbackTankerName(deviceId: string): string {
  const match = deviceId.match(/(\d+)$/);
  if (match) return `Tanker ${match[1].padStart(3, '0')}`;
  return `Tanker ${deviceId}`;
}

/** Sanitize an arbitrary string so it is a safe Firestore document-id segment. */
export function safeIdSegment(raw: string): string {
  return raw.replace(/[/\\.#$[\]]/g, '_');
}
