import { Search, Droplet, Weight, X } from 'lucide-react';
import { Tanker } from '../../types';
import { useState } from 'react';

interface FuelVehicleListProps {
  tankers: Tanker[];
  selectedTanker: Tanker | null;
  onSelectTanker: (tanker: Tanker) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onClose: () => void;
}

export function FuelVehicleList({ tankers, selectedTanker, onSelectTanker, activeFilter, onFilterChange, onClose }: FuelVehicleListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filters = [
    { id: 'all', label: 'All', count: tankers.length },
    { id: 'moving', label: 'Moving', count: tankers.filter(t => t.status === 'moving').length },
    { id: 'idle', label: 'Idle', count: tankers.filter(t => t.status === 'idle').length },
    { id: 'alert', label: 'Alerts', count: tankers.filter(t => t.alerts.length > 0).length },
    { id: 'lowfuel', label: 'Low Fuel', count: tankers.filter(t => t.fuelLevel < 30).length },
    { id: 'overloaded', label: 'Overloaded', count: tankers.filter(t => t.loadWeight > 30000).length }
  ];

  const filteredBySearch = tankers.filter(t =>
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.driver.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="h-full bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl overflow-hidden neon-glow flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#00E5FF]/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg text-white neon-text">Fleet List</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#009FFD]/20 rounded transition-colors"
          >
            <X className="w-5 h-5 text-[#D9DCE1]" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID or driver..."
            className="w-full pl-10 pr-4 py-2 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white text-sm placeholder-[#D9DCE1]/40 focus:outline-none focus:border-[#00E5FF] transition-colors"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-[#00E5FF]/20 overflow-x-auto">
        <div className="flex gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all duration-200 hover:scale-105 flex items-center gap-2 ${
                activeFilter === filter.id
                  ? 'bg-[#009FFD] text-white neon-glow'
                  : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/30'
              }`}
            >
              {filter.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                activeFilter === filter.id ? 'bg-white/20' : 'bg-[#009FFD]/20'
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredBySearch.map((tanker, index) => {
          const isSelected = selectedTanker?.id === tanker.id;
          const fuelColor = getFuelColor(tanker.fuelLevel);
          const loadColor = getLoadColor(tanker.loadWeight);

          return (
            <div
              key={tanker.id}
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => onSelectTanker(tanker)}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:translate-x-1 animate-fade-in ${
                isSelected
                  ? 'bg-[#009FFD]/30 border border-[#00E5FF] neon-glow'
                  : 'bg-[#07121A] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-white mb-1">{tanker.name}</div>
                  <div className="text-xs text-[#D9DCE1]/60">{tanker.driver}</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs ${
                  tanker.status === 'moving' ? 'bg-[#28B463]/20 text-[#28B463]' :
                  tanker.status === 'idle' ? 'bg-[#FFB02E]/20 text-[#FFB02E]' :
                  tanker.status === 'alert' ? 'bg-[#FF4D4D]/20 text-[#FF4D4D]' :
                  'bg-[#009FFD]/20 text-[#00E5FF]'
                } border border-current/30`}>
                  {tanker.status}
                </div>
              </div>

              {/* Fuel & Load */}
              <div className="space-y-2">
                {/* Fuel */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#D9DCE1]/60 flex items-center gap-1">
                      <Droplet className="w-3 h-3" />
                      Fuel
                    </span>
                    <span style={{ color: fuelColor }}>{tanker.fuelLevel}%</span>
                  </div>
                  <div className="h-1.5 bg-[#07121A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${tanker.fuelLevel}%`,
                        backgroundColor: fuelColor
                      }}
                    />
                  </div>
                </div>

                {/* Load */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#D9DCE1]/60 flex items-center gap-1">
                      <Weight className="w-3 h-3" />
                      Load
                    </span>
                    <span style={{ color: loadColor }}>{(tanker.loadWeight / 1000).toFixed(1)}T</span>
                  </div>
                  <div className="h-1.5 bg-[#07121A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(tanker.loadWeight / 35000) * 100}%`,
                        backgroundColor: loadColor
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#00E5FF]/10">
                <div className="text-xs text-[#D9DCE1]/50">
                  {tanker.lastUpdate}
                </div>
                {tanker.alerts.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-[#FF4D4D]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF4D4D] pulse-glow" />
                    {tanker.alerts.length} alert{tanker.alerts.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredBySearch.length === 0 && (
          <div className="text-center py-8 text-[#D9DCE1]/50">
            <p className="text-sm">No vehicles found</p>
          </div>
        )}
      </div>
    </div>
  );
}
