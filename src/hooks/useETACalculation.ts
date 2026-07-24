import { useState, useEffect, useRef } from 'react';

interface ETAResult {
  distanceRemaining: number; // km
  durationRemaining: number; // minutes
}

const RECALC_INTERVAL = 60_000; // 60 seconds
const MIN_MOVEMENT = 0.5; // km — only recalculate if moved this far

function getDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useETACalculation(
  tankerPosition: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number } | null,
  tankerStatus?: string,
  enabled: boolean = true
) {
  const [eta, setEta] = useState<ETAResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const directionsRef = useRef<google.maps.DirectionsService | null>(null);
  const lastCalcPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !tankerPosition || !destination) {
      setEta(null);
      return;
    }

    // Skip if tanker is not actively moving
    if (tankerStatus === 'offline' || tankerStatus === 'parked') {
      return;
    }

    function calculate() {
      if (!tankerPosition || !destination) return;

      // Skip if haven't moved enough since last calculation
      if (lastCalcPositionRef.current) {
        const moved = getDistanceKm(lastCalcPositionRef.current, tankerPosition);
        if (moved < MIN_MOVEMENT && eta !== null) return;
      }

      if (!directionsRef.current) {
        directionsRef.current = new google.maps.DirectionsService();
      }

      setIsCalculating(true);
      directionsRef.current.route(
        {
          origin: tankerPosition,
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          setIsCalculating(false);
          if (status === google.maps.DirectionsStatus.OK && result) {
            const leg = result.routes[0].legs[0];
            const distKm = Math.round((leg.distance?.value || 0) / 1000);
            const durMin = Math.round((leg.duration?.value || 0) / 60);
            setEta({ distanceRemaining: distKm, durationRemaining: durMin });
            lastCalcPositionRef.current = { ...tankerPosition };
          }
        }
      );
    }

    // Initial calculation
    calculate();

    // Recalculate periodically
    intervalRef.current = setInterval(calculate, RECALC_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tankerPosition?.lat, tankerPosition?.lng, destination?.lat, destination?.lng, enabled, tankerStatus]);

  return { eta, isCalculating };
}
