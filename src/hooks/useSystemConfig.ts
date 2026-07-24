import { useState, useEffect, useCallback } from 'react';
import type { SystemConfigDoc } from '../types/database';
import {
  subscribeSystemConfig,
  updateSystemConfig,
} from '../services/firebaseService';

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfigDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSystemConfig((fetched) => {
      setConfig(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveConfig = useCallback(async (
    data: Partial<SystemConfigDoc>,
    userId: string
  ) => {
    const result = await updateSystemConfig(data, userId);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  return {
    config,
    loading,
    error,
    saveConfig,
    fuelTheftThreshold: config?.fuelTheft ?? null,
    temperatureThreshold: config?.temperature ?? null,
    routeDeviationThreshold: config?.routeDeviation ?? null,
    dataSyncConfig: config?.dataSync ?? null,
    clearError: useCallback(() => setError(null), []),
  };
}
