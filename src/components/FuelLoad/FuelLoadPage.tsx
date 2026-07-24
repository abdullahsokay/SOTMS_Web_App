import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, Download, AlertTriangle, TrendingUp, X, Bell, DoorOpen, Volume2, VolumeX, CheckCircle } from 'lucide-react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Tanker } from '../../types';
import { useGPSData } from '../../hooks/useGPSData';
import { useAlerts, FuelAlert } from '../../contexts/AlertsContext';
import { createIncident, updateActiveAlert } from '../../services/firebaseService';
import { FuelOverviewTable } from './FuelOverviewTable';
import { FuelDetailPanel } from './FuelDetailPanel';
import { PageHeader } from '../Layout/PageHeader';

interface ExtendedTanker extends Tanker {
  fuelLossPercent: number;
  fuelStatus: 'Normal' | 'Alert' | 'Suspicious';
  oilQuantity: number;
  company: string;
  route: string;
}

export function FuelLoadPage() {
  const { tankers, recentReadings } = useGPSData();
  // Hatch-breach detection, alert state, and the audible alarm now live in the
  // global AlertsProvider so they survive navigation away from this page.
  const { hatchAlerts, acknowledgeAllHatchAlerts, acknowledgeHatchAlert, alarmMuted, setAlarmMuted } = useAlerts();
  const [selectedTanker, setSelectedTanker] = useState<Tanker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Alert notification state
  const [alerts, setAlerts] = useState<FuelAlert[]>([]);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  // Heuristic "expected loss" model (NOT a calibrated model — placeholder until
  // a real per-vehicle consumption model is fitted). It estimates how much fuel
  // percentage would normally be gone due to ambient temperature and speed, so
  // that unexpected loss (theft/leak) can be flagged as loss beyond expectation.
  // Coefficients preserve the previous numeric behaviour exactly.
  const EXPECTED_LOSS_BASELINE_TEMP_C = 25;   // ambient temp with no extra evaporative loss
  const EXPECTED_LOSS_PER_DEGREE = 0.1;       // extra % fuel loss per °C above baseline
  const EXPECTED_LOSS_PER_100_KMH = 2;        // extra % fuel loss per 100 km/h of speed

  // Calculate fuel loss % for each tanker (deterministic — no Math.random).
  // fuelLevel is a calibrated percentage (0–100), converted once at ingestion.
  const tankersWithFuelLoss: ExtendedTanker[] = tankers.map(tanker => {
    const temp = tanker.temperature || 25;
    const speed = tanker.speed || 0;
    const fuelLevel = tanker.fuelLevel ?? 50;

    // Expected loss from normal driving conditions (heuristic — see consts above)
    const expectedFuelLoss =
      (temp - EXPECTED_LOSS_BASELINE_TEMP_C) * EXPECTED_LOSS_PER_DEGREE +
      (speed / 100) * EXPECTED_LOSS_PER_100_KMH;
    // Actual loss = how much fuel is gone from full (100%)
    const actualFuelLoss = Math.max(0, 100 - fuelLevel);
    const fuelLossPercent = parseFloat(Math.max(0, actualFuelLoss - expectedFuelLoss).toFixed(2));

    let fuelStatus: 'Normal' | 'Alert' | 'Suspicious' = 'Normal';
    if (fuelLossPercent > 5 || fuelLevel < 20) {
      fuelStatus = 'Suspicious';
    } else if (fuelLossPercent > 2 || fuelLevel < 30 || temp > 80) {
      fuelStatus = 'Alert';
    }

    return {
      ...tanker,
      fuelLossPercent,
      fuelStatus,
      oilQuantity: (tanker.loadWeight || 0) * 1.2,
      route: tanker.route || 'Unassigned',
      // Use the real company from the tanker record if present; do NOT fabricate.
      company: (tanker as Partial<ExtendedTanker>).company || 'Unknown'
    } as ExtendedTanker;
  });

  // ── Auto-record anomaly: saves incident + report + email (with de-duplication) ──
  const autoRecordAnomaly = useCallback(async (
    tanker: ExtendedTanker,
    incidentType: string,
    severity: string
  ) => {
    const today = new Date().toISOString().split('T')[0];

    // De-duplicate: check if an auto-recorded report already exists for this tanker today
    const existingQuery = query(
      collection(db, 'reports'),
      where('tankerId', '==', tanker.id),
      where('date', '==', today),
      where('source', '==', 'auto')
    );
    const existing = await getDocs(existingQuery);
    if (!existing.empty) return; // Already auto-recorded today, skip

    const description = [
      `Auto-detected anomaly for ${tanker.name} (${tanker.fuelStatus}).`,
      `Fuel loss: ${tanker.fuelLossPercent}%`,
      `Fuel level: ${tanker.fuelLevel}%`,
      `Speed: ${tanker.speed} km/h`,
      `Driver: ${tanker.driver}`,
      `Route: ${tanker.route}`,
    ].join(' | ');

    // 1. Save incident
    const result = await createIncident({
      tankerId: tanker.id,
      tripId: null,
      alertId: null,
      incidentType: incidentType as any,
      description,
      severity: severity as any,
      location: tanker.location ? { lat: tanker.location.lat, lng: tanker.location.lng } : null,
      timestamp: Timestamp.now(),
      responseTime: null,
      status: 'reported',
      assignedTo: null,
      notes: [{
        author: 'System',
        content: `Auto-detected by SOTMS monitoring. Status: ${tanker.fuelStatus}, Fuel loss: ${tanker.fuelLossPercent}%`,
        timestamp: Timestamp.now(),
      }],
      resolvedAt: null,
    });

    // 2. Update RTDB active alert
    await updateActiveAlert(tanker.id, {
      count: 1,
      latestAlertId: result.data || null,
      latestType: incidentType,
      latestSeverity: severity,
      lastUpdated: Date.now(),
    });

    // 3. Save report (with source: 'auto' for de-duplication)
    const reportTypeLabel = incidentType === 'fuel_theft'
      ? 'Fuel Theft Incident'
      : incidentType === 'temperature_anomaly'
        ? 'Temperature Anomaly'
        : incidentType === 'leak'
          ? 'Fuel Leak Incident'
          : 'Fuel Anomaly';

    const reportStatus = severity === 'critical'
      ? 'critical'
      : severity === 'high'
        ? 'warning'
        : 'normal';

    await addDoc(collection(db, 'reports'), {
      tankerId: tanker.id,
      type: reportTypeLabel,
      date: today,
      duration: '-',
      details: description,
      status: reportStatus,
      source: 'auto',
    });

    // 4. Send email alert
    const recipientEmail = auth.currentUser?.email;
    if (recipientEmail) {
      await addDoc(collection(db, 'mail'), {
        to: [recipientEmail],
        message: {
          subject: `SOTMS Auto-Alert: ${tanker.fuelStatus} Fuel Activity - ${tanker.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1B2A; color: #E2E8F0; padding: 32px; border-radius: 12px;">
              <h2 style="color: #FF4D4D; margin-top: 0;">
                ${tanker.fuelStatus === 'Suspicious' ? 'Suspicious Fuel Activity Detected' : 'Fuel Alert Detected'}
              </h2>
              <p style="color: #A0AEC0;">The system has automatically detected anomalous fuel behavior:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Tanker</td><td style="padding: 8px 0; color: #fff; font-weight: bold;">${tanker.name}</td></tr>
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Status</td><td style="padding: 8px 0; color: #FF4D4D; font-weight: bold;">${tanker.fuelStatus}</td></tr>
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Fuel Loss</td><td style="padding: 8px 0; color: #fff;">${tanker.fuelLossPercent}%</td></tr>
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Fuel Level</td><td style="padding: 8px 0; color: #fff;">${tanker.fuelLevel}%</td></tr>
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Driver</td><td style="padding: 8px 0; color: #fff;">${tanker.driver}</td></tr>
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Route</td><td style="padding: 8px 0; color: #fff;">${tanker.route || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Speed</td><td style="padding: 8px 0; color: #fff;">${tanker.speed} km/h</td></tr>
                <tr><td style="padding: 8px 0; color: #A0AEC0;">Time</td><td style="padding: 8px 0; color: #fff;">${new Date().toLocaleString()}</td></tr>
              </table>
              <div style="background: #FF4D4D20; border: 1px solid #FF4D4D50; border-radius: 8px; padding: 12px; margin-top: 16px;">
                <p style="color: #FF4D4D; margin: 0; font-weight: bold;">Immediate Action Required</p>
                <p style="color: #A0AEC0; margin: 8px 0 0; font-size: 13px;">Log in to the SOTMS dashboard to investigate this incident and take appropriate action.</p>
              </div>
              <p style="color: #A0AEC0; font-size: 12px; margin-top: 24px; border-top: 1px solid #2D3748; padding-top: 16px;">
                This is an automated alert from the SOTMS Fuel & Load Monitoring system. A report has been automatically saved.
              </p>
            </div>
          `,
        },
      });
    }
  }, []);

  // Detect status changes and fire notifications
  useEffect(() => {
    tankersWithFuelLoss.forEach(tanker => {
      const prevStatus = prevStatusRef.current.get(tanker.id);
      const currentStatus = tanker.fuelStatus;

      // Fire alert when status becomes Suspicious or Alert (and wasn't before)
      if (currentStatus === 'Suspicious' && prevStatus !== 'Suspicious') {
        const newAlert: FuelAlert = {
          id: `${tanker.id}-${Date.now()}`,
          tankerId: tanker.id,
          tankerName: tanker.name,
          message: `Suspicious fuel activity detected on ${tanker.name}! Fuel loss: ${tanker.fuelLossPercent}% — Fuel: ${tanker.fuelLevel}%`,
          type: 'suspicious',
          timestamp: Date.now(),
        };
        setAlerts(prev => [newAlert, ...prev].slice(0, 10));

        // ── Auto-record incident + report + email for suspicious activity ──
        autoRecordAnomaly(tanker, 'fuel_theft', 'critical').catch(err =>
          console.error('Auto-record suspicious failed:', err)
        );
      } else if (currentStatus === 'Alert' && prevStatus !== 'Alert' && prevStatus !== 'Suspicious') {
        const newAlert: FuelAlert = {
          id: `${tanker.id}-${Date.now()}`,
          tankerId: tanker.id,
          tankerName: tanker.name,
          message: `Fuel alert on ${tanker.name}: ${tanker.fuelLossPercent > 2 ? `High fuel loss (${tanker.fuelLossPercent}%)` : tanker.fuelLevel < 30 ? `Low fuel level (${tanker.fuelLevel}%)` : `High temperature (${tanker.temperature}°C)`}`,
          type: 'alert',
          timestamp: Date.now(),
        };
        setAlerts(prev => [newAlert, ...prev].slice(0, 10));

        // ── Auto-record incident + report for alert status ──
        const alertIncidentType = tanker.fuelLossPercent > 2
          ? 'fuel_theft'
          : tanker.fuelLevel < 30
            ? 'leak'
            : (tanker.temperature || 25) > 80
              ? 'temperature_anomaly'
              : 'other';
        autoRecordAnomaly(tanker, alertIncidentType, 'high').catch(err =>
          console.error('Auto-record alert failed:', err)
        );
      }

      prevStatusRef.current.set(tanker.id, currentStatus);
    });
  }, [tankersWithFuelLoss]);

  // Auto-dismiss alerts after 8 seconds
  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setTimeout(() => {
      setAlerts(prev => prev.slice(0, -1)); // Remove oldest
    }, 8000);
    return () => clearTimeout(timer);
  }, [alerts]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Filter tankers
  const filteredTankers = tankersWithFuelLoss.filter(tanker => {
    const matchesSearch = searchQuery === '' ||
      tanker.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tanker.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tanker.route.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCompany = companyFilter === 'all' || tanker.company === companyFilter;
    const matchesRoute = routeFilter === 'all' || tanker.route === routeFilter;
    const matchesStatus = statusFilter === 'all' || tanker.fuelStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesCompany && matchesRoute && matchesStatus;
  });

  // Get unique routes for filter
  const uniqueRoutes = Array.from(new Set(tankersWithFuelLoss.map(t => t.route)));

  // Statistics
  const normalCount = filteredTankers.filter(t => t.fuelStatus === 'Normal').length;
  const alertCount = filteredTankers.filter(t => t.fuelStatus === 'Alert').length;
  const suspiciousCount = filteredTankers.filter(t => t.fuelStatus === 'Suspicious').length;

  const handleExportData = () => {
    console.log('Exporting fuel data...');
    // In real app: generate CSV/PDF report
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#07121A]">
      {/* Page Header */}
      <PageHeader
        title="Fuel & Load Monitoring"
        subtitle="Real-time fuel consumption tracking and load management"
        icon={<TrendingUp className="w-6 h-6 text-[#00E5FF]" />}
      />

      {/* ── Hatch Alert Panel — persistent until manually acknowledged ── */}
      {hatchAlerts.filter(a => !a.acknowledged).length > 0 && (
        <div className="bg-[#FF4D4D]/10 border-b-2 border-[#FF4D4D] px-6 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF4D4D]/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#FF4D4D] animate-pulse" />
              </div>
              <div>
                <div className="text-[#FF4D4D] font-bold text-base uppercase tracking-wider">
                  HATCH BREACH DETECTED
                </div>
                <div className="text-[#D9DCE1]/60 text-xs">
                  {hatchAlerts.filter(a => !a.acknowledged).length} active alert(s) — alarm will sound until acknowledged
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAlarmMuted(m => !m)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  alarmMuted
                    ? 'bg-[#D9DCE1]/10 text-[#D9DCE1]/60 border border-[#D9DCE1]/20'
                    : 'bg-[#FF4D4D]/20 text-[#FF4D4D] border border-[#FF4D4D]/30 animate-pulse'
                }`}
              >
                {alarmMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {alarmMuted ? 'Muted' : 'Alarm ON'}
              </button>
              <button
                onClick={acknowledgeAllHatchAlerts}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#FF4D4D] text-white rounded-lg text-sm font-semibold hover:bg-[#FF4D4D]/80 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Acknowledge All
              </button>
            </div>
          </div>

          {/* Each hatch alert — separate card per hatch */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hatchAlerts.filter(a => !a.acknowledged).map(alert => (
              <div
                key={alert.id}
                className="bg-[#0C1E2C] border border-[#FF4D4D]/40 rounded-xl p-4 flex items-start gap-3 shadow-[0_0_15px_rgba(255,77,77,0.15)]"
              >
                <div className="w-10 h-10 bg-[#FF4D4D]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DoorOpen className="w-5 h-5 text-[#FF4D4D] animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#FF4D4D] font-bold text-sm">{alert.hatchLabel} — OPENED</div>
                  <div className="text-white text-xs mt-0.5">{alert.tankerName}</div>
                  <div className="text-[#D9DCE1]/40 text-[10px] mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); acknowledgeHatchAlert(alert.id); }}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#28B463]/20 border border-[#28B463]/30 text-[#28B463] rounded-lg text-xs font-medium hover:bg-[#28B463]/30 transition-all"
                  title="Acknowledge this alert"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  ACK
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="px-6 py-4 bg-[#0C1E2C] border-b border-[#00E5FF]/30">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search Bar */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00E5FF]" />
              <input
                type="text"
                placeholder="Search by Tanker ID, Driver, or Route..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 focus:outline-none focus:border-[#00E5FF] transition-all"
              />
            </div>
          </div>

          {/* Filter: Company */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#00E5FF]" />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              aria-label="Filter by company"
              className="px-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white focus:outline-none focus:border-[#00E5FF] transition-all cursor-pointer"
            >
              <option value="all">All Companies</option>
              <option value="PSO">PSO</option>
              <option value="Attock">Attock</option>
            </select>
          </div>

          {/* Filter: Route */}
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            aria-label="Filter by route"
            className="px-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white focus:outline-none focus:border-[#00E5FF] transition-all cursor-pointer"
          >
            <option value="all">All Routes</option>
            {uniqueRoutes.map(route => (
              <option key={route} value={route}>{route}</option>
            ))}
          </select>

          {/* Filter: Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="px-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white focus:outline-none focus:border-[#00E5FF] transition-all cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="normal">Normal</option>
            <option value="alert">Alert</option>
            <option value="suspicious">Suspicious</option>
          </select>

          {/* Export Button */}
          <button
            onClick={handleExportData}
            className="px-4 py-2.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 border border-[#00E5FF]/30 rounded-lg text-[#00E5FF] transition-all duration-200 hover:scale-105 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Status Summary */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#28B463]"></div>
            <span className="text-sm text-[#D9DCE1]/70">Normal: <span className="text-[#28B463] font-semibold">{normalCount}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FFB02E]"></div>
            <span className="text-sm text-[#D9DCE1]/70">Alert: <span className="text-[#FFB02E] font-semibold">{alertCount}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF4D4D]"></div>
            <span className="text-sm text-[#D9DCE1]/70">Suspicious: <span className="text-[#FF4D4D] font-semibold">{suspiciousCount}</span></span>
          </div>
          <div className="ml-auto text-sm text-[#D9DCE1]/70">
            Showing <span className="text-white font-semibold">{filteredTankers.length}</span> of {tankersWithFuelLoss.length} tankers
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Overview Table */}
        <div className={`${selectedTanker ? 'w-1/2' : 'w-full'} border-r border-[#00E5FF]/20 transition-all duration-300`}>
          <FuelOverviewTable
            tankers={filteredTankers}
            selectedTanker={selectedTanker}
            onSelectTanker={setSelectedTanker}
          />
        </div>

        {/* Detail Panel */}
        {selectedTanker && (
          <div className="w-1/2 animate-fade-in">
            <FuelDetailPanel
              tanker={tankersWithFuelLoss.find(t => t.id === selectedTanker.id) || selectedTanker as ExtendedTanker}
              onClose={() => setSelectedTanker(null)}
              sensorReadings={recentReadings}
            />
          </div>
        )}
      </div>

      {/* Alert Notifications — top-right toast stack */}
      {alerts.length > 0 && (
        <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 max-w-[420px]">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`animate-fade-in flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${
                alert.type === 'suspicious'
                  ? 'bg-[#0C1E2C]/95 border-[#FF4D4D]/50 shadow-[0_0_20px_rgba(255,77,77,0.3)]'
                  : 'bg-[#0C1E2C]/95 border-[#FFB02E]/50 shadow-[0_0_20px_rgba(255,176,46,0.3)]'
              }`}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                alert.type === 'suspicious' ? 'bg-[#FF4D4D]/20' : 'bg-[#FFB02E]/20'
              }`}>
                {alert.type === 'suspicious' ? (
                  <AlertTriangle className="w-5 h-5 text-[#FF4D4D] animate-pulse" />
                ) : (
                  <Bell className="w-5 h-5 text-[#FFB02E]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    alert.type === 'suspicious' ? 'text-[#FF4D4D]' : 'text-[#FFB02E]'
                  }`}>
                    {alert.type === 'suspicious' ? 'Suspicious Activity' : 'Fuel Alert'}
                  </span>
                  <span className="text-[9px] text-[#D9DCE1]/40">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[11px] text-[#D9DCE1]/80 leading-relaxed">{alert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissAlert(alert.id)}
                className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5 text-[#D9DCE1]/50" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
