import { useState, useEffect, useRef } from 'react';
import { Tanker, Route } from '../types';

interface DistanceEntry {
  tankerId: string;
  routeName: string;
  distanceText: string;
  durationText: string;
  distanceValue: number; // meters
  durationValue: number; // seconds
}

const RECALC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useDistanceMatrix(
  tankers: Tanker[],
  routes: Route[],
  enabled: boolean = true
) {
  const [matrix, setMatrix] = useState<DistanceEntry[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const serviceRef = useRef<google.maps.DistanceMatrixService | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || tankers.length === 0 || routes.length === 0) {
      return;
    }

    // Find tankers with assigned active routes
    const activePairs: Array<{ tanker: Tanker; route: Route }> = [];
    for (const route of routes) {
      if (route.assignedTanker && route.status === 'active') {
        const tanker = tankers.find(t => t.id === route.assignedTanker);
        if (tanker && tanker.status !== 'offline') {
          activePairs.push({ tanker, route });
        }
      }
    }

    if (activePairs.length === 0) return;

    function calculate() {
      if (activePairs.length === 0) return;

      if (!serviceRef.current) {
        serviceRef.current = new google.maps.DistanceMatrixService();
      }

      const origins = activePairs.map(p => ({
        lat: p.tanker.location.lat,
        lng: p.tanker.location.lng,
      }));

      const destinations = activePairs.map(p => ({
        lat: p.route.endLocation.lat,
        lng: p.route.endLocation.lng,
      }));

      setIsCalculating(true);
      serviceRef.current.getDistanceMatrix(
        {
          origins,
          destinations,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS,
          },
        },
        (response, status) => {
          setIsCalculating(false);
          if (status === 'OK' && response) {
            const entries: DistanceEntry[] = [];
            response.rows.forEach((row, i) => {
              const element = row.elements[i]; // diagonal: each tanker to its own destination
              if (element && element.status === 'OK') {
                entries.push({
                  tankerId: activePairs[i].tanker.id,
                  routeName: activePairs[i].route.name,
                  distanceText: element.distance?.text || '--',
                  durationText: (element as any).duration_in_traffic?.text || element.duration?.text || '--',
                  distanceValue: element.distance?.value || 0,
                  durationValue: (element as any).duration_in_traffic?.value || element.duration?.value || 0,
                });
              }
            });
            setMatrix(entries);
          }
        }
      );
    }

    calculate();
    intervalRef.current = setInterval(calculate, RECALC_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tankers.length, routes.length, enabled]);

  return { matrix, isCalculating };
}
