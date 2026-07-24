import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Shield, AlertTriangle, Gauge, Clock, TrendingDown, Navigation, Search, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeader } from '../Layout/PageHeader';
import { useGPSData } from '../../hooks/useGPSData';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { ref, onValue, push, set, off } from 'firebase/database';
import { db, rtdb } from '../../firebase';
import { Driver, Route } from '../../types';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// ── Types ──

interface BehaviourEvent {
  id: string;
  driverId: string;
  driverName: string;
  tankerId: string;
  tankerName: string;
  type: 'overspeeding' | 'harsh_braking' | 'excessive_idle' | 'route_deviation';
  value: number; // speed for overspeeding, deceleration for braking, minutes for idle
  threshold: number;
  timestamp: number;
  location?: { lat: number; lng: number };
}

interface DriverBehaviourScore {
  driverId: string;
  driverName: string;
  assignedTanker: string;
  tankerName: string;
  safetyScore: number;
  overspeedCount: number;
  harshBrakeCount: number;
  idleMinutes: number;
  deviationCount: number;
  status: 'online' | 'offline';
  currentSpeed: number;
  lastEvent: BehaviourEvent | null;
}

// ── Thresholds ──
const SPEED_LIMIT_KMH = 80;
const HARSH_BRAKE_KMH_DROP = 30; // speed drop > 30km/h between readings
const IDLE_WARN_MINUTES = 10;

// ── Helpers ──

function scoreBadgeColor(score: number) {
  if (score >= 80) return { bg: 'bg-[#28B463]/20', text: 'text-[#28B463]', border: 'border-[#28B463]/30' };
  if (score >= 60) return { bg: 'bg-[#FFB02E]/20', text: 'text-[#FFB02E]', border: 'border-[#FFB02E]/30' };
  return { bg: 'bg-[#FF4D4D]/20', text: 'text-[#FF4D4D]', border: 'border-[#FF4D4D]/30' };
}

function eventIcon(type: BehaviourEvent['type']) {
  switch (type) {
    case 'overspeeding': return Gauge;
    case 'harsh_braking': return TrendingDown;
    case 'excessive_idle': return Clock;
    case 'route_deviation': return Navigation;
  }
}

function eventColor(type: BehaviourEvent['type']) {
  switch (type) {
    case 'overspeeding': return '#FF4D4D';
    case 'harsh_braking': return '#FFB02E';
    case 'excessive_idle': return '#009FFD';
    case 'route_deviation': return '#FF4D4D';
  }
}

function eventLabel(type: BehaviourEvent['type']) {
  switch (type) {
    case 'overspeeding': return 'Overspeeding';
    case 'harsh_braking': return 'Harsh Braking';
    case 'excessive_idle': return 'Excessive Idle';
    case 'route_deviation': return 'Route Deviation';
  }
}

function timeAgo(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

// ── Component ──

export function DriverBehaviourPage() {
  const { tankers } = useGPSData();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [events, setEvents] = useState<BehaviourEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'safetyScore' | 'overspeedCount' | 'driverName'>('safetyScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | BehaviourEvent['type']>('all');

  // Refs for behaviour detection (previous speed per tanker)
  const prevSpeedRef = useRef<Map<string, { speed: number; time: number }>>(new Map());
  const idleStartRef = useRef<Map<string, number>>(new Map());
  const firedEventsRef = useRef<Set<string>>(new Set()); // dedup key: type-tankerId-minute

  // ── Load drivers from Firestore ──
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'drivers')), (snap) => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver)));
    });
    return () => unsub();
  }, []);

  // ── Load routes from Firestore ──
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'routes')), (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
    });
    return () => unsub();
  }, []);

  // ── Load persisted events from RTDB ──
  useEffect(() => {
    const eventsRef = ref(rtdb, 'driverBehaviour/events');
    onValue(eventsRef, (snap) => {
      if (!snap.exists()) { setEvents([]); return; }
      const data = snap.val() as Record<string, Omit<BehaviourEvent, 'id'>>;
      const loaded = Object.entries(data).map(([id, ev]) => ({ ...ev, id }));
      // Keep last 200, newest first
      loaded.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(loaded.slice(0, 200));
    });
    return () => off(eventsRef);
  }, []);

  // ── Map drivers to tankers ──
  const driverTankerMap = useMemo(() => {
    const map = new Map<string, { driver: Driver; tankerName: string; tankerId: string }>();

    // Match via route assignments
    for (const route of routes) {
      if (!route.assignedDriver || !route.assignedTanker) continue;
      const driver = drivers.find(d => d.id === route.assignedDriver || d.fullName === route.assignedDriver);
      if (!driver) continue;
      const tanker = tankers.find(t => t.id === route.assignedTanker || t.name === route.assignedTanker);
      if (!tanker) continue;
      map.set(driver.id, { driver, tankerName: tanker.name, tankerId: tanker.id });
    }

    // Also match by tanker.driver field
    for (const tanker of tankers) {
      if (!tanker.driver || tanker.driver === 'Unassigned') continue;
      const driver = drivers.find(d => d.fullName === tanker.driver);
      if (driver && !map.has(driver.id)) {
        map.set(driver.id, { driver, tankerName: tanker.name, tankerId: tanker.id });
      }
    }

    return map;
  }, [drivers, tankers, routes]);

  // ── Real-time behaviour detection from live GPS data ──
  const fireEvent = useCallback((ev: Omit<BehaviourEvent, 'id'>) => {
    // Dedup: max one event of same type per tanker per minute
    const minute = Math.floor(ev.timestamp / 60000);
    const key = `${ev.type}-${ev.tankerId}-${minute}`;
    if (firedEventsRef.current.has(key)) return;
    firedEventsRef.current.add(key);
    // Keep set from growing forever
    if (firedEventsRef.current.size > 500) {
      const arr = Array.from(firedEventsRef.current);
      firedEventsRef.current = new Set(arr.slice(-250));
    }

    // Persist to RTDB
    const evRef = push(ref(rtdb, 'driverBehaviour/events'));
    set(evRef, ev).catch(() => {});
  }, []);

  useEffect(() => {
    const now = Date.now();

    for (const tanker of tankers) {
      if (tanker.status === 'offline') continue;

      // Find driver for this tanker
      let driverId = 'unknown';
      let driverName = tanker.driver || 'Unassigned';
      for (const [id, entry] of driverTankerMap) {
        if (entry.tankerId === tanker.id) {
          driverId = id;
          driverName = entry.driver.fullName;
          break;
        }
      }

      const baseEvent = {
        driverId,
        driverName,
        tankerId: tanker.id,
        tankerName: tanker.name,
        timestamp: now,
        location: tanker.location ? { lat: tanker.location.lat, lng: tanker.location.lng } : undefined,
      };

      // 1. Overspeeding
      if (tanker.speed > SPEED_LIMIT_KMH) {
        fireEvent({ ...baseEvent, type: 'overspeeding', value: tanker.speed, threshold: SPEED_LIMIT_KMH });
      }

      // 2. Harsh braking
      const prev = prevSpeedRef.current.get(tanker.id);
      if (prev && prev.speed - tanker.speed > HARSH_BRAKE_KMH_DROP) {
        fireEvent({ ...baseEvent, type: 'harsh_braking', value: Math.round(prev.speed - tanker.speed), threshold: HARSH_BRAKE_KMH_DROP });
      }
      prevSpeedRef.current.set(tanker.id, { speed: tanker.speed, time: now });

      // 3. Excessive idle
      if (tanker.status === 'idle' && tanker.ignition === 'on') {
        const idleStart = idleStartRef.current.get(tanker.id);
        if (!idleStart) {
          idleStartRef.current.set(tanker.id, now);
        } else {
          const idleMin = (now - idleStart) / 60000;
          if (idleMin >= IDLE_WARN_MINUTES) {
            fireEvent({ ...baseEvent, type: 'excessive_idle', value: Math.round(idleMin), threshold: IDLE_WARN_MINUTES });
          }
        }
      } else {
        idleStartRef.current.delete(tanker.id);
      }

      // 4. Route deviation
      if (tanker.routeDeviation) {
        fireEvent({ ...baseEvent, type: 'route_deviation', value: tanker.deviationDistance || 0, threshold: 500 });
      }
    }
  }, [tankers, driverTankerMap, fireEvent]);

  // ── Build per-driver scores ──
  const driverScores: DriverBehaviourScore[] = useMemo(() => {
    const scores: DriverBehaviourScore[] = [];

    for (const [driverId, entry] of driverTankerMap) {
      const driverEvents = events.filter(e => e.driverId === driverId);
      // Only count events from last 24h for scoring
      const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = driverEvents.filter(e => e.timestamp > recentCutoff);

      const overspeedCount = recent.filter(e => e.type === 'overspeeding').length;
      const harshBrakeCount = recent.filter(e => e.type === 'harsh_braking').length;
      const idleEvents = recent.filter(e => e.type === 'excessive_idle');
      const idleMinutes = idleEvents.reduce((sum, e) => sum + e.value, 0);
      const deviationCount = recent.filter(e => e.type === 'route_deviation').length;

      // Safety score: start at 100, deduct for violations
      let score = 100;
      score -= overspeedCount * 5;
      score -= harshBrakeCount * 8;
      score -= deviationCount * 10;
      score -= Math.floor(idleMinutes / 10) * 2;
      score = Math.max(0, Math.min(100, score));

      const tanker = tankers.find(t => t.id === entry.tankerId);

      scores.push({
        driverId,
        driverName: entry.driver.fullName,
        assignedTanker: entry.tankerId,
        tankerName: entry.tankerName,
        safetyScore: score,
        overspeedCount,
        harshBrakeCount,
        idleMinutes: Math.round(idleMinutes),
        deviationCount,
        status: tanker && tanker.status !== 'offline' ? 'online' : 'offline',
        currentSpeed: tanker?.speed || 0,
        lastEvent: driverEvents[0] || null,
      });
    }

    // Also include drivers without tanker assignments (score 100, no violations)
    for (const driver of drivers) {
      if (!driverTankerMap.has(driver.id) && driver.status === 'active') {
        scores.push({
          driverId: driver.id,
          driverName: driver.fullName,
          assignedTanker: '',
          tankerName: 'Not assigned',
          safetyScore: 100,
          overspeedCount: 0,
          harshBrakeCount: 0,
          idleMinutes: 0,
          deviationCount: 0,
          status: 'offline',
          currentSpeed: 0,
          lastEvent: null,
        });
      }
    }

    return scores;
  }, [driverTankerMap, events, tankers, drivers]);

  // ── Filtering & sorting ──
  const filtered = useMemo(() => {
    let list = driverScores;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.driverName.toLowerCase().includes(q) || d.tankerName.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return list;
  }, [driverScores, searchQuery, sortField, sortDir]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (filterType !== 'all') list = list.filter(e => e.type === filterType);
    if (selectedDriver) list = list.filter(e => e.driverId === selectedDriver);
    return list.slice(0, 50);
  }, [events, filterType, selectedDriver]);

  // ── Stats ──
  const avgScore = driverScores.length > 0 ? Math.round(driverScores.reduce((s, d) => s + d.safetyScore, 0) / driverScores.length) : 100;
  const totalViolations = events.filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000).length;
  const criticalDrivers = driverScores.filter(d => d.safetyScore < 60).length;
  const onlineDrivers = driverScores.filter(d => d.status === 'online').length;

  // ── Score trend chart data (last 12 hours, hourly buckets) ──
  const scoreTrend = useMemo(() => {
    const buckets: { time: string; violations: number }[] = [];
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const bucketStart = now - (i + 1) * 3600000;
      const bucketEnd = now - i * 3600000;
      const count = events.filter(e => e.timestamp >= bucketStart && e.timestamp < bucketEnd).length;
      const hour = new Date(bucketEnd).getHours();
      buckets.push({ time: `${hour}:00`, violations: count });
    }
    return buckets;
  }, [events]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'safetyScore' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-[#00E5FF]" /> : <ChevronDown className="w-3 h-3 text-[#00E5FF]" />;
  };

  // ── Export CSV ──
  const handleExport = () => {
    const headers = ['Driver', 'Tanker', 'Safety Score', 'Overspeeding', 'Harsh Braking', 'Idle (min)', 'Route Deviations', 'Status'];
    const rows = filtered.map(d => [d.driverName, d.tankerName, d.safetyScore, d.overspeedCount, d.harshBrakeCount, d.idleMinutes, d.deviationCount, d.status]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver_behaviour_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Driver Behaviour"
        subtitle={`${onlineDrivers} driving now • Avg score: ${avgScore}/100 • ${totalViolations} violations (24h)`}
        icon={<Shield className="w-6 h-6 text-[#00E5FF]" />}
        actions={
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg hover:scale-105 transition-all duration-200 neon-glow">
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Fleet Safety Score', value: `${avgScore}/100`, icon: Shield, color: avgScore >= 80 ? '#28B463' : avgScore >= 60 ? '#FFB02E' : '#FF4D4D' },
            { label: 'Violations (24h)', value: totalViolations, icon: AlertTriangle, color: '#FF4D4D' },
            { label: 'Critical Drivers', value: criticalDrivers, icon: Gauge, color: '#FFB02E' },
            { label: 'Drivers Online', value: onlineDrivers, icon: Navigation, color: '#009FFD' },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="bg-[#0C1E2C] border rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]" style={{ borderColor: `${card.color}33` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
                <div className="text-sm text-[#D9DCE1]/70">{card.label}</div>
              </div>
            );
          })}
        </div>

        {/* ── Main Grid: Table + Live Feed ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Driver Scores Table (2/3) ── */}
          <div className="lg:col-span-2 bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-xl overflow-hidden flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-[#00E5FF]/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search driver or tanker..."
                  className="w-full pl-10 pr-4 py-2 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white text-sm placeholder-[#D9DCE1]/40 focus:outline-none focus:border-[#00E5FF]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full table-fixed">
                <thead className="sticky top-0 bg-[#0C1E2C] z-10">
                  <tr className="border-b border-[#00E5FF]/20">
                    <th className="w-[18%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase cursor-pointer" onClick={() => handleSort('driverName')}>
                      <span className="flex items-center gap-1">Driver <SortIcon field="driverName" /></span>
                    </th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase">Tanker</th>
                    <th className="w-[10%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase cursor-pointer" onClick={() => handleSort('safetyScore')}>
                      <span className="flex items-center gap-1">Score <SortIcon field="safetyScore" /></span>
                    </th>
                    <th className="w-[12%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase cursor-pointer" onClick={() => handleSort('overspeedCount')}>
                      <span className="flex items-center gap-1">Overspeed <SortIcon field="overspeedCount" /></span>
                    </th>
                    <th className="w-[11%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase">Braking</th>
                    <th className="w-[9%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase">Idle</th>
                    <th className="w-[12%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase">Deviation</th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs text-[#00E5FF] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const badge = scoreBadgeColor(d.safetyScore);
                    const isSelected = selectedDriver === d.driverId;
                    return (
                      <tr
                        key={d.driverId}
                        onClick={() => setSelectedDriver(isSelected ? null : d.driverId)}
                        className={`border-b border-[#00E5FF]/10 cursor-pointer transition-all duration-200 ${isSelected ? 'bg-[#009FFD]/15 border-l-4 border-l-[#00E5FF]' : 'hover:bg-[#0C1E2C]/80'}`}
                        style={{ animationDelay: `${i * 0.03}s` }}
                      >
                        <td className="px-4 py-3">
                          <div className="text-white text-sm">{d.driverName}</div>
                        </td>
                        <td className="px-4 py-3 text-[#D9DCE1]/70 text-sm">{d.tankerName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text} border ${badge.border}`}>
                            {d.safetyScore}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono ${d.overspeedCount > 0 ? 'text-[#FF4D4D]' : 'text-[#D9DCE1]/50'}`}>
                            {d.overspeedCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono ${d.harshBrakeCount > 0 ? 'text-[#FFB02E]' : 'text-[#D9DCE1]/50'}`}>
                            {d.harshBrakeCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono ${d.idleMinutes >= IDLE_WARN_MINUTES ? 'text-[#009FFD]' : 'text-[#D9DCE1]/50'}`}>
                            {d.idleMinutes}m
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono ${d.deviationCount > 0 ? 'text-[#FF4D4D]' : 'text-[#D9DCE1]/50'}`}>
                            {d.deviationCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-[#28B463] animate-pulse' : 'bg-[#D9DCE1]/30'}`} />
                            <span className="text-xs text-[#D9DCE1]/60">
                              {d.status === 'online' ? `${d.currentSpeed} km/h` : 'Offline'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[#D9DCE1]/40">
                        {drivers.length === 0 ? 'No drivers registered yet' : 'No matching drivers'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Live Violations Feed (1/3) ── */}
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-xl overflow-hidden flex flex-col" style={{ minHeight: '420px' }}>
            <div className="p-4 border-b border-[#00E5FF]/20">
              <h3 className="text-white text-sm font-semibold mb-3">Live Violations</h3>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'overspeeding', 'harsh_braking', 'excessive_idle', 'route_deviation'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-md text-[10px] transition-all ${filterType === t ? 'bg-[#009FFD] text-white' : 'bg-[#07121A] text-[#D9DCE1]/60 border border-[#00E5FF]/20'}`}
                  >
                    {t === 'all' ? 'All' : eventLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredEvents.length === 0 && (
                <div className="text-center py-8 text-[#D9DCE1]/40 text-sm">No violations recorded</div>
              )}
              {filteredEvents.map(ev => {
                const Icon = eventIcon(ev.type);
                const color = eventColor(ev.type);
                return (
                  <div key={ev.id} className="p-3 rounded-lg border transition-all duration-200 hover:translate-x-0.5" style={{ borderColor: `${color}30`, background: `${color}08` }}>
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${color}20` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold" style={{ color }}>{eventLabel(ev.type)}</span>
                          <span className="text-[10px] text-[#D9DCE1]/40">{timeAgo(ev.timestamp)}</span>
                        </div>
                        <p className="text-xs text-[#D9DCE1]/80 mt-0.5">
                          <span className="text-white">{ev.driverName}</span>
                          {' on '}
                          <span className="text-[#00E5FF]">{ev.tankerName}</span>
                          {ev.type === 'overspeeding' && ` — ${ev.value} km/h (limit: ${ev.threshold})`}
                          {ev.type === 'harsh_braking' && ` — ${ev.value} km/h drop`}
                          {ev.type === 'excessive_idle' && ` — ${ev.value} min idle`}
                          {ev.type === 'route_deviation' && ` — ${ev.value}m off route`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Violations Trend Chart ── */}
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-xl p-5">
          <h3 className="text-white text-sm font-semibold mb-3">Violations Trend (Last 12 Hours)</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scoreTrend}>
                <defs>
                  <linearGradient id="violationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4D4D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF4D4D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#D9DCE1" strokeOpacity={0.3} tick={{ fill: '#D9DCE1', fillOpacity: 0.5, fontSize: 11 }} />
                <YAxis stroke="#D9DCE1" strokeOpacity={0.3} tick={{ fill: '#D9DCE1', fillOpacity: 0.5, fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0C1E2C', border: '1px solid rgba(0,229,255,0.3)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  labelStyle={{ color: '#00E5FF' }}
                />
                <Area type="monotone" dataKey="violations" stroke="#FF4D4D" fill="url(#violationGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
