import { Search, Download, RefreshCw, List } from 'lucide-react';

interface TrackingNavBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  totalTankers: number;
  movingCount: number;
  idleCount: number;
  alertCount: number;
  showTankerList: boolean;
  onToggleTankerList: () => void;
}

export function TrackingNavBar({
  searchQuery,
  onSearchChange,
  onRefresh,
  onExport,
  totalTankers,
  movingCount,
  idleCount,
  alertCount,
  showTankerList,
  onToggleTankerList
}: TrackingNavBarProps) {
  return (
    <div className="bg-[#0C1E2C] border-b border-[#00E5FF]/30 shadow-lg">
      <div className="px-6 py-4">
        {/* Top Row - Title and Stats */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl text-[#E2E8F0] font-semibold neon-text mb-1">Live Fleet Tracking</h1>
            <p className="text-sm text-[#D9DCE1]/70">
              Real-time location monitoring of {totalTankers} tankers
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl text-[#28B463] neon-text">{movingCount}</div>
              <div className="text-xs text-[#D9DCE1]/60">Moving</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-[#FFB02E] neon-text">{idleCount}</div>
              <div className="text-xs text-[#D9DCE1]/60">Idle</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-[#FF4D4D] neon-text">{alertCount}</div>
              <div className="text-xs text-[#D9DCE1]/60">Alerts</div>
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
              placeholder="Search by tanker ID, driver, location..."
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
            {/* Toggle List */}
            <button
              onClick={onToggleTankerList}
              className={`px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${
                showTankerList
                  ? 'bg-[#009FFD] text-white shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                  : 'bg-[#009FFD]/20 border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#009FFD]/30'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden lg:inline">Tanker List</span>
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

        {/* Active Search Filter Indicator */}
        {searchQuery && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#00E5FF]/10">
            <span className="text-xs text-[#D9DCE1]/60">Active Search:</span>
            <span className="px-3 py-1 bg-[#009FFD]/20 border border-[#00E5FF]/30 rounded-full text-xs text-[#00E5FF] flex items-center gap-2">
              <Search className="w-3 h-3" />
              "{searchQuery}"
              <button
                onClick={() => onSearchChange('')}
                className="hover:text-white transition-colors ml-1"
              >
                ×
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}