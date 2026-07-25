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
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
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
  /** Owning fleet_owner company — required so the alert is readable under rules. */
  companyId: string;
  /** Contractor company ids allowed to read this alert (Option A). Omitted if empty. */
  visibleTo?: string[];
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

/**
 * Resolve the owning fleet_owner company for a device from the RTDB mapping
 * that provisionDevice writes at config/deviceCompany/{deviceId}. Returns the
 * company id string, or null when the device is unprovisioned/unmapped.
 */
async function companyOf(deviceId: string): Promise<string | null> {
  try {
    const snap = await rtdb.ref(`config/deviceCompany/${deviceId}`).get();
    const val = snap.val();
    return typeof val === 'string' && val.trim() !== '' ? val : null;
  } catch (err) {
    logger.warn(`could not read config/deviceCompany for ${deviceId}`, err);
    return null;
  }
}

/**
 * Compute the contractor companies that may currently read a given tanker's
 * live data (Option A — active-contract-only visibility). Queries the Firestore
 * `contracts` collection for ACTIVE contracts owned by `companyId`, then returns
 * the deduped contractorCompanyId of every contract whose `tankerIds` includes
 * `tankerId`. Defensive: any read failure yields [] (no over-sharing).
 */
async function contractorsFor(
  companyId: string,
  tankerId: string,
  deviceId: string,
): Promise<string[]> {
  try {
    const qs = await fs
      .collection('contracts')
      .where('fleetOwnerCompanyId', '==', companyId)
      .where('active', '==', true)
      .get();

    const out = new Set<string>();
    for (const doc of qs.docs) {
      const data = doc.data() as {
        tankerIds?: unknown;
        contractorCompanyId?: unknown;
      };
      const tankerIds = Array.isArray(data.tankerIds) ? data.tankerIds : [];
      // The app stores tankers by deviceId; the fleet/tanker uses mapping.tankerId.
      // Match either so a contract works regardless of which id the UI captured.
      if (
        (tankerIds.includes(tankerId) || tankerIds.includes(deviceId)) &&
        typeof data.contractorCompanyId === 'string' &&
        data.contractorCompanyId.trim() !== ''
      ) {
        out.add(data.contractorCompanyId);
      }
    }
    return Array.from(out);
  } catch (err) {
    logger.warn(
      `could not resolve contractors for company ${companyId} / tanker ${tankerId}`,
      err,
    );
    return [];
  }
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

    // ── Resolve multi-tenant scoping (owning company + contractor visibility) ──
    // companyId is the owning fleet_owner; visibleTo lists contractor companies
    // that may currently read this tanker via an active contract (Option A).
    const companyId = await companyOf(deviceId);
    const visibleTo = companyId
      ? await contractorsFor(companyId, tankerId, deviceId)
      : [];

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
    // Stamp companyId/visibleTo so sweepStaleDevices (which only sees RTDB) can
    // scope the offline alert it later raises. Omit undefined/empty fields —
    // RTDB update() rejects undefined values.
    const statusUpdate: Record<string, unknown> = {
      online: true,
      status,
      speed: speedRounded,
      fuelLevel: fuelPercent,
      lastSeen: nowMs,
      location: { lat: locLat, lng: locLng, address },
    };
    if (companyId) statusUpdate.companyId = companyId;
    if (visibleTo.length > 0) statusUpdate.visibleTo = visibleTo;
    await rtdb.ref(`fleet/${tankerId}/currentStatus`).update(statusUpdate);

    // ── Append history record to Firestore sensorReadings ──
    // Company-scope the audit record. Omit companyId/visibleTo when absent —
    // Firestore rejects undefined fields.
    const reading: Record<string, unknown> = {
      deviceId,
      tankerId,
      timestamp: admin.firestore.Timestamp.fromMillis(nowMs),
      gps: hasGps ? { latitude: gps.lat, longitude: gps.lng } : null,
      fuelLevel: fuelPercent,
      distance_cm: distanceCm,
    };
    if (companyId) reading.companyId = companyId;
    if (visibleTo.length > 0) reading.visibleTo = visibleTo;
    await fs.collection('sensorReadings').add(reading);

    // ── Detection ──────────────────────────────────────────────────────────

    // Alerts MUST carry a companyId to be readable under firestore.rules
    // (owns(resource) / sharedTo(resource)). An unmapped/unprovisioned device
    // has no owning company, so writing an alert would produce an orphan doc no
    // one could read. Live fleet status + sensorReadings above still happen;
    // only the alert writes are skipped here. From this point companyId is a
    // non-null string.
    if (!companyId) {
      logger.warn(
        `device ${deviceId} (tanker ${tankerId}) is unmapped ` +
          `(no config/deviceCompany entry) — skipping alert writes`,
      );
      return;
    }

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
              companyId,
              ...(visibleTo.length > 0 ? { visibleTo } : {}),
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
        companyId,
        ...(visibleTo.length > 0 ? { visibleTo } : {}),
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
          companyId?: string;
          visibleTo?: string[];
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

      // Flip to offline. (RTDB status — not company-scoped, always applied.)
      await rtdb.ref(`fleet/${tankerId}/currentStatus`).update({
        online: false,
        status: 'offline',
        speed: 0,
      });

      // Multi-tenant scoping was stamped onto currentStatus by onDeviceData.
      // Without a companyId the alert would be unreadable under rules, so skip
      // it (the device is still flipped offline above).
      const companyId =
        typeof cs.companyId === 'string' && cs.companyId.trim() !== ''
          ? cs.companyId
          : null;
      if (!companyId) {
        logger.warn(
          `tanker ${tankerId} has no companyId on currentStatus — ` +
            `skipping offline alert (device unmapped)`,
        );
        continue;
      }
      const visibleTo = Array.isArray(cs.visibleTo) ? cs.visibleTo : [];

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
        companyId,
        ...(visibleTo.length > 0 ? { visibleTo } : {}),
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

// ─────────────────────────────────────────────────────────────────────────
//  4. onContractWrite — share EXISTING tanker data when a contract activates
//     (and un-share when it is paused/deleted). Backfills `visibleTo` on the
//     fleet owner's alerts/incidents/reports for the contracted tankers, plus
//     the RTDB fleet node, so both parties immediately see the shipment's
//     history — not just data generated after the contract.
// ─────────────────────────────────────────────────────────────────────────

/** Resolve a contract tanker ref (the app stores deviceId) to the set of ids
 *  its records might carry: the ref itself + the mapped tankerId. */
async function idSetForRef(ref: string): Promise<string[]> {
  const set = new Set<string>([ref]);
  try {
    const snap = await rtdb.ref(`config/deviceTankerMap/${ref}`).get();
    const mapped = snap.val()?.tankerId;
    if (typeof mapped === 'string' && mapped.trim() !== '') set.add(mapped);
  } catch {
    /* best-effort */
  }
  return Array.from(set);
}

/** Does a record's tankerId/deviceId belong to any of the contract's ids?
 *  Also matches composite legacy tankerIds like `SOTMS_ESP32_001_2026-...`
 *  by prefix, so old incidents get shared too. */
function recordMatches(
  tankerId: unknown,
  deviceId: unknown,
  ids: string[],
): boolean {
  const tid = typeof tankerId === 'string' ? tankerId : '';
  const did = typeof deviceId === 'string' ? deviceId : '';
  return ids.some(
    (id) => tid === id || did === id || (tid !== '' && tid.startsWith(id)),
  );
}

export const onContractWrite = onDocumentWritten(
  { document: 'contracts/{contractId}', region: REGION },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const contractorId = (after?.contractorCompanyId ??
      before?.contractorCompanyId) as string | undefined;
    const fleetOwnerId = (after?.fleetOwnerCompanyId ??
      before?.fleetOwnerCompanyId) as string | undefined;
    if (!contractorId || !fleetOwnerId) return;

    const beforeTankers: string[] = Array.isArray(before?.tankerIds)
      ? (before!.tankerIds as string[])
      : [];
    const afterTankers: string[] = Array.isArray(after?.tankerIds)
      ? (after!.tankerIds as string[])
      : [];
    const refs = Array.from(new Set([...beforeTankers, ...afterTankers]));
    if (refs.length === 0) return;

    // Share while the contract exists AND is active; otherwise un-share.
    const share = !!after && after.active === true;

    // Build the full id set (deviceIds + mapped tankerIds) to match records.
    const ids = new Set<string>();
    const fleetKeys = new Set<string>();
    for (const ref of refs) {
      const set = await idSetForRef(ref);
      set.forEach((x) => ids.add(x));
      // fleet nodes are keyed by the mapped tankerId when present, else the ref
      fleetKeys.add(set.length > 1 ? set[1] : ref);
    }
    const idList = Array.from(ids);

    const op = share
      ? admin.firestore.FieldValue.arrayUnion(contractorId)
      : admin.firestore.FieldValue.arrayRemove(contractorId);

    // Backfill the fleet owner's Firestore records for the contracted tankers.
    let touched = 0;
    for (const col of ['alerts', 'incidents', 'reports']) {
      const qs = await fs
        .collection(col)
        .where('companyId', '==', fleetOwnerId)
        .get();
      let batch = fs.batch();
      let n = 0;
      for (const doc of qs.docs) {
        const d = doc.data();
        if (recordMatches(d.tankerId, d.deviceId, idList)) {
          batch.update(doc.ref, { visibleTo: op });
          touched++;
          if (++n >= 400) {
            await batch.commit();
            batch = fs.batch();
            n = 0;
          }
        }
      }
      if (n > 0) await batch.commit();
    }

    // Backfill the RTDB fleet nodes so the contractor's live map includes them.
    for (const key of fleetKeys) {
      try {
        const vRef = rtdb.ref(`fleet/${key}/currentStatus/visibleTo`);
        const cur = (await vRef.get()).val();
        const arr: string[] = Array.isArray(cur) ? cur : [];
        const next = share
          ? Array.from(new Set([...arr, contractorId]))
          : arr.filter((x) => x !== contractorId);
        await vRef.set(next);
      } catch (err) {
        logger.warn(`onContractWrite: failed fleet visibleTo for ${key}`, err);
      }
    }

    logger.info(
      `onContractWrite: ${share ? 'shared' : 'unshared'} ${touched} records + ` +
        `${fleetKeys.size} fleet nodes with contractor ${contractorId}`,
    );
  },
);
