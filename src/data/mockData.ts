// ─────────────────────────────────────────────────────────────
// Mock data has been removed. All data now comes from Firebase
// in real-time via GPSContext and Firestore queries.
//
// These empty exports exist only for backward compatibility
// with test files that import them.
// ─────────────────────────────────────────────────────────────

import { Tanker, Alert, SensorData, Report, Route, BlackSpot } from '../types';

export const mockTankers: Tanker[] = [];

export const mockAlerts: Alert[] = [];

export const mockSensorData: SensorData = {
  temperature: 0,
  vibration: 0,
  gasLevel: 0
};

export const mockReports: Report[] = [];

export const fuelTrendData: { time: string; fuel: number }[] = [];

export const loadTrendData: { time: string; load: number }[] = [];

export const mockRoutes: Route[] = [];

export const mockBlackSpots: BlackSpot[] = [];
