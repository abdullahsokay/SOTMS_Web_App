import { useState, useEffect } from 'react';
import { Truck, TrendingUp, AlertCircle, Home, Download, RefreshCw, Signal, WifiOff } from 'lucide-react';
import { StatCard } from './StatCard';
import { MapWidget } from './MapWidget';
import { AlertsPanel } from './AlertsPanel';
import { RouteComplianceTable } from './RouteComplianceTable';
import { FleetETAWidget } from './FleetETAWidget';
import { PageHeader } from '../Layout/PageHeader';
import { useGPSData } from '../../hooks/useGPSData';
import { Route } from '../../types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';

export function DashboardPage() {
  const { companyId } = useCompany();
  const { tankers, loading, error } = useGPSData();
  const [routes, setRoutes] = useState<Route[]>([]);

  // Load routes from Firebase for FleetETAWidget (tenant-scoped)
  useEffect(() => {
    if (!companyId) {
      setRoutes([]);
      return;
    }
    const unsub = onSnapshot(query(collection(db, 'routes'), where('companyId', '==', companyId)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Route));
      setRoutes(data);
    });
    return () => unsub();
  }, [companyId]);

  const totalTankers = tankers.length;
  const onlineTankers = tankers.filter(t => t.status !== 'offline').length;
  const offlineTankers = tankers.filter(t => t.status === 'offline').length;
  const movingTankers = tankers.filter(t => t.status === 'moving').length;
  const activeAlerts = tankers.reduce((sum, t) => sum + t.alerts.filter(a => !a.resolved).length, 0);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    if (tankers.length === 0) return;

    const headers = ['ID', 'Name', 'Status', 'Speed (km/h)', 'Location', 'Last Update'];
    const csvContent = [
      headers.join(','),
      ...tankers.map(t => [
        t.id,
        t.name,
        t.status,
        t.speed,
        `"${t.location.address}"`,
        t.lastUpdate
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'fleet_report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        subtitle={totalTankers === 0
          ? 'Waiting for vehicles to connect...'
          : `Fleet Overview • ${onlineTankers} Online, ${offlineTankers} Offline of ${totalTankers} Vehicles`
        }
        icon={<Home className="w-6 h-6 text-[#00E5FF]" />}
        actions={
          <>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-[#0C1E2C] border border-[#00E5FF]/30 text-[#D9DCE1] rounded-lg hover:bg-[#009FFD]/10 transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg hover:scale-105 transition-all duration-200 neon-glow"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Export Report</span>
            </button>
          </>
        }
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-white text-center mt-10">Connecting to Live GPS Feed...</div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-white p-2 rounded mb-4 text-center">
                {error}
              </div>
            )}

            {/* No vehicles connected state */}
            {tankers.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-16">
                <WifiOff className="w-16 h-16 text-[#00E5FF]/40 mb-4 animate-pulse" />
                <h2 className="text-xl text-white font-semibold mb-2">No Vehicles Connected</h2>
                <p className="text-[#D9DCE1]/60 text-center max-w-md">
                  Once your fleet vehicles are online and sending data,
                  they will appear here automatically.
                </p>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <StatCard
                title="Total Vehicles"
                value={totalTankers}
                icon={Truck}
                color="blue"
              />
              <StatCard
                title="Online"
                value={onlineTankers}
                icon={Signal}
                color="green"
              />
              <StatCard
                title="Offline"
                value={offlineTankers}
                icon={WifiOff}
                color="red"
              />
              <StatCard
                title="Moving"
                value={movingTankers}
                icon={TrendingUp}
                color="green"
              />
              <StatCard
                title="Active Alerts"
                value={activeAlerts}
                icon={AlertCircle}
                color="yellow"
              />
            </div>

            {/* Main Content Grid — only show when vehicles are connected */}
            {tankers.length > 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Map Widget - Larger */}
                  <div className="lg:col-span-2">
                    <MapWidget tankers={tankers} />
                  </div>

                  {/* Alerts Panel */}
                  <div>
                    <AlertsPanel alerts={tankers.flatMap(t => t.alerts)} />
                  </div>
                </div>

                {/* Route Compliance Table */}
                <div className="h-[400px]">
                  <RouteComplianceTable tankers={tankers} />
                </div>

                {/* Fleet ETA Overview */}
                <FleetETAWidget tankers={tankers} routes={routes} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
