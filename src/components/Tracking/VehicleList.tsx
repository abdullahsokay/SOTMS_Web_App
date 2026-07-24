import { Tanker } from '../../types';
import { Navigation, Circle, Clock, AlertTriangle } from 'lucide-react';

interface VehicleListProps {
  tankers: Tanker[];
  selectedTanker: Tanker | null;
  onSelectTanker: (tanker: Tanker) => void;
}

const statusIcons = {
  moving: Navigation,
  idle: Circle,
  parked: Circle,
  alert: AlertTriangle,
  offline: Circle
};

const statusColors = {
  moving: 'text-[#28B463] bg-[#28B463]/20',
  idle: 'text-[#FFB02E] bg-[#FFB02E]/20',
  parked: 'text-[#D9DCE1] bg-[#D9DCE1]/20',
  alert: 'text-[#FF4D4D] bg-[#FF4D4D]/20',
  offline: 'text-gray-500 bg-gray-500/20'
};

export function VehicleList({ tankers, selectedTanker, onSelectTanker }: VehicleListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#00E5FF]/20">
        <h3 className="text-lg text-white">Fleet Vehicles</h3>
        <p className="text-sm text-[#D9DCE1]/60">{tankers.length} vehicles</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {tankers.map((tanker, index) => {
          const StatusIcon = statusIcons[tanker.status];
          const isSelected = selectedTanker?.id === tanker.id;

          return (
            <div
              key={tanker.id}
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => onSelectTanker(tanker)}
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 hover:translate-x-1 hover:scale-105 animate-fade-in ${
                isSelected
                  ? 'bg-[#009FFD]/30 border border-[#00E5FF] neon-glow'
                  : 'bg-[#07121A] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-white mb-1">{tanker.name}</div>
                </div>
                <div className={`p-2 rounded-lg ${statusColors[tanker.status]}`}>
                  <StatusIcon className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#D9DCE1]/60">
                <Clock className="w-3 h-3" />
                <span>{tanker.lastUpdate}</span>
              </div>

              <div className="flex justify-between mt-2 pt-2 border-t border-[#00E5FF]/10 text-xs">
                <div className="text-[#D9DCE1]">Speed: <span className="text-[#00E5FF] font-mono">{tanker.speed} km/h</span></div>
                <div className="text-[#D9DCE1]">Fuel: <span className="text-[#00E5FF] font-mono">{tanker.fuelLevel ?? '--'}%</span></div>
              </div>

              {tanker.alerts.length > 0 && (
                <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-[#FF4D4D]/20 rounded text-xs text-[#FF4D4D]">
                  <AlertTriangle className="w-3 h-3" />
                  {tanker.alerts.length} Alert(s)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}