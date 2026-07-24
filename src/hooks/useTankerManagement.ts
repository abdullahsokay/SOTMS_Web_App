import { useState, useEffect, useCallback } from 'react';
import type { WithId, TankerDoc } from '../types/database';
import {
  createTanker,
  getTanker,
  updateTanker,
  deleteTanker,
  subscribeTankers,
} from '../services/firebaseService';

export function useTankerManagement() {
  const [tankers, setTankers] = useState<WithId<TankerDoc>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeTankers(
      (fetched) => {
        setTankers(fetched);
        setLoading(false);
        setError(null);
      },
      { orderByField: 'createdAt', orderDirection: 'desc' }
    );
    return () => unsubscribe();
  }, []);

  const addTanker = useCallback(async (data: Omit<TankerDoc, 'createdAt' | 'updatedAt'>) => {
    const result = await createTanker(data);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  const editTanker = useCallback(async (id: string, data: Partial<TankerDoc>) => {
    const result = await updateTanker(id, data);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const removeTanker = useCallback(async (id: string) => {
    const result = await deleteTanker(id);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const fetchTanker = useCallback(async (id: string) => {
    const result = await getTanker(id);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  return {
    tankers,
    loading,
    error,
    addTanker,
    editTanker,
    removeTanker,
    fetchTanker,
    clearError: useCallback(() => setError(null), []),
  };
}
