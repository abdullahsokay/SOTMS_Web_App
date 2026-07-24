/**
 * Centralized application constants (SOTMS oil-tanker monitoring).
 *
 * These values are currently DUPLICATED as local `const`s and inline magic
 * numbers across the app. This module is the single source of truth going
 * forward. Each value below was copied verbatim from its current hardcoded
 * location so behaviour is unchanged.
 *
 * FOLLOW-UP (intentionally not done here to avoid merge conflicts): adopt
 * these constants in place of the inline literals in —
 *   - src/contexts/GPSContext.tsx
 *       OFFLINE_THRESHOLD_MS, STALE_THRESHOLD_MS,
 *       MOVING_SPEED_THRESHOLD_KMH (speed > 2 => "moving"),
 *       SPEED_SANITY_CAP_KMH (discard readings > 150),
 *       PAKISTAN_BOUNDS (the `lat < 23 || lat > 37 || lng < 60 || lng > 78` filter)
 *   - src/components/Drivers/DriverBehaviourPage.tsx
 *       OVERSPEED_LIMIT_KMH, HARSH_BRAKE_KMH_DROP, IDLE_WARN_MINUTES
 *   - geofence UI / route forms (CreateRouteModal, DrawRouteModal, RouteDetailsPanel)
 *       GEOFENCE_RADIUS_MIN_M, GEOFENCE_RADIUS_MAX_M
 *   - src/components/Dashboard/MapWidget.tsx, src/components/Routes/RouteMapView.tsx,
 *     src/hooks/usePathHistory.ts (map restriction / Pakistan bounds)
 *       PAKISTAN_BOUNDS
 */

// ── Driver behaviour thresholds ──
// Source: DriverBehaviourPage.tsx (`SPEED_LIMIT_KMH`)
/** Speed above which a tanker is flagged for overspeeding (km/h). */
export const OVERSPEED_LIMIT_KMH = 80;

// Source: DriverBehaviourPage.tsx (`HARSH_BRAKE_KMH_DROP`)
/** Drop in speed between consecutive readings that counts as harsh braking (km/h). */
export const HARSH_BRAKE_KMH_DROP = 30;

// Source: DriverBehaviourPage.tsx (`IDLE_WARN_MINUTES`)
/** Minutes a tanker may idle (ignition on, not moving) before it's a violation. */
export const IDLE_WARN_MINUTES = 10;

// ── Live GPS / status thresholds ──
// Source: GPSContext.tsx (`calculatedSpeed > 2` => status 'moving')
/** Speed at/below which a tanker is treated as idle rather than moving (km/h). */
export const MOVING_SPEED_THRESHOLD_KMH = 2;

// Source: GPSContext.tsx (`OFFLINE_THRESHOLD_MS = 15_000`)
/** No fresh ESP data within this window => device considered offline (ms). */
export const OFFLINE_THRESHOLD_MS = 15_000;

// Source: GPSContext.tsx (`STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000`)
/** Devices silent longer than this are hidden entirely as stale RTDB nodes (ms). */
export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Source: GPSContext.tsx (`if (calculatedSpeed > 150) calculatedSpeed = prev.speed`)
/** Calculated speeds above this are treated as GPS noise and discarded (km/h). */
export const SPEED_SANITY_CAP_KMH = 150;

// ── Geofence radius bounds ──
// Source: route forms CreateRouteModal / DrawRouteModal / RouteDetailsPanel
// (`<input min="50" max="200" ... geofenceRadius>`), in meters.
/** Minimum selectable route geofence radius (meters). */
export const GEOFENCE_RADIUS_MIN_M = 50;
/** Maximum selectable route geofence radius (meters). */
export const GEOFENCE_RADIUS_MAX_M = 200;

// ── Geographic bounds ──
// Source: MapWidget.tsx / RouteMapView.tsx map `restriction.latLngBounds`
// and the GPSContext/usePathHistory `lat < 23 || lat > 37 || lng < 60 || lng > 78`
// coordinate filter. Approximate bounding box of Pakistan.
/** Approximate lat/lng bounding box of Pakistan, used to reject out-of-region GPS. */
export const PAKISTAN_BOUNDS = {
  north: 37.5,
  south: 23,
  east: 78,
  west: 60,
} as const;
