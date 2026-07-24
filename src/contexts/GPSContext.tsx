import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { ref, onValue, off, set, push, update } from 'firebase/database';
import { collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { rtdb, auth, db } from '../firebase';
import { Tanker, HatchStatus } from '../types';
import { distanceToFuelPercent } from '../utils/fuelCalc';
import { getDistanceFromLatLonInKm, getBearing, getTime } from '../utils/geo';

// ── Dynamic mapping stored at /config/deviceTankerMap/{deviceId} ──
interface DeviceTankerMapping {
    tankerId: string;
    tankerName: string;
    driver?: string;
}

// Shape of the "latest" node each ESP writes under devices/<id>/latest
interface ESPLatestData {
    distance_cm?: number;
    // ESP sends ultrasonic as nested: { sensor_1: 25, sensor_2: 30, sensor_3: -1 }
    ultrasonic?: Record<string, number>;
    gps?: {
        latitude: number;
        longitude: number;
        satellites?: number;
        status?: string;
    };
    rssi?: number;
    timestamp?: string | number;
    uptime_ms?: number;
    temperature_c?: number;
    // Reed switch data — ESP sends as nested: reed: { switch_1: true, switch_2: false }
    reed?: Record<string, boolean>;
    hatches?: Record<string, boolean>;
    [key: string]: unknown;
}

/** Extract primary fuel level (cm) from ESP data.
 *  ESP sends 3 ultrasonic sensors — we use sensor_1 as the fuel level.
 *  Falls back to distance_cm if ultrasonic object doesn't exist.
 */
function getFuelLevelCm(data: ESPLatestData): number {
    // Try ultrasonic.sensor_1 first (how ESP actually sends it)
    if (data.ultrasonic && typeof data.ultrasonic === 'object') {
        const s1 = data.ultrasonic.sensor_1;
        if (typeof s1 === 'number' && s1 >= 0) return s1;
        // Try any first valid sensor
        for (const val of Object.values(data.ultrasonic)) {
            if (typeof val === 'number' && val >= 0) return val;
        }
    }
    // Fallback to flat distance_cm field
    return typeof data.distance_cm === 'number' ? data.distance_cm : 0;
}

// ── Authorized zones: locations where hatches are ALLOWED to be opened ──
// (depots, terminals, delivery points). Tankers opening hatches outside
// these zones trigger a critical alert. Radius in km.
interface AuthorizedZone {
    name: string;
    lat: number;
    lng: number;
    radiusKm: number;
}

// Default authorized zones — depots and major oil terminals in Pakistan.
// These can be extended from Firestore /config/authorizedZones in the future.
const AUTHORIZED_ZONES: AuthorizedZone[] = [
    { name: 'Karachi Port Terminal', lat: 24.8465, lng: 67.0098, radiusKm: 1.5 },
    { name: 'Karachi Refinery', lat: 24.8200, lng: 66.9900, radiusKm: 1.0 },
    { name: 'Mahmood Kot Terminal', lat: 29.5600, lng: 70.7200, radiusKm: 1.0 },
    { name: 'Machike Terminal', lat: 31.6300, lng: 74.0600, radiusKm: 1.0 },
    { name: 'Shikarpur Terminal', lat: 27.9500, lng: 68.6500, radiusKm: 1.0 },
    { name: 'Faisalabad Depot', lat: 31.4187, lng: 73.0791, radiusKm: 0.8 },
    { name: 'Lahore Depot', lat: 31.5204, lng: 74.3587, radiusKm: 0.8 },
    { name: 'Islamabad Depot', lat: 33.6844, lng: 73.0479, radiusKm: 0.8 },
    { name: 'Rawalpindi Depot', lat: 33.5651, lng: 73.0169, radiusKm: 0.8 },
    { name: 'Multan Depot', lat: 30.1575, lng: 71.5249, radiusKm: 0.8 },
];

/** Check if a position is within ANY authorized zone */
function isInAuthorizedZone(lat: number, lng: number): { authorized: boolean; nearestZone?: string } {
    for (const zone of AUTHORIZED_ZONES) {
        const dist = getDistanceFromLatLonInKm(lat, lng, zone.lat, zone.lng);
        if (dist <= zone.radiusKm) {
            return { authorized: true, nearestZone: zone.name };
        }
    }
    return { authorized: false };
}

/**
 * Parse hatches/reed switches from ESP data.
 * Handles multiple formats:
 *   1. Nested: latest.hatches = { hatch_1: true, hatch_2: false }
 *   2. Flat fields: latest.hatch1 = true, latest.reed2 = false
 *   3. Nested: latest.reed = { reed_1: true, reed_2: false }
 *   4. Nested: latest.reed_switch = { 1: true, 2: false }
 */
function parseHatches(data: ESPLatestData): HatchStatus[] {
    const results: HatchStatus[] = [];
    const seen = new Set<string>();

    function addHatch(id: string, open: boolean) {
        if (seen.has(id)) return;
        seen.add(id);
        // "hatch_1" → "Hatch 1", "reed2" → "Hatch 2"
        const num = id.match(/(\d+)/)?.[1] || id;
        results.push({ id, label: `Hatch ${num}`, open: Boolean(open) });
    }

    // ESP sends: reed.switch_1 = true  → means CLOSED (magnet present)
    //            reed.switch_1 = false → means OPEN   (no magnet / hatch opened)
    // So: open = !(value)

    // 1. Check nested objects: hatches, reed, reed_switch, hatch
    for (const key of ['hatches', 'reed', 'reed_switch', 'hatch']) {
        const nested = data[key];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            for (const [subKey, val] of Object.entries(nested as Record<string, unknown>)) {
                if (typeof val === 'boolean' || typeof val === 'number') {
                    // true/1 = closed (magnet present), false/0 = OPEN (hatch opened)
                    const isClosed = val === true || val === 1;
                    addHatch(`hatch_${subKey.replace(/\D/g, '') || subKey}`, !isClosed);
                }
            }
        }
    }

    // 2. Check flat fields: hatch1, hatch2, hatch3, reed1, reed2, reed3, reed_1, reed_2, etc.
    for (const [key, val] of Object.entries(data)) {
        const match = key.match(/^(?:hatch|reed|reed_switch)[_]?(\d+)$/i);
        if (match && (typeof val === 'boolean' || typeof val === 'number')) {
            const isClosed = val === true || val === 1;
            addHatch(`hatch_${match[1]}`, !isClosed);
        }
    }

    // Sort by hatch number
    results.sort((a, b) => {
        const aNum = parseInt(a.id.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.id.replace(/\D/g, '')) || 0;
        return aNum - bNum;
    });

    return results;
}

// Fallback name when no mapping exists in Firebase yet
function fallbackTankerName(deviceId: string): string {
    const match = deviceId.match(/(\d+)$/);
    if (match) return `Tanker ${match[1].padStart(3, '0')}`;
    return `Tanker ${deviceId}`;
}

interface GPSContextType {
    tankers: Tanker[];
    recentReadings: (ESPLatestData & { id: string })[];
    positionHistory: Array<{ lat: number; lng: number; timestamp: number; tankerId?: string }>;
    speedHistory: Array<{ time: number; speed: number }>;
    loading: boolean;
    error: string | null;
}

const GPSContext = createContext<GPSContextType | undefined>(undefined);

// How long before a device is considered offline (no fresh data)
const OFFLINE_THRESHOLD_MS = 15_000; // 15 seconds — ESP sends every ~1-2s
// Don't show devices that haven't sent data in over 24 hours — they're just
// stale RTDB nodes from devices that were disconnected long ago.
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DevicePrevData {
    lat: number;
    lng: number;
    time: number;
    speed: number;
    bearing: number;
    address?: string;
    geocodedLat?: number;
    geocodedLng?: number;
}

export function GPSProvider({ children }: { children: ReactNode }) {
    const [tankers, setTankers] = useState<Tanker[]>([]);
    const [recentReadings, setRecentReadings] = useState<(ESPLatestData & { id: string })[]>([]);
    const [positionHistory, setPositionHistory] = useState<Array<{ lat: number; lng: number; timestamp: number; tankerId?: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [speedHistory, setSpeedHistory] = useState<Array<{ time: number; speed: number }>>([]);

    const prevDataRef = useRef<Map<string, DevicePrevData>>(new Map());
    const speedHistoryRef = useRef<Array<{ time: number; speed: number }>>([]);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);
    const geocodePendingRef = useRef<Set<string>>(new Set());

    // Dynamic device→tanker mapping from /config/deviceTankerMap
    const mappingRef = useRef<Record<string, DeviceTankerMapping>>({});
    // Track which devices we already fired an offline alert for (avoid duplicates)
    const offlineAlertedRef = useRef<Set<string>>(new Set());
    // Track which device+hatch combos we already fired a hatch-open alert for (avoid spam)
    // Key format: "deviceId::hatchId"
    const hatchAlertedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let isMounted = true;
        console.log('[GPSContext] Provider mounted — listening to RTDB /devices');

        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('[GPSContext] Loading timed out');
                setLoading(false);
            }
        }, 12000);

        let devicesRef: ReturnType<typeof ref> | null = null;
        let mapRef: ReturnType<typeof ref> | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (!isMounted) return;

            if (user) {
                console.log('[GPSContext] Authenticated — connecting to /devices');
                if (devicesRef) off(devicesRef);
                if (mapRef) off(mapRef);

                try {
                    // ── 1. Listen to /config/deviceTankerMap for dynamic mapping ──
                    mapRef = ref(rtdb, 'config/deviceTankerMap');
                    onValue(mapRef, (snap) => {
                        mappingRef.current = snap.exists()
                            ? (snap.val() as Record<string, DeviceTankerMapping>)
                            : {};
                        console.log('[GPSContext] Device→Tanker mapping loaded:', Object.keys(mappingRef.current));
                    });

                    // ── 2. Listen to /devices for live ESP data ──
                    devicesRef = ref(rtdb, 'devices');

                    onValue(devicesRef, (snapshot) => {
                        if (!isMounted) return;

                        try {
                            const now = Date.now();
                            const devicesData = snapshot.val() as Record<string, { latest?: ESPLatestData; readings?: unknown }> | null;

                            if (!devicesData) {
                                console.warn('[GPSContext] /devices is empty');
                                setTankers([]);
                                setLoading(false);
                                return;
                            }

                            // ── Collect devices that have a "latest" node ──
                            const liveDevices: { id: string; data: ESPLatestData; lastSeen: number }[] = [];

                            for (const [deviceId, node] of Object.entries(devicesData)) {
                                const latest = node?.latest;
                                if (!latest || typeof latest !== 'object') continue;

                                // ESP already updates latest.timestamp every few seconds — use it directly
                                const lastSeen = getTime(latest.timestamp);

                                // DEBUG: see raw vs parsed timestamp in console
                                console.log(`[GPSContext] ${deviceId} | raw timestamp: ${latest.timestamp} (${typeof latest.timestamp}) → parsed: ${lastSeen}ms → age: ${lastSeen > 0 ? Math.round((now - lastSeen) / 1000) + 's' : 'UNKNOWN'}`);

                                // Skip completely stale nodes (e.g. board removed weeks ago)
                                if (lastSeen > 0 && (now - lastSeen) > STALE_THRESHOLD_MS) {
                                    console.log(`[GPSContext] Skipping stale device ${deviceId} — last seen ${Math.round((now - lastSeen) / 3600000)}h ago`);
                                    continue;
                                }

                                liveDevices.push({ id: deviceId, data: latest, lastSeen });
                            }

                            const onlineCount = liveDevices.filter(d => d.lastSeen > 0 && (now - d.lastSeen) <= OFFLINE_THRESHOLD_MS).length;
                            const offlineCount = liveDevices.length - onlineCount;
                            console.log(`[GPSContext] ${liveDevices.length} vehicle(s) — ${onlineCount} online, ${offlineCount} offline`);

                            // Store recent readings for the feed table
                            setRecentReadings(liveDevices.map(d => ({ ...d.data, id: d.id })));

                            // ── Position history (only from online devices with valid GPS) ──
                            const fullHistory: Array<{ lat: number; lng: number; timestamp: number; tankerId?: string }> = [];
                            liveDevices.forEach(d => {
                                if (!d.data.gps) return;
                                const lat = parseFloat(String(d.data.gps.latitude));
                                const lng = parseFloat(String(d.data.gps.longitude));
                                if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;
                                if (lat < 23 || lat > 37 || lng < 60 || lng > 78) return;
                                fullHistory.push({ lat, lng, timestamp: d.lastSeen || now, tankerId: d.id });
                            });
                            fullHistory.sort((a, b) => a.timestamp - b.timestamp);
                            setPositionHistory(fullHistory);

                            // ── Build tanker objects ──
                            const newTankers: Tanker[] = [];

                            for (const device of liveDevices) {
                                const { id: deviceId, data, lastSeen } = device;

                                // ── Resolve name/driver from Firebase mapping, fallback to derived name ──
                                const mapping = mappingRef.current[deviceId];
                                const tankerId = mapping?.tankerId || deviceId;
                                const tankerName = mapping?.tankerName || fallbackTankerName(deviceId);
                                const driverName = mapping?.driver || 'Unassigned';

                                const isOffline = lastSeen === 0 || (now - lastSeen) > OFFLINE_THRESHOLD_MS;

                                let calculatedSpeed = 0;
                                let calculatedBearing = 0;
                                const prev = prevDataRef.current.get(deviceId);
                                let currentLat = prev?.lat;
                                let currentLng = prev?.lng;
                                let lastAddress = prev?.address;
                                if (prev) calculatedBearing = prev.bearing;

                                // Validate GPS
                                const parsedLat = data.gps ? parseFloat(String(data.gps.latitude)) : NaN;
                                const parsedLng = data.gps ? parseFloat(String(data.gps.longitude)) : NaN;
                                const hasGPS = !isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0);

                                if (hasGPS) {
                                    currentLat = parsedLat;
                                    currentLng = parsedLng;
                                    lastAddress = `Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`;

                                    if (prev && !isOffline) {
                                        const dist = getDistanceFromLatLonInKm(prev.lat, prev.lng, currentLat, currentLng);
                                        const timeDiff = (now - prev.time) / 1000 / 3600;
                                        if (timeDiff > 0 && timeDiff < 1) {
                                            calculatedSpeed = dist / timeDiff;
                                        }
                                        if (calculatedSpeed > 150) calculatedSpeed = prev.speed;
                                        if (dist > 0.005) {
                                            calculatedBearing = getBearing(prev.lat, prev.lng, currentLat, currentLng);
                                        }
                                    }

                                    prevDataRef.current.set(deviceId, {
                                        lat: currentLat,
                                        lng: currentLng,
                                        time: now,
                                        speed: calculatedSpeed,
                                        bearing: calculatedBearing,
                                        address: lastAddress,
                                        geocodedLat: prev?.geocodedLat,
                                        geocodedLng: prev?.geocodedLng,
                                    });

                                    if (!isOffline) {
                                        speedHistoryRef.current = [
                                            ...speedHistoryRef.current.slice(-19),
                                            { time: now, speed: Math.round(calculatedSpeed) }
                                        ];
                                        setSpeedHistory([...speedHistoryRef.current]);
                                    }

                                    // Reverse geocode if moved >100m
                                    const geocodedPrev = prev?.geocodedLat != null ? { lat: prev.geocodedLat, lng: prev.geocodedLng! } : null;
                                    const movedEnough = !geocodedPrev || getDistanceFromLatLonInKm(geocodedPrev.lat, geocodedPrev.lng, currentLat, currentLng) > 0.1;
                                    if (movedEnough && !geocodePendingRef.current.has(deviceId)) {
                                        geocodePendingRef.current.add(deviceId);
                                        if (!geocoderRef.current) {
                                            geocoderRef.current = new google.maps.Geocoder();
                                        }
                                        const snapLat = currentLat;
                                        const snapLng = currentLng;
                                        geocoderRef.current.geocode({ location: { lat: snapLat, lng: snapLng } }, (results, status) => {
                                            geocodePendingRef.current.delete(deviceId);
                                            if (status === 'OK' && results?.[0]) {
                                                const addr = results[0].formatted_address;
                                                const entry = prevDataRef.current.get(deviceId);
                                                if (entry) {
                                                    entry.address = addr;
                                                    entry.geocodedLat = snapLat;
                                                    entry.geocodedLng = snapLng;
                                                }
                                                setTankers(prev => prev.map(t =>
                                                    t.id === deviceId ? { ...t, location: { ...t.location, address: addr } } : t
                                                ));
                                            }
                                        });
                                    }
                                } else if (prev) {
                                    calculatedSpeed = isOffline ? 0 : prev.speed;
                                }

                                const hasValidLocation = typeof currentLat === 'number' && typeof currentLng === 'number';

                                // Time since last data
                                const ageSec = lastSeen > 0 ? Math.round((now - lastSeen) / 1000) : null;
                                const ageLabel = ageSec !== null
                                    ? ageSec < 60 ? `${ageSec}s ago`
                                    : ageSec < 3600 ? `${Math.round(ageSec / 60)}m ago`
                                    : `${Math.round(ageSec / 3600)}h ago`
                                    : 'unknown';

                                console.log(
                                    `[GPSContext] ${tankerName} (${deviceId}): ` +
                                    `${isOffline ? 'OFFLINE' : 'ONLINE'} | ` +
                                    `Last seen: ${ageLabel} | ` +
                                    `${hasValidLocation ? `${currentLat!.toFixed(5)}, ${currentLng!.toFixed(5)}` : 'No GPS'} | ` +
                                    `RSSI: ${data.rssi ?? 'N/A'}`
                                );

                                // ── Write history to both legacy and organized paths ──
                                if (!isOffline && lastSeen > 0) {
                                    const historyEntry = {
                                        gps: data.gps || null,
                                        distance_cm: getFuelLevelCm(data),
                                        rssi: data.rssi ?? null,
                                        uptime_ms: data.uptime_ms ?? null,
                                        deviceId,
                                    };
                                    set(ref(rtdb, `tankers/${tankerId}/history/${lastSeen}`), historyEntry).catch(() => {});
                                    set(ref(rtdb, `fleet/${tankerId}/history/${lastSeen}`), historyEntry).catch(() => {});
                                }

                                // ── Update /fleet/{tankerId}/currentStatus ──
                                const tankerStatus = isOffline ? 'offline' : (hasValidLocation && calculatedSpeed > 2 ? 'moving' : 'idle');
                                update(ref(rtdb, `fleet/${tankerId}/currentStatus`), {
                                    online: !isOffline,
                                    status: tankerStatus,
                                    speed: isOffline ? 0 : Math.round(calculatedSpeed),
                                    fuelLevel: distanceToFuelPercent(getFuelLevelCm(data)),
                                    lastSeen: lastSeen || now,
                                    location: {
                                        lat: hasValidLocation ? currentLat! : 0,
                                        lng: hasValidLocation ? currentLng! : 0,
                                        address: hasValidLocation ? (lastAddress || '') : (isOffline ? 'Vehicle offline' : 'GPS not connected'),
                                    },
                                }).catch(() => {});

                                // ── Offline alert: fire once when device transitions to offline ──
                                if (isOffline && !offlineAlertedRef.current.has(deviceId)) {
                                    offlineAlertedRef.current.add(deviceId);
                                    const alertRef = push(ref(rtdb, `alerts/${tankerId}`));
                                    set(alertRef, {
                                        type: 'device_offline',
                                        deviceId,
                                        tankerName,
                                        timestamp: now,
                                        message: `${tankerName} went offline (last seen: ${ageLabel})`,
                                    }).catch(() => {});
                                } else if (!isOffline) {
                                    // Device is back online — clear the flag so we can alert again next time
                                    offlineAlertedRef.current.delete(deviceId);
                                }

                                // ── Reed Switch / Hatch alert: detect hatch open in unauthorized area ──
                                const hatches = parseHatches(data);
                                if (hatches.length > 0) {
                                    console.log(`[GPSContext] ${tankerName} hatches:`, hatches.map(h => `${h.label}=${h.open ? 'OPEN' : 'closed'}`).join(', '));
                                }
                                if (!isOffline && hasValidLocation && hatches.length > 0) {
                                    const { authorized } = isInAuthorizedZone(currentLat!, currentLng!);

                                    for (const hatch of hatches) {
                                        const alertKey = `${deviceId}::${hatch.id}`;

                                        if (hatch.open && !authorized && !hatchAlertedRef.current.has(alertKey)) {
                                            // Hatch opened in an UNAUTHORIZED area — fire critical alert
                                            hatchAlertedRef.current.add(alertKey);

                                            const hatchAlertMsg = `${tankerName} — ${hatch.label} OPENED in unauthorized area (${lastAddress || 'Unknown location'})`;

                                            // Write to RTDB /alerts/{tankerId}
                                            const rtdbAlertRef = push(ref(rtdb, `alerts/${tankerId}`));
                                            set(rtdbAlertRef, {
                                                type: 'hatch_open_unauthorized',
                                                deviceId,
                                                tankerName,
                                                hatchId: hatch.id,
                                                hatchLabel: hatch.label,
                                                timestamp: now,
                                                severity: 'critical',
                                                message: hatchAlertMsg,
                                                location: { lat: currentLat!, lng: currentLng! },
                                            }).catch(() => {});

                                            // Write to Firestore /alerts (so AlertsPage picks it up)
                                            addDoc(collection(db, 'alerts'), {
                                                type: 'hatch_open_unauthorized',
                                                tankerId,
                                                tankerName,
                                                deviceId,
                                                hatchId: hatch.id,
                                                hatchLabel: hatch.label,
                                                severity: 'critical',
                                                status: 'unacknowledged',
                                                timestamp: new Date(now).toISOString(),
                                                description: hatchAlertMsg,
                                                location: {
                                                    lat: currentLat!,
                                                    lng: currentLng!,
                                                    address: lastAddress || `Lat: ${currentLat!.toFixed(4)}, Lng: ${currentLng!.toFixed(4)}`,
                                                },
                                                sensorData: {
                                                    fuelLevel: distanceToFuelPercent(getFuelLevelCm(data)),
                                                    speed: Math.round(calculatedSpeed),
                                                    hatchId: hatch.id,
                                                    hatchLabel: hatch.label,
                                                    hatchStatus: 'OPEN',
                                                    allHatches: hatches.map(h => ({ id: h.id, label: h.label, open: h.open })),
                                                },
                                            }).catch((err) => console.error('[GPSContext] Failed to write hatch alert to Firestore:', err));

                                            console.warn(`[GPSContext] HATCH ALERT: ${hatchAlertMsg}`);
                                        } else if (!hatch.open && hatchAlertedRef.current.has(alertKey)) {
                                            // Hatch closed — clear the flag so we can alert again if reopened
                                            hatchAlertedRef.current.delete(alertKey);
                                        }
                                    }
                                }

                                newTankers.push({
                                    id: deviceId,
                                    name: tankerName,
                                    status: isOffline ? 'offline' : (hasValidLocation && calculatedSpeed > 2 ? 'moving' : 'idle'),
                                    speed: isOffline ? 0 : (hasValidLocation ? Math.round(calculatedSpeed) : 0),
                                    fuelLevel: distanceToFuelPercent(getFuelLevelCm(data)),
                                    fuelDistanceCm: getFuelLevelCm(data),
                                    loadWeight: 0,
                                    driver: driverName,
                                    driverContact: 'N/A',
                                    location: {
                                        lat: hasValidLocation ? currentLat! : 0,
                                        lng: hasValidLocation ? currentLng! : 0,
                                        address: hasValidLocation
                                            ? (lastAddress || 'Acquiring location...')
                                            : (isOffline ? 'Vehicle offline' : 'GPS not connected')
                                    },
                                    ignition: isOffline ? 'off' : 'on',
                                    lastUpdate: lastSeen > 0 ? new Date(lastSeen).toISOString() : new Date().toISOString(),
                                    alerts: [],
                                    routeDeviation: false,
                                    temperature: typeof data.temperature_c === 'number' ? data.temperature_c : undefined,
                                    altitude: 0,
                                    satellites: data.gps?.satellites ?? 0,
                                    fixQuality: data.gps?.status === 'OK' ? 1 : 0,
                                    hdop: 0,
                                    rssi: data.rssi,
                                    uptime: data.uptime_ms,
                                    bearing: hasValidLocation ? calculatedBearing : 0,
                                    hatches: parseHatches(data),
                                });
                            }

                            // Sort: online first, then by name
                            newTankers.sort((a, b) => {
                                if (a.status === 'offline' && b.status !== 'offline') return 1;
                                if (a.status !== 'offline' && b.status === 'offline') return -1;
                                return a.name.localeCompare(b.name);
                            });

                            setTankers(newTankers);
                            setLoading(false);
                        } catch (err) {
                            console.error('[GPSContext] Data processing error:', err);
                            setLoading(false);
                        }
                    }, (err) => {
                        console.error('[GPSContext] RTDB listener error:', err);
                        if (isMounted) {
                            setError('Connection Failed');
                            setLoading(false);
                        }
                    });
                } catch (err) {
                    console.error('[GPSContext] Setup error:', err);
                    setLoading(false);
                }
            } else {
                console.log('[GPSContext] User signed out');
                if (isMounted) {
                    setTankers([]);
                    setLoading(false);
                }
            }
        });

        return () => {
            isMounted = false;
            unsubscribeAuth();
            if (devicesRef) off(devicesRef);
            if (mapRef) off(mapRef);
            clearTimeout(safetyTimeout);
        };
    }, []);

    return (
        <GPSContext.Provider value={{ tankers, recentReadings, positionHistory, speedHistory, loading, error }}>
            {children}
        </GPSContext.Provider>
    );
}

export function useGPSData() {
    const context = useContext(GPSContext);
    if (context === undefined) {
        throw new Error('useGPSData must be used within a GPSProvider');
    }
    return context;
}
