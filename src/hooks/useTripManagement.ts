import { useState, useEffect, useCallback } from 'react';
import type { WithId, TripDoc, TripDeviation } from '../types/database';
import {
  createTrip,
  getTrip,
  updateTrip,
  subscribeTrips,
  startTrip,
  completeTrip,
  addTripDeviation,
} from '../services/firebaseService';

interface UseTripManagementOptions {
  tankerId?: string;
  driverId?: string;
}

export function useTripManagement(options?: UseTripManagementOptions) {
  const [trips, setTrips] = useState<WithId<TripDoc>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tankerId = options?.tankerId;
  const driverId = options?.driverId;

  useEffect(() => {
    const queryOptions = {
      orderByField: 'startTime' as const,
      orderDirection: 'desc' as const,
      filters: [
        ...(tankerId ? [{ field: 'tankerId', operator: '==' as const, value: tankerId }] : []),
        ...(driverId ? [{ field: 'driverId', operator: '==' as const, value: driverId }] : []),
      ],
    };

    const unsubscribe = subscribeTrips(
      (fetched) => {
        setTrips(fetched);
        setLoading(false);
        setError(null);
      },
      queryOptions
    );
    return () => unsubscribe();
  }, [tankerId, driverId]);

  const activeTrips = trips.filter(
    (t) => t.status === 'scheduled' || t.status === 'in_progress' || t.status === 'delayed'
  );

  const createNewTrip = useCallback(async (data: Omit<TripDoc, 'createdAt' | 'updatedAt'>) => {
    const result = await createTrip(data);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  const beginTrip = useCallback(async (tripId: string) => {
    const result = await startTrip(tripId);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const endTrip = useCallback(async (tripId: string, endFuelLevel: number, totalDistance: number) => {
    const result = await completeTrip(tripId, endFuelLevel, totalDistance);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const cancelTrip = useCallback(async (tripId: string) => {
    const result = await updateTrip(tripId, { status: 'cancelled' });
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const recordDeviation = useCallback(async (tripId: string, deviation: TripDeviation) => {
    const result = await addTripDeviation(tripId, deviation);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const fetchTrip = useCallback(async (tripId: string) => {
    const result = await getTrip(tripId);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  return {
    trips,
    activeTrips,
    loading,
    error,
    createNewTrip,
    beginTrip,
    endTrip,
    cancelTrip,
    recordDeviation,
    fetchTrip,
    clearError: useCallback(() => setError(null), []),
  };
}
