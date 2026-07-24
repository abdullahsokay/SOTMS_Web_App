import { Search, Download, RefreshCw, AlertTriangle, List } from 'lucide-react';

interface FuelNavBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  totalVehicles: number;
  lowFuelCount: number;
  overloadedCount: number;
  showVehicleList: boolean;
  onToggleVehicleList: () => void;
}

export function FuelNavBar({
  searchQuery,
  onSearchChange,
  onRefresh,
  onExport,
  totalVehicles,
  lowFuelCount,
  overloadedCount,
  showVehicleList,
  onToggleVehicleList
}: FuelNavBarProps) {
  return (
    <div className="bg-[#0C1E2C] border-b border-[#00E5FF]/30 shadow-lg">
      <div className="px-6 py-4">
        {/* Top Row - Title and Stats */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl text-[#E2E8F0] font-semibold neon-text mb-1">Fuel & Load Management</h1>
            <p className="text-sm text-[#D9DCE1]/70">
              Real-time monitoring of {totalVehicles} vehicles
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl text-[#00E5FF] neon-text">{totalVehicles}</div>
              <div className="text-xs text-[#D9DCE1]/60">Total Vehicles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-[#FF4D4D] neon-text">{lowFuelCount}</div>
              <div className="text-xs text-[#D9DCE1]/60">Low Fuel</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-[#FFB02E] neon-text">{overloadedCount}</div>
              <div className="text-xs text-[#D9DCE1]/60">Overloaded</div>
            </div>
          </div>
        </div>

        {/* Bottom Row - Search and Actions */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00E5FF]/50" />
            <input
              type="text"
              placeholder="Search by tanker ID, driver, status..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-[#D9DCE1]/40 focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D9DCE1]/50 hover:text-white transition-colors"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* View List */}
            <button
              onClick={onToggleVehicleList}
              className={`px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${
                showVehicleList
                  ? 'bg-[#009FFD] text-white shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                  : 'bg-[#009FFD]/20 border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#009FFD]/30'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden lg:inline">Vehicle List</span>
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="px-4 py-2.5 bg-gradient-to-r from-[#00FFFF] to-[#009FFD] hover:from-[#00E5FF] hover:to-[#007FFF] text-[#07121A] rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,229,255,0.5)]"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden lg:inline">Refresh</span>
            </button>

            {/* Export */}
            <button
              onClick={onExport}
              className="px-4 py-2.5 bg-[#009FFD]/20 border border-[#00E5FF]/30 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Alert Banner for Critical Issues */}
        {(lowFuelCount > 0 || overloadedCount > 0) && (
          <div className="mt-3 pt-3 border-t border-[#00E5FF]/10">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-[#FF4D4D]" />
              <span className="text-[#D9DCE1]/70">
                Active Alerts: 
                {lowFuelCount > 0 && <span className="text-[#FF4D4D] ml-2">{lowFuelCount} Low Fuel</span>}
                {lowFuelCount > 0 && overloadedCount > 0 && <span className="text-[#D9DCE1]/50 mx-1">•</span>}
                {overloadedCount > 0 && <span className="text-[#FFB02E] ml-2">{overloadedCount} Overloaded</span>}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}