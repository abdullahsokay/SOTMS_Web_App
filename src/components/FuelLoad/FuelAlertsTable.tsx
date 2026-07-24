import { AlertTriangle, MapPin, Clock, Search } from 'lucide-react';
import { Tanker } from '../../types';
import { useGPSData } from '../../hooks/useGPSData';
import { useState } from 'react';

interface FuelAlertsTableProps {
  onLocateTanker: (tanker: Tanker) => void;
}

interface FuelAlert {
  id: string;
  time: string;
  tankerId: string;
  location: string;
  fuelLevel: number;
  loadWeight: number;
  alertType: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'resolved';
}

export function FuelAlertsTable({ onLocateTanker }: FuelAlertsTableProps) {
  const { tankers } = useGPSData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Generate alerts from tanker data
  const generateAlerts = (): FuelAlert[] => {
    const alerts: FuelAlert[] = [];

    tankers.forEach(tanker => {
      // Fuel alerts
      if (tanker.fuelLevel < 30) {
        alerts.push({
          id: `FA-${tanker.id}-FUEL`,
          time: tanker.lastUpdate,
          tankerId: tanker.id,
          location: tanker.location.address,
          fuelLevel: tanker.fuelLevel,
          loadWeight: tanker.loadWeight,
          alertType: 'Fuel Drop Alert',
          severity: tanker.fuelLevel < 15 ? 'critical' : 'warning',
          status: 'active'
        });
      }

      // Load alerts
      if (tanker.loadWeight > 30000) {
        alerts.push({
          id: `FA-${tanker.id}-OVERLOAD`,
          time: tanker.lastUpdate,
          tankerId: tanker.id,
          location: tanker.location.address,
          fuelLevel: tanker.fuelLevel,
          loadWeight: tanker.loadWeight,
          alertType: 'Overload Alert',
          severity: 'warning',
          status: 'active'
        });
      } else if (tanker.loadWeight < 5000 && tanker.loadWeight > 0) {
        alerts.push({
          id: `FA-${tanker.id}-UNDERLOAD`,
          time: tanker.lastUpdate,
          tankerId: tanker.id,
          location: tanker.location.address,
          fuelLevel: tanker.fuelLevel,
          loadWeight: tanker.loadWeight,
          alertType: 'Load Drop Alert',
          severity: 'info',
          status: 'active'
        });
      }

      // Route deviation alerts
      if (tanker.routeDeviation) {
        alerts.push({
          id: `FA-${tanker.id}-ROUTE`,
          time: tanker.lastUpdate,
          tankerId: tanker.id,
          location: tanker.location.address,
          fuelLevel: tanker.fuelLevel,
          loadWeight: tanker.loadWeight,
          alertType: 'Route Deviation',
          severity: 'warning',
          status: 'active'
        });
      }

      // GPS/Connectivity alerts
      if (tanker.status === 'offline') {
        alerts.push({
          id: `FA-${tanker.id}-GPS`,
          time: tanker.lastUpdate,
          tankerId: tanker.id,
          location: tanker.location.address,
          fuelLevel: tanker.fuelLevel,
          loadWeight: tanker.loadWeight,
          alertType: 'GPS Signal Lost',
          severity: 'critical',
          status: 'active'
        });
      }
    });

    return alerts;
  };

  const alerts = generateAlerts();

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.tankerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.alertType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/50';
      case 'warning':
        return 'bg-[#FFB02E]/20 text-[#FFB02E] border-[#FFB02E]/50';
      default:
        return 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/50';
    }
  };

  const handleLocate = (tankerId: string) => {
    const tanker = tankers.find(t => t.id === tankerId);
    if (tanker) {
      onLocateTanker(tanker);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="p-4 border-b border-[#00E5FF]/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-[#FF4D4D]" />
            <h3 className="text-lg text-white neon-text">Alerts & Events</h3>
            <span className="px-2 py-1 bg-[#FF4D4D]/20 text-[#FF4D4D] rounded text-sm border border-[#FF4D4D]/50">
              {filteredAlerts.length} Active
            </span>
          </div>

          {/* Severity Filters */}
          <div className="flex gap-2">
            {['all', 'critical', 'warning', 'info'].map((severity) => (
              <button
                key={severity}
                onClick={() => setFilterSeverity(severity)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all duration-200 hover:scale-105 ${filterSeverity === severity
                  ? 'bg-[#009FFD] text-white neon-glow'
                  : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/30'
                  }`}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search alerts..."
            className="w-full pl-10 pr-4 py-2 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white text-sm placeholder-[#D9DCE1]/40 focus:outline-none focus:border-[#00E5FF] transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#00E5FF]/20 bg-[#07121A]">
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Time</th>
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Tanker ID</th>
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Location</th>
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Fuel</th>
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Load</th>
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Alert Type</th>
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Severity</th>
              <th className="text-left py-3 px-4 text-xs text-[#D9DCE1]/70">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((alert, index) => (
              <tr
                key={alert.id}
                style={{ animationDelay: `${index * 0.05}s` }}
                className="border-b border-[#00E5FF]/10 hover:bg-[#009FFD]/5 transition-colors animate-fade-in"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 text-sm text-[#D9DCE1]">
                    <Clock className="w-3 h-3 text-[#00E5FF]" />
                    {alert.time}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[#00E5FF]">{alert.tankerId}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-[#D9DCE1]/70">{alert.location}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-sm ${alert.fuelLevel < 20 ? 'text-[#FF4D4D]' :
                    alert.fuelLevel < 40 ? 'text-[#FFB02E]' :
                      'text-[#28B463]'
                    }`}>
                    {alert.fuelLevel}%
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-sm ${alert.loadWeight > 30000 ? 'text-[#FF4D4D]' :
                    alert.loadWeight < 5000 ? 'text-[#FFB02E]' :
                      'text-[#28B463]'
                    }`}>
                    {(alert.loadWeight / 1000).toFixed(1)}T
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${alert.severity === 'critical' ? 'text-[#FF4D4D]' :
                      alert.severity === 'warning' ? 'text-[#FFB02E]' :
                        'text-[#00E5FF]'
                      }`} />
                    <span className="text-sm text-white">{alert.alertType}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border capitalize ${getSeverityStyle(alert.severity)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current pulse-glow" />
                    {alert.severity}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleLocate(alert.tankerId)}
                    className="flex items-center gap-2 px-3 py-1 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg text-xs transition-all duration-200 hover:scale-105"
                  >
                    <MapPin className="w-3 h-3" />
                    Locate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-12 text-[#D9DCE1]/50">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No alerts found</p>
          </div>
        )}
      </div>
    </div>
  );
}
