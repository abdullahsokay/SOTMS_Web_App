import { useState, useEffect, useRef } from 'react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDZ0QE8_i8BorwZ1N2URBVenyqfxYPfvAg';
const BATCH_SIZE = 100;
const MIN_NEW_POINTS = 5; // Only re-snap when this many new points accumulate

// Module-level cache
let snappedCache: { inputHash: string; result: Array<{ lat: number; lng: number }> } | null = null;

function hashPoints(points: Array<{ lat: number; lng: number }>): string {
  // Hash based on count + first/last point coords
  if (points.length === 0) return 'empty';
  const first = points[0];
  const last = points[points.length - 1];
  return `${points.length}_${first.lat.toFixed(5)}_${first.lng.toFixed(5)}_${last.lat.toFixed(5)}_${last.lng.toFixed(5)}`;
}

async function snapBatch(points: Array<{ lat: number; lng: number }>): Promise<Array<{ lat: number; lng: number }>> {
  const path = points.map(p => `${p.lat},${p.lng}`).join('|');
  const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Roads API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.snappedPoints || data.snappedPoints.length === 0) {
    return points; // Return original if no snapped points
  }

  return data.snappedPoints.map((sp: { location: { latitude: number; longitude: number } }) => ({
    lat: sp.location.latitude,
    lng: sp.location.longitude,
  }));
}

export function useSnapToRoads(positionHistory: Array<{ lat: number; lng: number; timestamp?: number }>) {
  const [snappedPath, setSnappedPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const lastSnappedCountRef = useRef(0);

  useEffect(() => {
    if (positionHistory.length < 2) {
      setSnappedPath([]);
      return;
    }

    // Only re-snap if enough new points accumulated
    const newPointCount = positionHistory.length - lastSnappedCountRef.current;
    if (newPointCount < MIN_NEW_POINTS && snappedPath.length > 0) {
      return;
    }

    // Check cache
    const points = positionHistory.map(p => ({ lat: p.lat, lng: p.lng }));
    const hash = hashPoints(points);
    if (snappedCache && snappedCache.inputHash === hash) {
      setSnappedPath(snappedCache.result);
      return;
    }

    let cancelled = false;

    async function doSnap() {
      setIsSnapping(true);
      try {
        // Chunk into batches of BATCH_SIZE
        const allSnapped: Array<{ lat: number; lng: number }> = [];
        for (let i = 0; i < points.length; i += BATCH_SIZE) {
          const batch = points.slice(i, i + BATCH_SIZE);
          const snapped = await snapBatch(batch);
          if (cancelled) return;
          allSnapped.push(...snapped);
        }

        if (!cancelled) {
          snappedCache = { inputHash: hash, result: allSnapped };
          setSnappedPath(allSnapped);
          lastSnappedCountRef.current = positionHistory.length;
        }
      } catch (err) {
        console.warn('[SnapToRoads] Failed, using raw path:', err);
        if (!cancelled) {
          setSnappedPath(points); // Fallback to raw
        }
      } finally {
        if (!cancelled) setIsSnapping(false);
      }
    }

    doSnap();
    return () => { cancelled = true; };
  }, [positionHistory.length]); // Depend on length to avoid re-running on every reference change

  return { snappedPath, isSnapping };
}
