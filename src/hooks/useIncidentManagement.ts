import { useState, useEffect, useCallback } from 'react';
import type { WithId, IncidentDoc, IncidentNote } from '../types/database';
import {
  createIncident,
  getIncident,
  updateIncident,
  addIncidentNote,
  subscribeIncidents,
  resolveIncident,
} from '../services/firebaseService';

interface UseIncidentManagementOptions {
  tankerId?: string;
}

export function useIncidentManagement(options?: UseIncidentManagementOptions) {
  const [incidents, setIncidents] = useState<WithId<IncidentDoc>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tankerId = options?.tankerId;

  useEffect(() => {
    const queryOptions = {
      orderByField: 'timestamp' as const,
      orderDirection: 'desc' as const,
      filters: tankerId
        ? [{ field: 'tankerId', operator: '==' as const, value: tankerId }]
        : [],
    };

    const unsubscribe = subscribeIncidents(
      (fetched) => {
        setIncidents(fetched);
        setLoading(false);
        setError(null);
      },
      queryOptions
    );
    return () => unsubscribe();
  }, [tankerId]);

  const openIncidents = incidents.filter(
    (i) => i.status === 'reported' || i.status === 'investigating'
  );

  const reportIncident = useCallback(async (data: Omit<IncidentDoc, 'createdAt' | 'updatedAt'>) => {
    const result = await createIncident(data);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  const editIncident = useCallback(async (id: string, data: Partial<IncidentDoc>) => {
    const result = await updateIncident(id, data);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const addNote = useCallback(async (incidentId: string, note: IncidentNote) => {
    const result = await addIncidentNote(incidentId, note);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const resolve = useCallback(async (incidentId: string, userId: string) => {
    const result = await resolveIncident(incidentId, userId);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const fetchIncident = useCallback(async (incidentId: string) => {
    const result = await getIncident(incidentId);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  return {
    incidents,
    openIncidents,
    loading,
    error,
    reportIncident,
    editIncident,
    addNote,
    resolve,
    fetchIncident,
    clearError: useCallback(() => setError(null), []),
  };
}
