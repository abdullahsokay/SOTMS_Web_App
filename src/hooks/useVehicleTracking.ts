import { useState, useEffect, useRef } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../firebase';
import { TrackingStore, VehicleCurrentPosition, TrailPoint } from '../types/tracking';

const TRAIL_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const DEBOUNCE_MS = 200;

export function useVehicleTracking(enabled: boolean = true) {
  const [trackingData, setTrackingData] = useState<TrackingStore>({});
  const [isConnected, setIsConnected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTrackingData({});
      return;
    }

    const trackingRef = ref(rtdb, 'tracking');

    const unsubscribe = onValue(trackingRef, (snapshot) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        const raw = snapshot.val();
        if (!raw || typeof raw !== 'object') {
          setTrackingData({});
          setIsConnected(true);
          return;
        }

        const now = Date.now();
        const store: TrackingStore = {};

        for (const vehicleId of Object.keys(raw)) {
          const vehicleData = raw[vehicleId];
          if (!vehicleData?.current) continue;

          const current: VehicleCurrentPosition = {
            lat: Number(vehicleData.current.lat ?? vehicleData.current.latitude) || 0,
            lng: Number(vehicleData.current.lng ?? vehicleData.current.longitude) || 0,
            speed: Number(vehicleData.current.speed) || 0,
            bearing: Number(vehicleData.current.bearing ?? vehicleData.current.heading) || 0,
            timestamp: Number(vehicleData.current.timestamp ?? vehicleData.current.lastUpdate) || 0,
            driver: vehicleData.current.driver || undefined,
            vehicleId,
          };

          // Skip invalid positions
          if (current.lat === 0 && current.lng === 0) continue;

          // Parse trail, filter to last 15 minutes
          let trail: TrailPoint[] = [];
          if (vehicleData.trail) {
            const rawTrail = Array.isArray(vehicleData.trail)
              ? vehicleData.trail
              : Object.values(vehicleData.trail);
            trail = (rawTrail as any[])
              .filter((p: any) => p && typeof p.lat === 'number')
              .map((p: any) => ({
                lat: Number(p.lat),
                lng: Number(p.lng),
                speed: Number(p.speed) || 0,
                bearing: Number(p.bearing) || 0,
                timestamp: Number(p.timestamp) || 0,
              }))
              .filter((p: TrailPoint) => now - p.timestamp < TRAIL_MAX_AGE_MS)
              .sort((a: TrailPoint, b: TrailPoint) => a.timestamp - b.timestamp);
          }

          store[vehicleId] = { vehicleId, current, trail };
        }

        setTrackingData(store);
        setIsConnected(true);
      }, DEBOUNCE_MS);
    }, (error) => {
      console.error('[useVehicleTracking] RTDB error:', error);
      setIsConnected(false);
    });

    return () => {
      off(trackingRef);
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled]);

  return { trackingData, isConnected };
}
