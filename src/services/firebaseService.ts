import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  Timestamp,
  arrayUnion,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, onValue, update, off } from 'firebase/database';
import { db, rtdb } from '../firebase';
import type {
  WithId,
  TankerDoc,
  DeviceDoc,
  SensorReadingDoc,
  TripDoc,
  TripDeviation,
  IncidentDoc,
  IncidentNote,
  SystemConfigDoc,
  RTDBRealtimeData,
  RTDBActiveAlert,
  QueryOptions,
  ServiceResponse,
} from '../types/database';

// ──────────────────────────────────────────────
// Generic Helpers
// ──────────────────────────────────────────────

function buildConstraints(options?: QueryOptions): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (options?.filters) {
    for (const f of options.filters) {
      constraints.push(where(f.field, f.operator, f.value));
    }
  }

  if (options?.orderByField) {
    constraints.push(orderBy(options.orderByField, options.orderDirection || 'asc'));
  }

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  return constraints;
}

async function safeAsync<T>(fn: () => Promise<T>): Promise<ServiceResponse<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err: unknown) {
    const firebaseError = err as { code?: string; message?: string };
    return {
      data: null,
      error: {
        code: firebaseError.code || 'unknown',
        message: firebaseError.message || 'An unexpected error occurred',
      },
    };
  }
}

function mapDocs<T>(snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }): WithId<T>[] {
  return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as WithId<T>));
}

// ──────────────────────────────────────────────
// TANKERS
// ──────────────────────────────────────────────

const TANKERS = 'tankers';

export async function createTanker(
  data: Omit<TankerDoc, 'createdAt' | 'updatedAt'>
): Promise<ServiceResponse<string>> {
  return safeAsync(async () => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, TANKERS), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  });
}

export async function getTanker(
  tankerId: string
): Promise<ServiceResponse<WithId<TankerDoc> | null>> {
  return safeAsync(async () => {
    const snap = await getDoc(doc(db, TANKERS, tankerId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as WithId<TankerDoc>;
  });
}

export async function getAllTankers(
  options?: QueryOptions
): Promise<ServiceResponse<WithId<TankerDoc>[]>> {
  return safeAsync(async () => {
    const q = query(collection(db, TANKERS), ...buildConstraints(options));
    const snap = await getDocs(q);
    return mapDocs<TankerDoc>(snap);
  });
}

export async function updateTanker(
  tankerId: string,
  data: Partial<TankerDoc>
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, TANKERS, tankerId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  });
}

export async function deleteTanker(
  tankerId: string
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await deleteDoc(doc(db, TANKERS, tankerId));
  });
}

export function subscribeTankers(
  callback: (tankers: WithId<TankerDoc>[]) => void,
  options?: QueryOptions
): Unsubscribe {
  const q = query(collection(db, TANKERS), ...buildConstraints(options));
  return onSnapshot(q, (snap) => {
    callback(mapDocs<TankerDoc>(snap));
  });
}

// ──────────────────────────────────────────────
// DEVICES
// ──────────────────────────────────────────────

const DEVICES = 'devices';

export async function createDevice(
  data: Omit<DeviceDoc, 'createdAt' | 'updatedAt'>
): Promise<ServiceResponse<string>> {
  return safeAsync(async () => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, DEVICES), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  });
}

export async function getDevice(
  deviceId: string
): Promise<ServiceResponse<WithId<DeviceDoc> | null>> {
  return safeAsync(async () => {
    const snap = await getDoc(doc(db, DEVICES, deviceId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as WithId<DeviceDoc>;
  });
}

export async function getAllDevices(
  options?: QueryOptions
): Promise<ServiceResponse<WithId<DeviceDoc>[]>> {
  return safeAsync(async () => {
    const q = query(collection(db, DEVICES), ...buildConstraints(options));
    const snap = await getDocs(q);
    return mapDocs<DeviceDoc>(snap);
  });
}

export async function updateDevice(
  deviceId: string,
  data: Partial<DeviceDoc>
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, DEVICES, deviceId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  });
}

export async function deleteDevice(
  deviceId: string
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await deleteDoc(doc(db, DEVICES, deviceId));
  });
}

export function subscribeDevices(
  callback: (devices: WithId<DeviceDoc>[]) => void,
  options?: QueryOptions
): Unsubscribe {
  const q = query(collection(db, DEVICES), ...buildConstraints(options));
  return onSnapshot(q, (snap) => {
    callback(mapDocs<DeviceDoc>(snap));
  });
}

export async function getDevicesByTanker(
  tankerId: string
): Promise<ServiceResponse<WithId<DeviceDoc>[]>> {
  return safeAsync(async () => {
    const q = query(collection(db, DEVICES), where('tankerId', '==', tankerId));
    const snap = await getDocs(q);
    return mapDocs<DeviceDoc>(snap);
  });
}

export async function updateDeviceStatus(
  deviceId: string,
  status: DeviceDoc['status'],
  batteryLevel?: number
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    const updates: Record<string, unknown> = {
      status,
      lastSeen: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (batteryLevel !== undefined) updates.batteryLevel = batteryLevel;
    await updateDoc(doc(db, DEVICES, deviceId), updates);
  });
}

// ──────────────────────────────────────────────
// SENSOR READINGS
// ──────────────────────────────────────────────

const SENSOR_READINGS = 'sensorReadings';

export async function createSensorReading(
  data: SensorReadingDoc
): Promise<ServiceResponse<string>> {
  return safeAsync(async () => {
    const docRef = await addDoc(collection(db, SENSOR_READINGS), data);
    return docRef.id;
  });
}

export async function getSensorReadings(
  deviceId: string,
  startTime: Timestamp,
  endTime: Timestamp,
  options?: QueryOptions
): Promise<ServiceResponse<WithId<SensorReadingDoc>[]>> {
  return safeAsync(async () => {
    const baseConstraints: QueryConstraint[] = [
      where('deviceId', '==', deviceId),
      where('timestamp', '>=', startTime),
      where('timestamp', '<=', endTime),
      orderBy('timestamp', 'desc'),
    ];
    if (options?.limitCount) baseConstraints.push(limit(options.limitCount));
    const q = query(collection(db, SENSOR_READINGS), ...baseConstraints);
    const snap = await getDocs(q);
    return mapDocs<SensorReadingDoc>(snap);
  });
}

export async function getLatestSensorReading(
  deviceId: string
): Promise<ServiceResponse<WithId<SensorReadingDoc> | null>> {
  return safeAsync(async () => {
    const q = query(
      collection(db, SENSOR_READINGS),
      where('deviceId', '==', deviceId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { ...snap.docs[0].data(), id: snap.docs[0].id } as WithId<SensorReadingDoc>;
  });
}

export function subscribeSensorReadings(
  deviceId: string,
  callback: (readings: WithId<SensorReadingDoc>[]) => void,
  limitCount = 50
): Unsubscribe {
  const q = query(
    collection(db, SENSOR_READINGS),
    where('deviceId', '==', deviceId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(mapDocs<SensorReadingDoc>(snap));
  });
}

// ──────────────────────────────────────────────
// TRIPS
// ──────────────────────────────────────────────

const TRIPS = 'trips';

export async function createTrip(
  data: Omit<TripDoc, 'createdAt' | 'updatedAt'>
): Promise<ServiceResponse<string>> {
  return safeAsync(async () => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, TRIPS), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  });
}

export async function getTrip(
  tripId: string
): Promise<ServiceResponse<WithId<TripDoc> | null>> {
  return safeAsync(async () => {
    const snap = await getDoc(doc(db, TRIPS, tripId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as WithId<TripDoc>;
  });
}

export async function getActiveTrips(): Promise<ServiceResponse<WithId<TripDoc>[]>> {
  return safeAsync(async () => {
    const q = query(
      collection(db, TRIPS),
      where('status', 'in', ['scheduled', 'in_progress', 'delayed']),
      orderBy('startTime', 'desc')
    );
    const snap = await getDocs(q);
    return mapDocs<TripDoc>(snap);
  });
}

export async function getTripsByTanker(
  tankerId: string,
  options?: QueryOptions
): Promise<ServiceResponse<WithId<TripDoc>[]>> {
  return safeAsync(async () => {
    const constraints: QueryConstraint[] = [
      where('tankerId', '==', tankerId),
      ...buildConstraints(options),
    ];
    if (!options?.orderByField) constraints.push(orderBy('startTime', 'desc'));
    const q = query(collection(db, TRIPS), ...constraints);
    const snap = await getDocs(q);
    return mapDocs<TripDoc>(snap);
  });
}

export async function getTripsByDriver(
  driverId: string,
  options?: QueryOptions
): Promise<ServiceResponse<WithId<TripDoc>[]>> {
  return safeAsync(async () => {
    const constraints: QueryConstraint[] = [
      where('driverId', '==', driverId),
      ...buildConstraints(options),
    ];
    if (!options?.orderByField) constraints.push(orderBy('startTime', 'desc'));
    const q = query(collection(db, TRIPS), ...constraints);
    const snap = await getDocs(q);
    return mapDocs<TripDoc>(snap);
  });
}

export async function updateTrip(
  tripId: string,
  data: Partial<TripDoc>
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, TRIPS, tripId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  });
}

export function subscribeTrips(
  callback: (trips: WithId<TripDoc>[]) => void,
  options?: QueryOptions
): Unsubscribe {
  const q = query(collection(db, TRIPS), ...buildConstraints(options));
  return onSnapshot(q, (snap) => {
    callback(mapDocs<TripDoc>(snap));
  });
}

export async function startTrip(
  tripId: string
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, TRIPS, tripId), {
      status: 'in_progress',
      startTime: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}

export async function completeTrip(
  tripId: string,
  endFuelLevel: number,
  totalDistance: number
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    const snap = await getDoc(doc(db, TRIPS, tripId));
    if (!snap.exists()) throw new Error('Trip not found');
    const tripData = snap.data() as TripDoc;
    const consumed = tripData.fuelLevels.start - endFuelLevel;

    await updateDoc(doc(db, TRIPS, tripId), {
      status: 'completed',
      endTime: Timestamp.now(),
      'fuelLevels.end': endFuelLevel,
      'fuelLevels.consumed': consumed,
      distanceCovered: totalDistance,
      updatedAt: Timestamp.now(),
    });
  });
}

export async function addTripDeviation(
  tripId: string,
  deviation: TripDeviation
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, TRIPS, tripId), {
      deviations: arrayUnion(deviation),
      routeDeviations: (await getDoc(doc(db, TRIPS, tripId))).data()?.routeDeviations + 1 || 1,
      updatedAt: Timestamp.now(),
    });
  });
}

// ──────────────────────────────────────────────
// INCIDENTS
// ──────────────────────────────────────────────

const INCIDENTS = 'incidents';

export async function createIncident(
  data: Omit<IncidentDoc, 'createdAt' | 'updatedAt'>
): Promise<ServiceResponse<string>> {
  return safeAsync(async () => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, INCIDENTS), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  });
}

export async function getIncident(
  incidentId: string
): Promise<ServiceResponse<WithId<IncidentDoc> | null>> {
  return safeAsync(async () => {
    const snap = await getDoc(doc(db, INCIDENTS, incidentId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as WithId<IncidentDoc>;
  });
}

export async function getIncidentsByTanker(
  tankerId: string,
  options?: QueryOptions
): Promise<ServiceResponse<WithId<IncidentDoc>[]>> {
  return safeAsync(async () => {
    const constraints: QueryConstraint[] = [
      where('tankerId', '==', tankerId),
      ...buildConstraints(options),
    ];
    if (!options?.orderByField) constraints.push(orderBy('timestamp', 'desc'));
    const q = query(collection(db, INCIDENTS), ...constraints);
    const snap = await getDocs(q);
    return mapDocs<IncidentDoc>(snap);
  });
}

export async function updateIncident(
  incidentId: string,
  data: Partial<IncidentDoc>
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, INCIDENTS, incidentId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  });
}

export async function addIncidentNote(
  incidentId: string,
  note: IncidentNote
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, INCIDENTS, incidentId), {
      notes: arrayUnion(note),
      updatedAt: Timestamp.now(),
    });
  });
}

export function subscribeIncidents(
  callback: (incidents: WithId<IncidentDoc>[]) => void,
  options?: QueryOptions
): Unsubscribe {
  const q = query(collection(db, INCIDENTS), ...buildConstraints(options));
  return onSnapshot(q, (snap) => {
    callback(mapDocs<IncidentDoc>(snap));
  });
}

export async function resolveIncident(
  incidentId: string,
  resolvedBy: string
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await updateDoc(doc(db, INCIDENTS, incidentId), {
      status: 'resolved',
      resolvedAt: Timestamp.now(),
      assignedTo: resolvedBy,
      updatedAt: Timestamp.now(),
    });
  });
}

// ──────────────────────────────────────────────
// SYSTEM CONFIG (singleton: systemConfig/settings)
// ──────────────────────────────────────────────

const SYSTEM_CONFIG_PATH = 'systemConfig';
const SETTINGS_DOC = 'settings';

export async function getSystemConfig(): Promise<ServiceResponse<SystemConfigDoc | null>> {
  return safeAsync(async () => {
    const snap = await getDoc(doc(db, SYSTEM_CONFIG_PATH, SETTINGS_DOC));
    if (!snap.exists()) return null;
    return snap.data() as SystemConfigDoc;
  });
}

export async function updateSystemConfig(
  data: Partial<SystemConfigDoc>,
  updatedBy: string
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    await setDoc(
      doc(db, SYSTEM_CONFIG_PATH, SETTINGS_DOC),
      { ...data, updatedAt: Timestamp.now(), updatedBy },
      { merge: true }
    );
  });
}

export function subscribeSystemConfig(
  callback: (config: SystemConfigDoc | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, SYSTEM_CONFIG_PATH, SETTINGS_DOC), (snap) => {
    callback(snap.exists() ? (snap.data() as SystemConfigDoc) : null);
  });
}

// ──────────────────────────────────────────────
// RTDB: Real-time Device Data
// ──────────────────────────────────────────────

export function subscribeRealtimeData(
  deviceId: string,
  callback: (data: RTDBRealtimeData | null) => void
): () => void {
  const dbRef = ref(rtdb, `realtimeData/${deviceId}`);
  const handler = onValue(dbRef, (snap) => {
    callback(snap.exists() ? (snap.val() as RTDBRealtimeData) : null);
  });
  return () => off(dbRef, 'value', handler);
}

export function subscribeAllRealtimeData(
  callback: (data: Record<string, RTDBRealtimeData>) => void
): () => void {
  const dbRef = ref(rtdb, 'realtimeData');
  const handler = onValue(dbRef, (snap) => {
    callback(snap.exists() ? (snap.val() as Record<string, RTDBRealtimeData>) : {});
  });
  return () => off(dbRef, 'value', handler);
}

export async function updateRealtimeData(
  deviceId: string,
  data: Partial<RTDBRealtimeData>
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    const dbRef = ref(rtdb, `realtimeData/${deviceId}`);
    await update(dbRef, data);
  });
}

// ──────────────────────────────────────────────
// RTDB: Active Alerts
// ──────────────────────────────────────────────

export function subscribeActiveAlerts(
  tankerId: string,
  callback: (alert: RTDBActiveAlert | null) => void
): () => void {
  const dbRef = ref(rtdb, `activeAlerts/${tankerId}`);
  const handler = onValue(dbRef, (snap) => {
    callback(snap.exists() ? (snap.val() as RTDBActiveAlert) : null);
  });
  return () => off(dbRef, 'value', handler);
}

export async function updateActiveAlert(
  tankerId: string,
  data: Partial<RTDBActiveAlert>
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    const dbRef = ref(rtdb, `activeAlerts/${tankerId}`);
    await update(dbRef, data);
  });
}

// ──────────────────────────────────────────────
// BATCH OPERATIONS
// ──────────────────────────────────────────────

export async function batchUpdateAlertStatus(
  alertIds: string[],
  status: string,
  acknowledgedBy?: string
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    // Firestore limits batches to 500 operations
    const chunks: string[][] = [];
    for (let i = 0; i < alertIds.length; i += 500) {
      chunks.push(alertIds.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      const now = Timestamp.now();
      for (const alertId of chunk) {
        const alertRef = doc(db, 'alerts', alertId);
        const updates: Record<string, unknown> = { status, updatedAt: now };
        if (acknowledgedBy) {
          updates.isAcknowledged = true;
          updates.acknowledgedBy = acknowledgedBy;
          updates.acknowledgedAt = now;
        }
        batch.update(alertRef, updates);
      }
      await batch.commit();
    }
  });
}

export async function batchCreateSensorReadings(
  readings: SensorReadingDoc[]
): Promise<ServiceResponse<void>> {
  return safeAsync(async () => {
    const chunks: SensorReadingDoc[][] = [];
    for (let i = 0; i < readings.length; i += 500) {
      chunks.push(readings.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const reading of chunk) {
        const docRef = doc(collection(db, SENSOR_READINGS));
        batch.set(docRef, reading);
      }
      await batch.commit();
    }
  });
}
