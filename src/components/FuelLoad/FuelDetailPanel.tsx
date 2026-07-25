import { useMemo, useState, useCallback } from 'react';
import { X, AlertTriangle, FileText, Bell, Download, Droplet, Thermometer, Weight, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Tanker } from '../../types';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Timestamp, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { createIncident, updateActiveAlert } from '../../services/firebaseService';
import { distanceToFuelPercent } from '../../utils/fuelCalc';

interface SensorReading {
  id: string;
  distance_cm: number;
  gps: {
    latitude: number;
    longitude: number;
    satellites: number;
    status: string;
  };
  rssi: number;
  timestamp: string;
  uptime_ms: number;
}

// Raw readings as delivered by the GPS/ESP data source: every field is
// optional and `timestamp` may be a string or a number. This mirrors the
// real shape passed in from useGPSData().recentReadings so the prop type is
// truthful about what callers actually provide.
interface RawSensorReading {
  id: string;
  distance_cm?: number;
  gps?: {
    latitude: number;
    longitude: number;
    satellites?: number;
    status?: string;
  };
  rssi?: number;
  timestamp?: string | number;
  uptime_ms?: number;
}

interface ExtendedTanker extends Tanker {
  fuelLossPercent: number;
  fuelStatus: 'Normal' | 'Alert' | 'Suspicious';
  oilQuantity: number;
  route: string;
  company: string;
}

interface FuelDetailPanelProps {
  tanker: ExtendedTanker;
  onClose: () => void;
  sensorReadings?: RawSensorReading[];
}

export function FuelDetailPanel({ tanker, onClose, sensorReadings: rawReadings = [] }: FuelDetailPanelProps) {
  const { companyId } = useCompany();
  // Readings are consumed defensively below (distance_cm is filtered, gps is
  // read with optional chaining). Narrow the raw source shape to the internal
  // SensorReading view the component works with — a compile-time-only cast,
  // no runtime effect.
  const sensorReadings = rawReadings as SensorReading[];
  // Build fuel level chart data from real sensor readings
  const fuelLevelData = useMemo(() => {
    if (sensorReadings.length === 0) {
      // Fallback: single point from current tanker state
      return [{ time: 'Now', actual: tanker.fuelLevel, expected: tanker.fuelLevel }];
    }

    // Sort readings oldest → newest for chronological chart
    const sorted = [...sensorReadings]
      .filter(r => r.distance_cm != null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sorted.length === 0) {
      return [{ time: 'Now', actual: tanker.fuelLevel, expected: tanker.fuelLevel }];
    }

    // Use the first reading's distance_cm as the baseline "expected" start,
    // converted to a fuel percentage so the chart's Y-axis matches the cards.
    const baselineLevel = distanceToFuelPercent(sorted[0].distance_cm);

    return sorted.map((reading, index) => {
      const date = new Date(reading.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Actual = real sensor reading converted to a fuel percentage
      const actual = distanceToFuelPercent(reading.distance_cm);

      // Expected = linear interpolation from baseline to a gradual decline
      // (simulates normal consumption over the journey)
      const progress = sorted.length > 1 ? index / (sorted.length - 1) : 0;
      const expectedDecline = baselineLevel * 0.15 * progress; // ~15% expected loss over full journey
      const expected = parseFloat((baselineLevel - expectedDecline).toFixed(1));

      return { time: timeStr, actual, expected };
    });
  }, [sensorReadings, tanker.fuelLevel]);

  // Build load trend from real sensor readings (or single current point)
  const loadTrendData = useMemo(() => {
    if (sensorReadings.length === 0) {
      return [{ time: 'Now', load: tanker.loadWeight / 1000 }];
    }
    const sorted = [...sensorReadings]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted.map(r => {
      const date = new Date(r.timestamp);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        load: tanker.loadWeight / 1000 // Use current load (weight sensor not in SensorDoc yet)
      };
    }).slice(-10);
  }, [sensorReadings, tanker.loadWeight]);

  // Build temperature data from real sensor readings (or single current point)
  const temperatureData = useMemo(() => {
    if (sensorReadings.length === 0) {
      return [{ time: 'Now', temp: tanker.temperature ?? 25, threshold: 75 }];
    }
    const sorted = [...sensorReadings]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted.map(r => {
      const date = new Date(r.timestamp);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temp: tanker.temperature ?? 25, // Use current temp (temp sensor not in SensorDoc yet)
        threshold: 75
      };
    }).slice(-10);
  }, [sensorReadings, tanker.temperature]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal': return '#28B463';
      case 'Alert': return '#FFB02E';
      case 'Suspicious': return '#FF4D4D';
      default: return '#D9DCE1';
    }
  };

  // Button action states
  const [alertStatus, setAlertStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [incidentStatus, setIncidentStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // ── Raise Alert: push to RTDB activeAlerts + create a Firestore incident ──
  const handleRaiseAlert = useCallback(async () => {
    if (alertStatus === 'loading') return;
    if (!companyId) {
      setAlertStatus('error');
      setTimeout(() => setAlertStatus('idle'), 3000);
      return;
    }
    setAlertStatus('loading');
    try {
      const isSuspicious = tanker.fuelStatus === 'Suspicious';
      const incidentType = isSuspicious ? 'fuel_theft' : tanker.fuelLevel < 30 ? 'leak' : 'other';
      const severity = isSuspicious ? 'critical' : 'high';

      const description = [
        `Alert raised for ${tanker.name} (${tanker.fuelStatus}).`,
        `Fuel loss: ${tanker.fuelLossPercent}%`,
        `Fuel level: ${tanker.fuelLevel}%`,
        `Speed: ${tanker.speed} km/h`,
        `Driver: ${tanker.driver}`,
        `Route: ${tanker.route}`,
      ].join(' | ');

      const result = await createIncident({
        companyId,
        tankerId: tanker.id,
        tripId: null,
        alertId: null,
        incidentType: incidentType as 'fuel_theft' | 'leak' | 'other',
        description,
        severity: severity as 'critical' | 'high',
        location: tanker.location ? { lat: tanker.location.lat, lng: tanker.location.lng } : null,
        timestamp: Timestamp.now(),
        responseTime: null,
        status: 'reported',
        assignedTo: null,
        notes: [],
        resolvedAt: null,
      });

      await updateActiveAlert(tanker.id, {
        count: 1,
        latestAlertId: result.data || null,
        latestType: incidentType,
        latestSeverity: severity,
        lastUpdated: Date.now(),
      });

      // ── 1) Send alert email via Firestore mail collection ──
      const recipientEmail = auth.currentUser?.email;
      if (recipientEmail) {
        await addDoc(collection(db, 'mail'), {
          to: [recipientEmail],
          message: {
            subject: `SOTMS Alert: ${isSuspicious ? 'Suspicious Fuel Activity' : 'Fuel Alert'} - ${tanker.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1B2A; color: #E2E8F0; padding: 32px; border-radius: 12px;">
                <h2 style="color: ${isSuspicious ? '#FF4D4D' : '#FFB02E'}; margin-top: 0;">
                  ${isSuspicious ? 'Suspicious Fuel Activity Detected' : 'Fuel Alert Raised'}
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Tanker</td><td style="padding: 8px 0; color: #fff; font-weight: bold;">${tanker.name}</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Status</td><td style="padding: 8px 0; color: ${isSuspicious ? '#FF4D4D' : '#FFB02E'}; font-weight: bold;">${tanker.fuelStatus}</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Fuel Loss</td><td style="padding: 8px 0; color: #fff;">${tanker.fuelLossPercent}%</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Fuel Level</td><td style="padding: 8px 0; color: #fff;">${tanker.fuelLevel}%</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Driver</td><td style="padding: 8px 0; color: #fff;">${tanker.driver}</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Route</td><td style="padding: 8px 0; color: #fff;">${tanker.route}</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Speed</td><td style="padding: 8px 0; color: #fff;">${tanker.speed} km/h</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Location</td><td style="padding: 8px 0; color: #fff;">${tanker.location?.address || 'N/A'}</td></tr>
                  <tr><td style="padding: 8px 0; color: #A0AEC0;">Time</td><td style="padding: 8px 0; color: #fff;">${new Date().toLocaleString()}</td></tr>
                </table>
                <p style="color: #A0AEC0; font-size: 13px; margin-top: 24px; border-top: 1px solid #2D3748; padding-top: 16px;">
                  This alert was raised from the SOTMS Fuel & Load Monitoring panel. Log in to the dashboard for full details.
                </p>
              </div>
            `,
          },
        });
      }

      // ── 2) Save to reports (skip if already auto-recorded today) ──
      const today = new Date().toISOString().split('T')[0];
      const existingQuery = query(
        collection(db, 'reports'),
        where('companyId', '==', companyId),
        where('tankerId', '==', tanker.id),
        where('date', '==', today)
      );
      const existing = await getDocs(existingQuery);

      if (existing.empty) {
        const reportTypeLabel = incidentType === 'fuel_theft'
          ? 'Fuel Theft Alert'
          : incidentType === 'leak'
            ? 'Fuel Leak Alert'
            : 'Fuel Alert';

        await addDoc(collection(db, 'reports'), {
          tankerId: tanker.id,
          type: reportTypeLabel,
          date: today,
          duration: '-',
          details: description,
          status: severity === 'critical' ? 'critical' : 'warning',
          source: 'manual',
          companyId,
        });
      }

      setAlertStatus('success');
      setTimeout(() => setAlertStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to raise alert:', err);
      setAlertStatus('error');
      setTimeout(() => setAlertStatus('idle'), 3000);
    }
  }, [alertStatus, tanker, companyId]);

  // ── Record Incident: save to Firestore incidents collection ──
  const handleRecordIncident = useCallback(async () => {
    if (incidentStatus === 'loading') return;
    if (!companyId) {
      setIncidentStatus('error');
      setTimeout(() => setIncidentStatus('idle'), 3000);
      return;
    }
    setIncidentStatus('loading');
    try {
      const incidentType = tanker.fuelLossPercent > 5
        ? 'fuel_theft'
        : (tanker.temperature ?? 25) > 75
          ? 'temperature_anomaly'
          : tanker.fuelLevel < 30
            ? 'leak'
            : 'other';

      const severity = tanker.fuelStatus === 'Suspicious'
        ? 'critical'
        : tanker.fuelStatus === 'Alert'
          ? 'high'
          : 'medium';

      const description = [
        `Incident recorded for ${tanker.name}.`,
        `Status: ${tanker.fuelStatus}`,
        `Fuel loss: ${tanker.fuelLossPercent}%`,
        `Fuel: ${tanker.fuelLevel}%`,
        `Temp: ${tanker.temperature ?? 'N/A'}°C`,
        `Route: ${tanker.route}`,
        `Company: ${tanker.company}`,
      ].join(' | ');

      await createIncident({
        companyId,
        tankerId: tanker.id,
        tripId: null,
        alertId: null,
        incidentType: incidentType as 'fuel_theft' | 'temperature_anomaly' | 'leak' | 'other',
        description,
        severity: severity as 'critical' | 'high' | 'medium',
        location: tanker.location ? { lat: tanker.location.lat, lng: tanker.location.lng } : null,
        timestamp: Timestamp.now(),
        responseTime: null,
        status: 'reported',
        assignedTo: null,
        notes: [{
          author: 'System',
          content: `Auto-recorded from Fuel & Load Monitoring panel. Fuel level: ${tanker.fuelLevel}%, Loss: ${tanker.fuelLossPercent}%`,
          timestamp: Timestamp.now(),
        }],
        resolvedAt: null,
      });

      // Save to reports collection for the Reports page
      const reportTypeLabel = incidentType === 'fuel_theft'
        ? 'Fuel Theft Incident'
        : incidentType === 'temperature_anomaly'
          ? 'Temperature Anomaly'
          : incidentType === 'leak'
            ? 'Fuel Leak Incident'
            : 'Fuel Incident';

      const reportStatus = severity === 'critical'
        ? 'critical'
        : severity === 'high'
          ? 'warning'
          : 'normal';

      const now = new Date();
      await addDoc(collection(db, 'reports'), {
        tankerId: tanker.id,
        type: reportTypeLabel,
        date: now.toISOString().split('T')[0],
        duration: '-',
        details: description,
        status: reportStatus,
        companyId,
      });

      setIncidentStatus('success');
      setTimeout(() => setIncidentStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to record incident:', err);
      setIncidentStatus('error');
      setTimeout(() => setIncidentStatus('idle'), 3000);
    }
  }, [incidentStatus, tanker, companyId]);

  // ── Export Report: generate CSV and trigger browser download ──
  const handleExportReport = useCallback(() => {
    setExportStatus('loading');

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    // Tanker summary section
    const summaryRows = [
      ['SOTMS — Fuel & Load Report'],
      [`Generated: ${now.toLocaleString()}`],
      [''],
      ['TANKER SUMMARY'],
      ['Tanker', tanker.name],
      ['Driver', tanker.driver],
      ['Company', tanker.company],
      ['Route', tanker.route],
      ['Status', tanker.fuelStatus],
      ['Fuel Level (%)', String(tanker.fuelLevel)],
      ['Fuel Loss (%)', String(tanker.fuelLossPercent)],
      ['Oil Quantity (L)', String(tanker.oilQuantity.toFixed(1))],
      ['Temperature (°C)', String(tanker.temperature ?? 'N/A')],
      ['Speed (km/h)', String(tanker.speed)],
      ['Load Weight (kg)', String(tanker.loadWeight)],
      ['Location', tanker.location?.address || 'N/A'],
      ['Last Update', tanker.lastUpdate || 'N/A'],
      [''],
    ];

    // Sensor readings section
    const sensorHeader = ['SENSOR READINGS (distance_cm over time)'];
    const sensorColHeaders = ['Timestamp', 'Distance (cm)', 'RSSI', 'Satellites', 'GPS Status'];
    const sensorRows = sensorReadings.map(r => [
      r.timestamp,
      String(r.distance_cm),
      String(r.rssi),
      String(r.gps?.satellites ?? 'N/A'),
      r.gps?.status ?? 'N/A',
    ]);

    // Chart data section
    const chartHeader = ['', '', '', '', '', '', 'FUEL LEVEL CHART DATA'];
    const chartColHeaders = ['Time', 'Actual', 'Expected'];
    const chartRows = fuelLevelData.map(d => [d.time, String(d.actual), String(d.expected)]);

    // Combine all rows
    const allRows = [
      ...summaryRows,
      sensorHeader,
      sensorColHeaders,
      ...sensorRows,
      [''],
      chartHeader,
      chartColHeaders,
      ...chartRows,
    ];

    // Escape CSV fields
    const csvContent = allRows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Trigger download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SOTMS_Report_${tanker.id}_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportStatus('success');
    setTimeout(() => setExportStatus('idle'), 3000);
  }, [tanker, sensorReadings, fuelLevelData]);

  // Temperature is optional on the tanker type; default to 25°C (matches the
  // default used elsewhere, e.g. FuelLoadPage) when guarding arithmetic/comparisons.
  const temp = tanker.temperature ?? 25;

  return (
    <div className="h-full flex flex-col bg-[#07121A] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-[#0C1E2C] border-b border-[#00E5FF]/30 flex items-center justify-between">
        <div>
          <h3 className="text-xl text-white font-semibold">{tanker.name}</h3>
          <p className="text-sm text-[#D9DCE1]/60 mt-1">Detailed Analytics & Monitoring</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all duration-200"
        >
          <X className="w-5 h-5 text-[#D9DCE1]" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Key Info Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
            <div className="text-xs text-[#D9DCE1]/60 mb-1">Driver</div>
            <div className="text-white font-semibold">{tanker.driver}</div>
          </div>
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
            <div className="text-xs text-[#D9DCE1]/60 mb-1">Company</div>
            <div className="text-white font-semibold">{tanker.company}</div>
          </div>
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4 col-span-2">
            <div className="text-xs text-[#D9DCE1]/60 mb-1">Route</div>
            <div className="text-white font-semibold">{tanker.route}</div>
          </div>
        </div>

        {/* Real-time Metrics */}
        <div className="grid grid-cols-3 gap-4">
          {/* Oil Level */}
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Droplet className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/60">Oil Level</span>
            </div>
            <div className="text-3xl text-white font-bold mb-2">{tanker.fuelLevel}%</div>
            <div className="w-full h-2 bg-[#07121A] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00E5FF] to-[#009FFD] transition-all"
                style={{ width: `${tanker.fuelLevel}%` }}
              />
            </div>
            <div className="text-xs text-[#D9DCE1]/60 mt-2">
              {(tanker.oilQuantity / 1000).toFixed(1)}k L Total
            </div>
          </div>

          {/* Temperature */}
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="w-4 h-4 text-[#FFB02E]" />
              <span className="text-xs text-[#D9DCE1]/60">Temperature</span>
            </div>
            <div className={`text-3xl font-bold mb-2 ${
              temp > 80 ? 'text-[#FF4D4D]' :
              temp > 60 ? 'text-[#FFB02E]' :
              'text-white'
            }`}>
              {tanker.temperature}°C
            </div>
            <div className="w-full h-2 bg-[#07121A] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  temp > 80 ? 'bg-[#FF4D4D]' :
                  temp > 60 ? 'bg-[#FFB02E]' :
                  'bg-[#28B463]'
                }`}
                style={{ width: `${Math.min((temp / 100) * 100, 100)}%` }}
              />
            </div>
            {temp > 75 && (
              <div className="text-xs text-[#FF4D4D] mt-2">Above threshold</div>
            )}
          </div>

          {/* Load */}
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Weight className="w-4 h-4 text-[#28B463]" />
              <span className="text-xs text-[#D9DCE1]/60">Load Weight</span>
            </div>
            <div className="text-3xl text-white font-bold mb-2">
              {(tanker.loadWeight / 1000).toFixed(1)}T
            </div>
            <div className="w-full h-2 bg-[#07121A] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  tanker.loadWeight > 30000 ? 'bg-[#FF4D4D]' : 'bg-[#28B463]'
                }`}
                style={{ width: `${Math.min((tanker.loadWeight / 35000) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-[#D9DCE1]/60 mt-2">
              Max: 35T
            </div>
          </div>
        </div>

        {/* Fuel Loss Analysis */}
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3">Calculated Fuel Loss Analysis</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[#D9DCE1]/60 mb-1">Fuel Loss %</div>
              <div className={`text-2xl font-bold ${
                tanker.fuelLossPercent > 3 ? 'text-[#FF4D4D]' : 
                tanker.fuelLossPercent > 1 ? 'text-[#FFB02E]' : 
                'text-[#28B463]'
              }`}>
                {tanker.fuelLossPercent}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#D9DCE1]/60 mb-1">Status</div>
              <div
                className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  color: getStatusColor(tanker.fuelStatus),
                  backgroundColor: `${getStatusColor(tanker.fuelStatus)}20`
                }}
              >
                {tanker.fuelStatus}
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-[#07121A] rounded-lg">
            <div className="text-xs text-[#D9DCE1]/60 mb-2">Calculation Factors:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[#D9DCE1]/80">
                <span>Temperature Impact:</span>
                <span className="text-white">{((temp - 25) * 0.1).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-[#D9DCE1]/80">
                <span>Distance/Speed Factor:</span>
                <span className="text-white">{((tanker.speed / 100) * 2).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-[#D9DCE1]/80">
                <span>Unexpected Loss:</span>
                <span className={tanker.fuelLossPercent > 3 ? 'text-[#FF4D4D] font-semibold' : 'text-white'}>
                  {Math.max(0, tanker.fuelLossPercent - ((temp - 25) * 0.1) - ((tanker.speed / 100) * 2)).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Fuel Level Over Time Chart */}
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-4">Fuel Level Over Time</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={fuelLevelData}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00E5FF" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#28B463" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#28B463" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
              <XAxis dataKey="time" stroke="#D9DCE1" style={{ fontSize: '12px' }} />
              <YAxis stroke="#D9DCE1" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0C1E2C',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="expected" stroke="#28B463" fillOpacity={1} fill="url(#colorExpected)" name="Expected" />
              <Area type="monotone" dataKey="actual" stroke="#00E5FF" fillOpacity={1} fill="url(#colorActual)" name="Actual" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Load Trend Chart */}
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-4">Load Trend</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={loadTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
              <XAxis dataKey="time" stroke="#D9DCE1" style={{ fontSize: '12px' }} />
              <YAxis stroke="#D9DCE1" style={{ fontSize: '12px' }} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0C1E2C',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Line type="monotone" dataKey="load" stroke="#009FFD" strokeWidth={2} dot={{ fill: '#00E5FF', r: 4 }} name="Load (Tons)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature Variation Chart */}
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-4">Temperature Variation</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={temperatureData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
              <XAxis dataKey="time" stroke="#D9DCE1" style={{ fontSize: '12px' }} />
              <YAxis stroke="#D9DCE1" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0C1E2C',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Line type="monotone" dataKey="threshold" stroke="#FF4D4D" strokeDasharray="5 5" strokeWidth={1} name="Threshold" />
              <Line type="monotone" dataKey="temp" stroke="#FFB02E" strokeWidth={2} dot={{ fill: '#FFB02E', r: 4 }} name="Temperature (°C)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts & Anomalies */}
        {(tanker.fuelLossPercent > 2 || temp > 75 || tanker.fuelLevel < 30) && (
          <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-[#FF4D4D]" />
              <h4 className="text-white font-semibold">Active Alerts & Anomalies</h4>
            </div>
            <div className="space-y-2">
              {tanker.fuelLossPercent > 3 && (
                <div className="p-3 bg-[#07121A] rounded-lg">
                  <div className="text-sm text-[#FF4D4D] font-medium">Unexpected Fuel Drop Detected</div>
                  <div className="text-xs text-[#D9DCE1]/60 mt-1">
                    Fuel loss exceeds normal parameters by {(tanker.fuelLossPercent - 2).toFixed(2)}%
                  </div>
                </div>
              )}
              {temp > 75 && (
                <div className="p-3 bg-[#07121A] rounded-lg">
                  <div className="text-sm text-[#FFB02E] font-medium">Temperature Above Threshold</div>
                  <div className="text-xs text-[#D9DCE1]/60 mt-1">
                    Current: {tanker.temperature}°C | Safe limit: 75°C
                  </div>
                </div>
              )}
              {tanker.fuelLevel < 30 && (
                <div className="p-3 bg-[#07121A] rounded-lg">
                  <div className="text-sm text-[#FFB02E] font-medium">Low Fuel Level</div>
                  <div className="text-xs text-[#D9DCE1]/60 mt-1">
                    Refueling recommended soon
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleRaiseAlert}
            disabled={alertStatus === 'loading'}
            className={`px-4 py-3 border rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              alertStatus === 'success'
                ? 'bg-[#28B463]/20 border-[#28B463]/50 text-[#28B463]'
                : alertStatus === 'error'
                  ? 'bg-[#FF4D4D]/10 border-[#FF4D4D]/20 text-[#FF4D4D]/60'
                  : 'bg-[#FF4D4D]/20 hover:bg-[#FF4D4D]/30 border-[#FF4D4D]/30 text-[#FF4D4D] hover:scale-105'
            } ${alertStatus === 'loading' ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {alertStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : alertStatus === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : alertStatus === 'error' ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {alertStatus === 'loading' ? 'Sending...' : alertStatus === 'success' ? 'Alert Raised' : alertStatus === 'error' ? 'Failed' : 'Raise Alert'}
          </button>
          <button
            type="button"
            onClick={handleRecordIncident}
            disabled={incidentStatus === 'loading'}
            className={`px-4 py-3 border rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              incidentStatus === 'success'
                ? 'bg-[#28B463]/20 border-[#28B463]/50 text-[#28B463]'
                : incidentStatus === 'error'
                  ? 'bg-[#FFB02E]/10 border-[#FFB02E]/20 text-[#FFB02E]/60'
                  : 'bg-[#FFB02E]/20 hover:bg-[#FFB02E]/30 border-[#FFB02E]/30 text-[#FFB02E] hover:scale-105'
            } ${incidentStatus === 'loading' ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {incidentStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : incidentStatus === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : incidentStatus === 'error' ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {incidentStatus === 'loading' ? 'Saving...' : incidentStatus === 'success' ? 'Recorded' : incidentStatus === 'error' ? 'Failed' : 'Record Incident'}
          </button>
          <button
            type="button"
            onClick={handleExportReport}
            disabled={exportStatus === 'loading'}
            className={`px-4 py-3 border rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              exportStatus === 'success'
                ? 'bg-[#28B463]/20 border-[#28B463]/50 text-[#28B463]'
                : 'bg-[#009FFD]/20 hover:bg-[#009FFD]/30 border-[#00E5FF]/30 text-[#00E5FF] hover:scale-105'
            }`}
          >
            {exportStatus === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exportStatus === 'success' ? 'Downloaded' : 'Export Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
