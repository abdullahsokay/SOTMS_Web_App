import { useState, useEffect } from 'react';
import { Download, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useGPSData } from '../../hooks/useGPSData';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';

interface HistoricalPoint {
  date: string;
  [key: string]: number | string;
}

export function HistoricalAnalytics() {
  const { companyId } = useCompany();
  const { tankers } = useGPSData();
  const [dateRange, setDateRange] = useState('24h');
  const [selectedTanker, setSelectedTanker] = useState('all');
  const [historicalFuelData, setHistoricalFuelData] = useState<HistoricalPoint[]>([]);
  const [historicalLoadData, setHistoricalLoadData] = useState<HistoricalPoint[]>([]);
  const [fuelDropEvents, setFuelDropEvents] = useState<Array<{ date: string; tanker: string; drop: number; reason: string }>>([]);
  const [loading, setLoading] = useState(true);

  const dateRanges = ['Today', '24h', '7 days', '30 days', 'Custom'];

  // Fetch historical sensor readings from Firebase
  useEffect(() => {
    async function fetchHistoricalData() {
      if (tankers.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Determine time range
        let startDate = new Date();
        switch (dateRange) {
          case 'Today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case '24h':
            startDate.setHours(startDate.getHours() - 24);
            break;
          case '7 days':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '30 days':
            startDate.setDate(startDate.getDate() - 30);
            break;
          default:
            startDate.setHours(startDate.getHours() - 24);
        }

        // Query sensorReadings collection for historical data (tenant-scoped).
        // Skip entirely without a companyId — never run an unscoped query.
        let readings: any[] = [];
        if (companyId) {
          try {
            const q = query(
              collection(db, 'sensorReadings'),
              where('companyId', '==', companyId),
              orderBy('timestamp', 'asc')
            );

            const snap = await getDocs(q);
            const startMs = startDate.getTime();
            readings = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter((r: any) => {
                const ts = r.timestamp?.toDate ? r.timestamp.toDate().getTime() : new Date(r.timestamp).getTime();
                return ts >= startMs;
              });
          } catch (queryErr) {
            // Collection may not exist or no index — fall through to live data fallback
            console.warn('[HistoricalAnalytics] sensorReadings query failed, using live data:', queryErr);
          }
        }

        if (readings.length > 0) {
          // Group readings by date and device
          const fuelByDate = new Map<string, Record<string, number[]>>();
          const loadByDate = new Map<string, Record<string, number[]>>();
          const drops: typeof fuelDropEvents = [];
          let prevFuel: Record<string, number> = {};

          readings.forEach((r: any) => {
            const ts = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
            const dateKey = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const deviceId = r.deviceId || r.tankerId || 'unknown';

            if (!fuelByDate.has(dateKey)) fuelByDate.set(dateKey, {});
            if (!loadByDate.has(dateKey)) loadByDate.set(dateKey, {});

            const fuelGroup = fuelByDate.get(dateKey)!;
            const loadGroup = loadByDate.get(dateKey)!;

            if (r.fuelLevel != null) {
              if (!fuelGroup[deviceId]) fuelGroup[deviceId] = [];
              fuelGroup[deviceId].push(r.fuelLevel);

              // Detect fuel drops
              if (prevFuel[deviceId] != null) {
                const fuelDrop = r.fuelLevel - prevFuel[deviceId];
                if (fuelDrop < -5) {
                  drops.push({
                    date: ts.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    tanker: deviceId,
                    drop: Math.round(fuelDrop),
                    reason: fuelDrop < -15 ? 'Possible anomaly' : 'Normal consumption'
                  });
                }
              }
              prevFuel[deviceId] = r.fuelLevel;
            }

            if (r.weight != null) {
              if (!loadGroup[deviceId]) loadGroup[deviceId] = [];
              loadGroup[deviceId].push(r.weight);
            }
          });

          // Build chart data
          const fuelChartData: HistoricalPoint[] = [];
          const loadChartData: HistoricalPoint[] = [];

          fuelByDate.forEach((devices, date) => {
            const point: HistoricalPoint = { date };
            let total = 0, count = 0;
            Object.entries(devices).forEach(([deviceId, values]) => {
              const avg = values.reduce((a, b) => a + b, 0) / values.length;
              point[deviceId] = Math.round(avg);
              total += avg;
              count++;
            });
            point.avg = count > 0 ? Math.round(total / count) : 0;
            fuelChartData.push(point);
          });

          loadByDate.forEach((devices, date) => {
            const point: HistoricalPoint = { date };
            let total = 0, count = 0;
            Object.entries(devices).forEach(([deviceId, values]) => {
              const avg = values.reduce((a, b) => a + b, 0) / values.length;
              point[deviceId] = Math.round(avg * 10) / 10;
              total += avg;
              count++;
            });
            point.avg = count > 0 ? Math.round(total / count * 10) / 10 : 0;
            loadChartData.push(point);
          });

          setHistoricalFuelData(fuelChartData);
          setHistoricalLoadData(loadChartData);
          setFuelDropEvents(drops.slice(-10));
        } else {
          // No sensorReadings yet — use live tanker data as single point
          const now = new Date();
          const dateKey = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const fuelPoint: HistoricalPoint = { date: dateKey };
          const loadPoint: HistoricalPoint = { date: dateKey };
          let fuelTotal = 0, loadTotal = 0;

          tankers.forEach(t => {
            fuelPoint[t.id] = t.fuelLevel;
            loadPoint[t.id] = Math.round(t.loadWeight / 1000 * 10) / 10;
            fuelTotal += t.fuelLevel;
            loadTotal += t.loadWeight / 1000;
          });
          fuelPoint.avg = tankers.length > 0 ? Math.round(fuelTotal / tankers.length) : 0;
          loadPoint.avg = tankers.length > 0 ? Math.round(loadTotal / tankers.length * 10) / 10 : 0;

          setHistoricalFuelData([fuelPoint]);
          setHistoricalLoadData([loadPoint]);
          setFuelDropEvents([]);
        }
      } catch (err) {
        console.error('[HistoricalAnalytics] Error fetching data:', err);
      }
      setLoading(false);
    }

    fetchHistoricalData();
  }, [tankers, dateRange, companyId]);

  const handleExport = (format: string) => {
    console.log(`Exporting as ${format}...`);
  };

  // Compute summary stats from live tanker data
  const avgFuelLevel = tankers.length > 0 ? Math.round(tankers.reduce((sum, t) => sum + t.fuelLevel, 0) / tankers.length) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl text-white neon-text mb-1">Historical Analytics</h2>
            <p className="text-sm text-[#D9DCE1]/60">Analyze fuel and load patterns over time</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Date Range Selector */}
            <div className="flex gap-2">
              {dateRanges.map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 hover:scale-105 ${dateRange === range
                      ? 'bg-[#009FFD] text-white neon-glow'
                      : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/30'
                    }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Tanker Selector — from live Firebase data */}
            <select
              value={selectedTanker}
              onChange={(e) => setSelectedTanker(e.target.value)}
              className="px-4 py-2 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-colors"
            >
              <option value="all">All Tankers</option>
              {tankers.map((tanker) => (
                <option key={tanker.id} value={tanker.id}>
                  {tanker.name} ({tanker.id})
                </option>
              ))}
            </select>

            {/* Export Options */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg text-sm transition-all duration-200 hover:scale-105 flex items-center gap-2 border border-[#00E5FF]/30"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="px-4 py-2 bg-[#28B463]/20 hover:bg-[#28B463]/30 text-[#28B463] rounded-lg text-sm transition-all duration-200 hover:scale-105 flex items-center gap-2 border border-[#28B463]/30"
              >
                <FileText className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2 bg-[#FF4D4D]/20 hover:bg-[#FF4D4D]/30 text-[#FF4D4D] rounded-lg text-sm transition-all duration-200 hover:scale-105 flex items-center gap-2 border border-[#FF4D4D]/30"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#D9DCE1]/60 py-10">Loading historical data...</div>
      ) : (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fuel History Chart */}
            <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white neon-text">Fuel Level History</h3>
                <TrendingDown className="w-5 h-5 text-[#FF4D4D]" />
              </div>
              <div className="h-64">
                {historicalFuelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalFuelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
                      <XAxis dataKey="date" stroke="#D9DCE1" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#D9DCE1" style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0C1E2C',
                          border: '1px solid rgba(0, 229, 255, 0.5)',
                          borderRadius: '8px',
                          boxShadow: '0 0 20px rgba(0, 159, 253, 0.3)'
                        }}
                        labelStyle={{ color: '#00E5FF' }}
                      />
                      <Legend />
                      {selectedTanker === 'all' ? (
                        <Line type="monotone" dataKey="avg" stroke="#00E5FF" strokeWidth={3} name="Fleet Average" />
                      ) : (
                        <Line type="monotone" dataKey={selectedTanker} stroke="#00E5FF" strokeWidth={3} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[#D9DCE1]/40">No fuel data available</div>
                )}
              </div>
            </div>

            {/* Load History Chart */}
            <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white neon-text">Load Weight History</h3>
                <TrendingUp className="w-5 h-5 text-[#FFB02E]" />
              </div>
              <div className="h-64">
                {historicalLoadData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historicalLoadData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
                      <XAxis dataKey="date" stroke="#D9DCE1" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#D9DCE1" style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0C1E2C',
                          border: '1px solid rgba(0, 229, 255, 0.5)',
                          borderRadius: '8px',
                          boxShadow: '0 0 20px rgba(0, 159, 253, 0.3)'
                        }}
                        labelStyle={{ color: '#00E5FF' }}
                      />
                      <Legend />
                      {selectedTanker === 'all' ? (
                        <Bar dataKey="avg" fill="#FFB02E" name="Fleet Average" />
                      ) : (
                        <Bar dataKey={selectedTanker} fill="#FFB02E" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[#D9DCE1]/40">No load data available</div>
                )}
              </div>
            </div>
          </div>

          {/* Fuel Drop Events Table */}
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl overflow-hidden neon-glow">
            <div className="p-4 border-b border-[#00E5FF]/20">
              <h3 className="text-lg text-white neon-text">Fuel Drop Events</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#00E5FF]/20 bg-[#07121A]">
                    <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Date & Time</th>
                    <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Tanker</th>
                    <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Fuel Drop</th>
                    <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelDropEvents.length > 0 ? (
                    fuelDropEvents.map((event, index) => (
                      <tr
                        key={index}
                        style={{ animationDelay: `${index * 0.05}s` }}
                        className="border-b border-[#00E5FF]/10 hover:bg-[#009FFD]/5 transition-colors animate-fade-in"
                      >
                        <td className="py-3 px-4 text-sm text-[#D9DCE1]">{event.date}</td>
                        <td className="py-3 px-4 text-[#00E5FF]">{event.tanker}</td>
                        <td className="py-3 px-4">
                          <span className={`text-sm ${Math.abs(event.drop) > 10 ? 'text-[#FF4D4D]' : 'text-[#FFB02E]'}`}>
                            {event.drop}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#D9DCE1]/70">{event.reason}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#D9DCE1]/40">No fuel drop events detected</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Stats — from live data */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0C1E2C] border border-[#00E5FF]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105">
              <div className="text-sm text-[#D9DCE1]/60 mb-2">Active Tankers</div>
              <div className="text-2xl text-[#00E5FF]">{tankers.length}</div>
            </div>
            <div className="bg-[#0C1E2C] border border-[#FFB02E]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105">
              <div className="text-sm text-[#D9DCE1]/60 mb-2">Avg Fuel Level</div>
              <div className="text-2xl text-[#FFB02E]">{avgFuelLevel}%</div>
            </div>
            <div className="bg-[#0C1E2C] border border-[#28B463]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105">
              <div className="text-sm text-[#D9DCE1]/60 mb-2">Tankers Moving</div>
              <div className="text-2xl text-[#28B463]">{tankers.filter(t => t.status === 'moving').length}</div>
            </div>
            <div className="bg-[#0C1E2C] border border-[#FF4D4D]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105">
              <div className="text-sm text-[#D9DCE1]/60 mb-2">Fuel Drop Incidents</div>
              <div className="text-2xl text-[#FF4D4D]">{fuelDropEvents.length}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
