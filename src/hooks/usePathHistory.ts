import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
  HistoricalGPSPoint,
  PathSegment,
  StopMarkerData,
  PathSummary,
  PathTimeRange,
} from '../types/tracking';

const TIME_RANGE_MS: Record<PathTimeRange, number> = {
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const MIN_STOP_DURATION = 5 * 60 * 1000; // 5 minutes

/** Parse Firestore Timestamp, ISO string, or numeric ms to epoch ms */
function toEpochMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

/** Haversine distance in km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildSegments(points: HistoricalGPSPoint[]): PathSegment[] {
  if (points.length < 2) return [];

  const segments: PathSegment[] = [];
  let currentStatus = points[0].status;
  let currentPath: Array<{ lat: number; lng: number }> = [
    { lat: points[0].lat, lng: points[0].lng },
  ];

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt.status === currentStatus) {
      currentPath.push({ lat: pt.lat, lng: pt.lng });
    } else {
      // Bridge: add first point of next segment to current for continuity
      currentPath.push({ lat: pt.lat, lng: pt.lng });
      segments.push({ path: currentPath, status: currentStatus });
      currentStatus = pt.status;
      currentPath = [{ lat: pt.lat, lng: pt.lng }];
    }
  }

  if (currentPath.length >= 1) {
    segments.push({ path: currentPath, status: currentStatus });
  }

  return segments;
}

function detectStops(points: HistoricalGPSPoint[]): StopMarkerData[] {
  const stops: StopMarkerData[] = [];
  let stopStart: number | null = null;
  let stopLat = 0;
  let stopLng = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.status === 'stopped') {
      if (stopStart === null) {
        stopStart = i;
        stopLat = pt.lat;
        stopLng = pt.lng;
      }
    } else {
      if (stopStart !== null) {
        const duration = points[i - 1].timestamp - points[stopStart].timestamp;
        if (duration >= MIN_STOP_DURATION) {
          stops.push({
            id: `stop-${stopStart}`,
            lat: stopLat,
            lng: stopLng,
            duration,
            startTime: points[stopStart].timestamp,
            endTime: points[i - 1].timestamp,
          });
        }
        stopStart = null;
      }
    }
  }

  // Handle if path ends in a stop
  if (stopStart !== null && points.length > 0) {
    const duration = points[points.length - 1].timestamp - points[stopStart].timestamp;
    if (duration >= MIN_STOP_DURATION) {
      stops.push({
        id: `stop-${stopStart}`,
        lat: stopLat,
        lng: stopLng,
        duration,
        startTime: points[stopStart].timestamp,
        endTime: points[points.length - 1].timestamp,
      });
    }
  }

  return stops;
}

function computeSummary(points: HistoricalGPSPoint[], stops: StopMarkerData[]): PathSummary {
  if (points.length < 2) {
    return { totalDistance: 0, totalDuration: 0, avgSpeed: 0, maxSpeed: 0, stopCount: 0, totalStopTime: 0 };
  }

  let totalDistance = 0;
  let maxSpeed = 0;

  for (let i = 1; i < points.length; i++) {
    const segDist = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    // Only count segment if implied speed is reasonable (< 150 km/h)
    const timeDiffH = (points[i].timestamp - points[i - 1].timestamp) / 3600000;
    const segSpeed = timeDiffH > 0 ? segDist / timeDiffH : 0;
    if (segSpeed <= 150) {
      totalDistance += segDist;
    }
    // Use the stored (already capped) speed for max
    if (points[i].speed > maxSpeed) maxSpeed = points[i].speed;
  }

  const totalDuration = points[points.length - 1].timestamp - points[0].timestamp;
  const totalStopTime = stops.reduce((sum, s) => sum + s.duration, 0);
  const movingDuration = totalDuration - totalStopTime;
  const avgSpeed = movingDuration > 0 ? totalDistance / (movingDuration / 3600000) : 0;

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDuration,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    stopCount: stops.length,
    totalStopTime,
  };
}

export function usePathHistory(
  vehicleId: string | null,
  timeRange: PathTimeRange,
  enabled: boolean
) {
  const [points, setPoints] = useState<HistoricalGPSPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vehicleId || !enabled) {
      setPoints([]);
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      try {
        const startTime = Date.now() - TIME_RANGE_MS[timeRange];
        const historyRef = collection(db, `gps_history/${vehicleId}/points`);
        const q = query(
          historyRef,
          where('timestamp', '>=', startTime),
          orderBy('timestamp', 'asc')
        );

        const snapshot = await getDocs(q);

        if (cancelled) return;

        let fetched: HistoricalGPSPoint[] = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            lat: d.lat ?? d.latitude ?? 0,
            lng: d.lng ?? d.longitude ?? 0,
            speed: d.speed ?? 0,
            heading: d.heading ?? d.bearing ?? 0,
            status: d.status ?? (d.speed > 5 ? 'moving' : d.speed > 0.5 ? 'idle' : 'stopped'),
            timestamp: d.timestamp ?? 0,
            routeId: d.routeId,
            offline: d.offline ?? false,
          };
        }).filter(p => p.lat !== 0 || p.lng !== 0);

        // Fallback: if gps_history is empty, try the sensors collection
        if (fetched.length === 0) {
          console.log('[usePathHistory] No gps_history data, falling back to sensors collection...');
          try {
            const sensorsRef = collection(db, 'sensors');
            const sensorsSnap = await getDocs(query(sensorsRef, orderBy('timestamp', 'asc')));

            // Step 1: Parse raw lat/lng from each sensor doc, validate coordinates
            const rawPoints: Array<{ lat: number; lng: number; timestamp: number }> = [];

            sensorsSnap.docs.forEach(sDoc => {
              const d = sDoc.data();
              const ts = toEpochMs(d.timestamp);
              if (ts < startTime || ts === 0) return;

              const lat = parseFloat(String(d.gps?.latitude ?? 0));
              const lng = parseFloat(String(d.gps?.longitude ?? 0));

              // Skip invalid / null-island coordinates
              if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

              // Skip coordinates outside Pakistan bounds (lat 23-37, lng 60-78)
              if (lat < 23 || lat > 37 || lng < 60 || lng > 78) return;

              rawPoints.push({ lat, lng, timestamp: ts });
            });

            // Step 2: Sort by timestamp
            rawPoints.sort((a, b) => a.timestamp - b.timestamp);

            // Step 3: Remove duplicate timestamps (keep first occurrence)
            const dedupedPoints: typeof rawPoints = [];
            for (const pt of rawPoints) {
              if (dedupedPoints.length === 0 || pt.timestamp !== dedupedPoints[dedupedPoints.length - 1].timestamp) {
                dedupedPoints.push(pt);
              }
            }

            // Step 4: Filter out GPS noise — discard points that imply speed > 120 km/h
            const MAX_SPEED_KMH = 120;
            const cleanPoints: typeof dedupedPoints = [];

            for (const pt of dedupedPoints) {
              if (cleanPoints.length === 0) {
                cleanPoints.push(pt);
                continue;
              }

              const prev = cleanPoints[cleanPoints.length - 1];
              const dist = haversine(prev.lat, prev.lng, pt.lat, pt.lng);
              const timeDiffHours = (pt.timestamp - prev.timestamp) / 3600000;

              // Skip if time diff is zero or negative
              if (timeDiffHours <= 0) continue;

              const impliedSpeed = dist / timeDiffHours;

              // If implied speed is reasonable, keep the point
              if (impliedSpeed <= MAX_SPEED_KMH) {
                cleanPoints.push(pt);
              }
              // Otherwise skip it — it's GPS noise
            }

            // Step 5: Build HistoricalGPSPoints with calculated speed
            const sensorPoints: HistoricalGPSPoint[] = cleanPoints.map((pt, i) => {
              let speed = 0;

              if (i > 0) {
                const prev = cleanPoints[i - 1];
                const dist = haversine(prev.lat, prev.lng, pt.lat, pt.lng);
                const timeDiffHours = (pt.timestamp - prev.timestamp) / 3600000;
                if (timeDiffHours > 0) {
                  speed = Math.min(Math.round(dist / timeDiffHours), MAX_SPEED_KMH);
                }
              }

              const status: 'moving' | 'idle' | 'stopped' =
                speed > 5 ? 'moving' : speed > 0.5 ? 'idle' : 'stopped';

              return {
                lat: pt.lat,
                lng: pt.lng,
                speed,
                heading: 0,
                status,
                timestamp: pt.timestamp,
                offline: false,
              };
            });

            // First point inherits from second
            if (sensorPoints.length > 1) {
              sensorPoints[0].status = sensorPoints[1].status;
              sensorPoints[0].speed = sensorPoints[1].speed;
            }

            console.log(`[usePathHistory] Loaded ${sensorPoints.length} clean points from sensors (${dedupedPoints.length - cleanPoints.length} outliers removed)`);
            fetched = sensorPoints;
          } catch (fallbackErr) {
            console.error('[usePathHistory] Sensors fallback failed:', fallbackErr);
          }
        }

        setPoints(fetched);
      } catch (err) {
        console.error('Error fetching GPS history:', err);
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [vehicleId, timeRange, enabled]);

  const segments = useMemo(() => buildSegments(points), [points]);
  const stops = useMemo(() => detectStops(points), [points]);
  const summary = useMemo(() => computeSummary(points, stops), [points, stops]);

  return { points, segments, stops, summary, loading };
}
