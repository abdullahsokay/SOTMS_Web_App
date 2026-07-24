import { useState, useEffect, useCallback } from 'react';
import type { WithId, DeviceDoc } from '../types/database';
import {
  createDevice,
  getDevice,
  updateDevice,
  deleteDevice,
  subscribeDevices,
  getDevicesByTanker,
  updateDeviceStatus,
} from '../services/firebaseService';

export function useDeviceManagement() {
  const [devices, setDevices] = useState<WithId<DeviceDoc>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeDevices(
      (fetched) => {
        setDevices(fetched);
        setLoading(false);
        setError(null);
      },
      { orderByField: 'createdAt', orderDirection: 'desc' }
    );
    return () => unsubscribe();
  }, []);

  const addDevice = useCallback(async (data: Omit<DeviceDoc, 'createdAt' | 'updatedAt'>) => {
    const result = await createDevice(data);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  const editDevice = useCallback(async (id: string, data: Partial<DeviceDoc>) => {
    const result = await updateDevice(id, data);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const removeDevice = useCallback(async (id: string) => {
    const result = await deleteDevice(id);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const fetchDevice = useCallback(async (id: string) => {
    const result = await getDevice(id);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }, []);

  const getDevicesForTanker = useCallback(async (tankerId: string) => {
    const result = await getDevicesByTanker(tankerId);
    if (result.error) {
      setError(result.error.message);
      return [];
    }
    return result.data;
  }, []);

  const setDeviceOnline = useCallback(async (id: string, battery: number) => {
    const result = await updateDeviceStatus(id, 'online', battery);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  const setDeviceOffline = useCallback(async (id: string) => {
    const result = await updateDeviceStatus(id, 'offline');
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    return true;
  }, []);

  return {
    devices,
    loading,
    error,
    addDevice,
    editDevice,
    removeDevice,
    fetchDevice,
    getDevicesForTanker,
    setDeviceOnline,
    setDeviceOffline,
    clearError: useCallback(() => setError(null), []),
  };
}
