/**
 * functions/src/index.ts
 *
 * SOTMS server-side monitoring backend (Cloud Functions v2, Node 20).
 *
 * Moves fleet detection / alerting / history off the browser tab so the fleet
 * is monitored even when no operator has the dashboard open. Mirrors the logic
 * that currently lives in src/contexts/GPSContext.tsx & AlertsContext.
 *
 * Three functions (all region asia-southeast1):
 *   1. onDeviceData      — RTDB onValueWritten on devices/{deviceId}/latest
 *   2. sweepStaleDevices — scheduled every 1 minute (offline detection)
 *   3. pruneHistory      — scheduled daily (sensorReadings retention)
 *
 * Canonical alerts are written to the Firestore `alerts` collection using the
 * exact schema src/components/Alerts/AlertsPage.tsx reads, with DETERMINISTIC
 * document IDs for idempotency (see makeAlertId / ALERT_DEDUP_BUCKET_MS).
 */

import { setGlobalOptions } from 'firebase-functions/v2';
import { onValueWritten } from 'firebase-functions/v2/database';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

import {
  ALERT_DEDUP_BUCKET_MS,
  DeviceTankerMapping,
  EspLatestData,
  HISTORY_RETENTION_DAYS,
  MOVING_SPEED_THRESHOLD_KMH,
  OFFLINE_THRESHOLD_MS,
  OVERSPEED_LIMIT_KMH,
  SPEED_SANITY_CAP_KMH,
  distanceToFuelPercent,
  fallbackTankerName,
  getDistanceFromLatLonInKm,
  getFuelLevelCm,
  isInAuthorizedZone,
  isWithinPakistan,
  parseHatches,
  safeIdSegment,
} from './config';

admin.initializeApp();

const REGION = 'asia-southeast1';
setGlobalOptions({ region: REGION });

// Device authentication endpoints (provisionDevice, mintDeviceToken).
export { mintDeviceToken, provisionDevice } from './deviceAuth';

const rtdb = admin.database();
const fs = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info';

/**
 * Canonical Firestore `alerts` document — matches the schema the React
 * AlertsPage/AlertsTable reads (see src/components/Alerts/AlertsPage.tsx):
 *   type, tankerId, tankerName, timestamp(ISO string), severity,
 *   location{lat,lng,address}, status, description, optional sensorData.
 * `resolved` is included for parity with the RTDB /alerts schema.
 */
interface CanonicalAlert {
  type: string;
  tankerId: string;
  tankerName: string;
  deviceId: string;
  timestamp: string; // ISO string — AlertsTable renders this directly
  severity: Severity;
  status: 'unacknowledged';
  resolved: false;
  description: string;
  location: { lat: number; lng: number; address: string };
  sensorData?: Record<string, unknown>;
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * Build a deterministic alert document id. The epoch bucket collapses repeated
 * triggers within ALERT_DEDUP_BUCKET_MS to one id so writes are idempotent.
 */
function makeAlertId(
  tankerId: string,
  kind: string,
  nowMs: number,
  extra?: string,
): string {
  const bucket = Math.floor(nowMs / ALERT_DEDUP_BUCKET_MS);
  const parts = [safeIdSegment(tankerId), kind];
  if (extra) parts.push(safeIdSegment(extra));
  parts.push(String(bucket));
  return parts.join('_');
}

/**
 * Idempotently create an alert. Uses create() so that once a deterministic id
 * exists it is never overwritten (preserves any operator acknowledgement).
 * ALREADY_EXISTS is swallowed; that is the whole point of the deterministic id.
 */
async function writeAlertOnce(
  docId: string,
  alert: CanonicalAlert,
): Promise<boolean> {
  try {
    await fs.collection('alerts').doc(docId).create(alert);
    logger.info(`alert created: ${docId} (${alert.type})`);
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: number | string })?.code;
    if (code === 6 || code === 'already-exists') {
      // Duplicate within the dedup window — expected, not an error.
      return false;
    }
    logger.error(`failed to write alert ${docId}`, err);
    throw err;
  }
}

async function resolveMapping(
  deviceId: string,
): Promise<DeviceTankerMapping | null> {
  try {
    const snap = await rtdb
      .ref(`config/deviceTankerMap/${deviceId}`)
      .get();
    const val = snap.val() as DeviceTankerMapping | null;
    if (val && typeof val === 'object' && typeof val.tankerId === 'string') {
      return val;
    }
  } catch (err) {
    logger.warn(`could not read deviceTankerMap for ${deviceId}`, err);
  }
  return null;
}

/** Parse a GPS block into a validated {lat,lng} or null (rejects junk/0,0/out-of-region). */
function parseValidGps(
  gps: EspLatestData['gps'],
): { lat: number; lng: number } | null {
  if (!gps) return null;
  const lat = typeof gps.latitude === 'number' ? gps.latitude : Number(gps.latitude);
  const lng = typeof gps.longitude === 'number' ? gps.longitude : Number(gps.longitude);
  if (!isWithinPakistan(lat, lng)) return null;
  return { lat, lng };
}

// ─────────────────────────────────────────────────────────────────────────
//  1. onDeviceData — RTDB trigger on devices/{deviceId}/latest
// ─────────────────────────────────────────────────────────────────────────

export const onDeviceData = onValueWritten(
  { ref: '/devices/{deviceId}/latest', region: REGION },
  async (event) => {
    const deviceId = event.params.deviceId;

    // Ignore deletes.
    if (!event.data.after.exists()) {
      logger.debug(`devices/${deviceId}/latest deleted — ignoring`);
      return;
    }

    const after = event.data.after.val() as EspLatestData | null;
    if (!after || typeof after !== 'object') return;

    const nowMs = Date.now(); // server time is the authority for lastSeen

    // ── Resolve tanker identity ──
    const mapping = await resolveMapping(deviceId);
    const tankerId = mapping?.tankerId || deviceId;
    const tankerName = mapping?.tankerName || fallbackTankerName(deviceId);

    // ── Parse sensor fields (defensive) ──
    const distanceCm = getFuelLevelCm(after);
    const fuelPercent = distanceToFuelPercent(distanceCm);
    const gps = parseValidGps(after.gps);
    const hasGps = gps !== null;
    const hatches = parseHatches(after);

    // ── Read previous currentStatus for speed calc + carry-forward location ──
    let prevStatus: {
      lastSeen?: number;
      speed?: number;
      location?: { lat?: number; lng?: number; address?: string };
    } | null = null;
    try {
      const snap = await rtdb.ref(`fleet/${tankerId}/currentStatus`).get();
      prevStatus = snap.val();
    } catch (err) {
      logger.warn(`could not read fleet/${tankerId}/currentStatus`, err);
    }

    // ── Speed (km/h) from previous vs current position ──
    let speed = 0;
    if (hasGps && prevStatus?.location &&
        typeof prevStatus.location.lat === 'number' &&
        typeof prevStatus.location.lng === 'number' &&
        (prevStatus.location.lat !== 0 || prevStatus.location.lng !== 0) &&
        typeof prevStatus.lastSeen === 'number') {
      const dist = getDistanceFromLatLonInKm(
        prevStatus.location.lat,
        prevStatus.location.lng,
        gps.lat,
        gps.lng,
      );
      const hours = (nowMs - prevStatus.lastSeen) / 1000 / 3600;
      if (hours > 0 && hours < 1) {
        const calc = dist / hours;
        // Sanity cap: discard GPS-noise spikes, fall back to previous speed.
        speed = calc > SPEED_SANITY_CAP_KMH ? (prevStatus.speed || 0) : calc;
      }
    }
    const speedRounded = Math.round(speed);

    // ── Resolve the location to persist (carry previous forward if no fix) ──
    const address = hasGps
      ? `Lat: ${gps.lat.toFixed(4)}, Lng: ${gps.lng.toFixed(4)}`
      : prevStatus?.location?.address || 'GPS not connected';
    const locLat = hasGps ? gps.lat : prevStatus?.location?.lat ?? 0;
    const locLng = hasGps ? gps.lng : prevStatus?.location?.lng ?? 0;

    const status =
      hasGps && speed > MOVING_SPEED_THRESHOLD_KMH ? 'moving' : 'idle';

    // ── Update /fleet/{tankerId}/currentStatus ──
    await rtdb.ref(`fleet/${tankerId}/currentStatus`).update({
      online: true,
      status,
      speed: speedRounded,
      fuelLevel: fuelPercent,
      lastSeen: nowMs,
      location: { lat: locLat, lng: locLng, address },
    });

    // ── Append history record to Firestore sensorReadings ──
    await fs.collection('sensorReadings').add({
      deviceId,
      tankerId,
      timestamp: admin.firestore.Timestamp.fromMillis(nowMs),
      gps: hasGps ? { latitude: gps.lat, longitude: gps.lng } : null,
      fuelLevel: fuelPercent,
      distance_cm: distanceCm,
    });

    // ── Detection ──────────────────────────────────────────────────────────

    // (a) Hatch/reed open while OUTSIDE every authorized zone → critical.
    //     Only alert on the transition (was-not-open → open) to mirror the
    //     browser's "fire once per open event" semantics; the bucketed
    //     deterministic id then guarantees idempotency across retries.
    if (hasGps && hatches.length > 0) {
      const { authorized, nearestZone } = isInAuthorizedZone(gps.lat, gps.lng);
      if (!authorized) {
        const before = event.data.before.exists()
          ? (event.data.before.val() as EspLatestData | null)
          : null;
        const beforeOpen = new Map<string, boolean>();
        if (before && typeof before === 'object') {
          for (const h of parseHatches(before)) beforeOpen.set(h.id, h.open);
        }

        for (const hatch of hatches) {
          const wasOpen = beforeOpen.get(hatch.id) === true;
          if (hatch.open && !wasOpen) {
            const description =
              `${tankerName} — ${hatch.label} OPENED in unauthorized area (${address})`;
            const docId = makeAlertId(
              tankerId,
              `hatch_${safeIdSegment(hatch.id)}`,
              nowMs,
            );
            await writeAlertOnce(docId, {
              type: 'hatch_open_unauthorized',
              tankerId,
              tankerName,
              deviceId,
              timestamp: new Date(nowMs).toISOString(),
              severity: 'critical',
              status: 'unacknowledged',
              resolved: false,
              description,
              location: { lat: gps.lat, lng: gps.lng, address },
              sensorData: {
                fuelLevel: fuelPercent,
                speed: speedRounded,
                hatchId: hatch.id,
                hatchLabel: hatch.label,
                hatchStatus: 'OPEN',
                nearestZone: nearestZone ?? null,
                allHatches: hatches.map((h) => ({
                  id: h.id,
                  label: h.label,
                  open: h.open,
                })),
              },
              createdAt: admin.firestore.Timestamp.fromMillis(nowMs),
            });
          }
        }
      }
    }

    // (b) Overspeed → warning. Bucketed id de-dupes within the window.
    if (speed > OVERSPEED_LIMIT_KMH) {
      const description =
        `${tankerName} overspeeding at ${speedRounded} km/h ` +
        `(limit ${OVERSPEED_LIMIT_KMH} km/h)`;
      const docId = makeAlertId(tankerId, 'overspeed', nowMs);
      await writeAlertOnce(docId, {
        type: 'overspeeding',
        tankerId,
        tankerName,
        deviceId,
        timestamp: new Date(nowMs).toISOString(),
        severity: 'warning',
        status: 'unacknowledged',
        resolved: false,
        description,
        location: { lat: locLat, lng: locLng, address },
        sensorData: {
          speed: speedRounded,
          limit: OVERSPEED_LIMIT_KMH,
          fuelLevel: fuelPercent,
        },
        createdAt: admin.firestore.Timestamp.fromMillis(nowMs),
      });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
//  2. sweepStaleDevices — scheduled offline detection (every 1 minute)
// ─────────────────────────────────────────────────────────────────────────

export const sweepStaleDevices = onSchedule(
  { schedule: 'every 1 minutes', region: REGION },
  async () => {
    const nowMs = Date.now();
    const snap = await rtdb.ref('fleet').get();
    const fleet = snap.val() as Record<
      string,
      {
        currentStatus?: {
          online?: boolean;
          lastSeen?: number;
          location?: { lat?: number; lng?: number; address?: string };
        };
        info?: { name?: string; deviceId?: string };
      }
    > | null;

    if (!fleet) {
      logger.debug('sweepStaleDevices: no fleet data');
      return;
    }

    let markedOffline = 0;

    for (const [tankerId, node] of Object.entries(fleet)) {
      const cs = node?.currentStatus;
      if (!cs || cs.online !== true) continue; // only act on online devices
      const lastSeen = typeof cs.lastSeen === 'number' ? cs.lastSeen : 0;
      if (lastSeen <= 0) continue;
      if (nowMs - lastSeen <= OFFLINE_THRESHOLD_MS) continue; // still fresh

      markedOffline++;
      const tankerName = node?.info?.name || fallbackTankerName(tankerId);
      const deviceId = node?.info?.deviceId || tankerId;

      // Flip to offline.
      await rtdb.ref(`fleet/${tankerId}/currentStatus`).update({
        online: false,
        status: 'offline',
        speed: 0,
      });

      // ONE-TIME offline alert: id keyed on lastSeen so each distinct offline
      // episode yields exactly one alert (repeated sweeps → same id → no dup).
      const ageSec = Math.round((nowMs - lastSeen) / 1000);
      const docId =
        `${safeIdSegment(tankerId)}_offline_${lastSeen}`;
      await writeAlertOnce(docId, {
        type: 'device_offline',
        tankerId,
        tankerName,
        deviceId,
        timestamp: new Date(nowMs).toISOString(),
        severity: 'warning',
        status: 'unacknowledged',
        resolved: false,
        description: `${tankerName} went offline (last seen ${ageSec}s ago)`,
        location: {
          lat: cs.location?.lat ?? 0,
          lng: cs.location?.lng ?? 0,
          address: cs.location?.address || 'Vehicle offline',
        },
        sensorData: { lastSeen, ageSec },
        createdAt: admin.firestore.Timestamp.fromMillis(nowMs),
      });
    }

    logger.info(
      `sweepStaleDevices: ${markedOffline} device(s) marked offline`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────
//  3. pruneHistory — scheduled daily Firestore sensorReadings retention
// ─────────────────────────────────────────────────────────────────────────

export const pruneHistory = onSchedule(
  { schedule: 'every 24 hours', region: REGION },
  async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(
      Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    let totalDeleted = 0;
    // Delete in batches of <=500 (Firestore batch limit) until none remain.
    for (;;) {
      const batchSnap = await fs
        .collection('sensorReadings')
        .where('timestamp', '<', cutoff)
        .orderBy('timestamp', 'asc')
        .limit(500)
        .get();

      if (batchSnap.empty) break;

      const batch = fs.batch();
      batchSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += batchSnap.size;

      // Fewer than a full page means we've reached the end.
      if (batchSnap.size < 500) break;
    }

    logger.info(
      `pruneHistory: deleted ${totalDeleted} sensorReadings older than ` +
        `${HISTORY_RETENTION_DAYS} days`,
    );
  },
);
