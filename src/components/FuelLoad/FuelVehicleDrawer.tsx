import { X, Phone, MapPin, Gauge, Droplet, Weight, Clock, AlertTriangle, Navigation, Zap } from 'lucide-react';
import { Tanker } from '../../types';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface FuelVehicleDrawerProps {
  tanker: Tanker;
  onClose: () => void;
}

export function FuelVehicleDrawer({ tanker, onClose }: FuelVehicleDrawerProps) {
  // Sparkline uses current value repeated (no historical data available here)
  const fuelSparkline = [tanker.fuelLevel, tanker.fuelLevel, tanker.fuelLevel, tanker.fuelLevel, tanker.fuelLevel, tanker.fuelLevel, tanker.fuelLevel];
  const loadSparkline = [tanker.loadWeight / 1000, tanker.loadWeight / 1000, tanker.loadWeight / 1000, tanker.loadWeight / 1000, tanker.loadWeight / 1000, tanker.loadWeight / 1000, tanker.loadWeight / 1000];

  const getFuelColor = (level: number) => {
    if (level > 60) return '#28B463';
    if (level > 30) return '#FFB02E';
    return '#FF4D4D';
  };

  const getLoadColor = (weight: number) => {
    if (weight > 30000) return '#FF4D4D';
    if (weight < 5000) return '#FFB02E';
    return '#28B463';
  };

  return (
    <div className="fixed right-0 top-16 bottom-0 w-96 bg-[#0C1E2C] border-l border-[#00E5FF]/30 shadow-2xl z-50 overflow-y-auto neon-glow slide-in-right">
      {/* Header */}
      <div className="sticky top-0 bg-[#0C1E2C] border-b border-[#00E5FF]/30 p-4 z-10">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl text-white neon-text">{tanker.name}</h2>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all duration-200 hover:scale-110 hover:rotate-90"
          >
            <X className="w-5 h-5 text-[#D9DCE1]" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Driver Info */}
        <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#009FFD] to-[#00E5FF] rounded-full flex items-center justify-center">
                <span className="text-white text-sm">{tanker.driver.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div>
                <div className="text-white">{tanker.driver}</div>
                <div className="text-xs text-[#D9DCE1]/60">Driver</div>
              </div>
            </div>
            <a
              href={`tel:${tanker.driverContact}`}
              title="Call driver"
              className="p-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <Phone className="w-4 h-4 text-[#00E5FF]" />
            </a>
          </div>

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${
            tanker.status === 'moving' ? 'bg-[#28B463]/20 text-[#28B463] border-[#28B463]/50' :
            tanker.status === 'idle' ? 'bg-[#FFB02E]/20 text-[#FFB02E] border-[#FFB02E]/50' :
            tanker.status === 'alert' ? 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/50' :
            'bg-[#009FFD]/20 text-[#00E5FF] border-[#00E5FF]/50'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current pulse-glow" />
            {tanker.status.charAt(0).toUpperCase() + tanker.status.slice(1)}
          </div>
        </div>

        {/* Real-Time Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/60">Speed</span>
            </div>
            <div className="text-2xl text-white">{tanker.speed}</div>
            <div className="text-xs text-[#D9DCE1]/50">km/h</div>
          </div>

          <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#FFB02E]" />
              <span className="text-xs text-[#D9DCE1]/60">Ignition</span>
            </div>
            <div className={`text-2xl ${tanker.ignition === 'on' ? 'text-[#28B463]' : 'text-[#7F8C8D]'}`}>
              {tanker.ignition.toUpperCase()}
            </div>
            <div className="text-xs text-[#D9DCE1]/50">Status</div>
          </div>
        </div>

        {/* Fuel Level */}
        <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplet className="w-5 h-5" style={{ color: getFuelColor(tanker.fuelLevel) }} />
              <span className="text-white">Fuel Level</span>
            </div>
            <span className="text-2xl" style={{ color: getFuelColor(tanker.fuelLevel) }}>
              {tanker.fuelLevel}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-[#0C1E2C] rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${tanker.fuelLevel}%`,
                backgroundColor: getFuelColor(tanker.fuelLevel)
              }}
            />
          </div>

          {/* Sparkline */}
          <div className="h-12 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fuelSparkline.map((v) => ({ value: v }))}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getFuelColor(tanker.fuelLevel)}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-[#D9DCE1]/50">Last 30 minutes trend</div>
        </div>

        {/* Load Weight */}
        <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Weight className="w-5 h-5" style={{ color: getLoadColor(tanker.loadWeight) }} />
              <span className="text-white">Load Weight</span>
            </div>
            <span className="text-2xl" style={{ color: getLoadColor(tanker.loadWeight) }}>
              {(tanker.loadWeight / 1000).toFixed(1)}T
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-[#0C1E2C] rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(tanker.loadWeight / 35000) * 100}%`,
                backgroundColor: getLoadColor(tanker.loadWeight)
              }}
            />
          </div>

          {/* Sparkline */}
          <div className="h-12 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadSparkline.map((v) => ({ value: v }))}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getLoadColor(tanker.loadWeight)}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-[#D9DCE1]/50">Last 30 minutes trend</div>
        </div>

        {/* Location */}
        <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-[#00E5FF] mt-1" />
            <div className="flex-1">
              <div className="text-white mb-1">Current Location</div>
              <div className="text-sm text-[#D9DCE1]/70">{tanker.location.address}</div>
              <div className="text-xs text-[#D9DCE1]/50 mt-2">
                {tanker.location.lat.toFixed(4)}, {tanker.location.lng.toFixed(4)}
              </div>
            </div>
          </div>
        </div>

        {/* Route Info */}
        <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#00E5FF]" />
              <span className="text-white">Route</span>
            </div>
            <span className="text-[#00E5FF]">{tanker.route}</span>
          </div>
          {tanker.routeDeviation && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-[#FFB02E]/20 border border-[#FFB02E]/50 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-[#FFB02E]" />
              <span className="text-xs text-[#FFB02E]">Route deviation detected</span>
            </div>
          )}
        </div>

        {/* Recent Alerts */}
        {tanker.alerts.length > 0 && (
          <div className="bg-[#07121A] border border-[#FF4D4D]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-[#FF4D4D]" />
              <span className="text-white">Recent Alerts</span>
            </div>
            <div className="space-y-2">
              {tanker.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-lg"
                >
                  <div className="text-sm text-white mb-1">{alert.message}</div>
                  <div className="flex items-center gap-2 text-xs text-[#D9DCE1]/60">
                    <Clock className="w-3 h-3" />
                    {alert.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Update */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#D9DCE1]/50">
          <Clock className="w-3 h-3" />
          Last updated: {tanker.lastUpdate}
        </div>
      </div>
    </div>
  );
}
