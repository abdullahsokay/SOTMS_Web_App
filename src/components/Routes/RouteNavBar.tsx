import { Search, Plus, UserCheck, List, Download } from 'lucide-react';

interface RouteNavBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateRoute: () => void;
  onAssignRoute: () => void;
  onViewAll: () => void;
  onExport: () => void;
  totalRoutes: number;
  filteredRoutes: number;
  showRouteList: boolean;
}

export function RouteNavBar({
  searchQuery,
  onSearchChange,
  onCreateRoute,
  onAssignRoute,
  onViewAll,
  onExport,
  totalRoutes,
  filteredRoutes,
  showRouteList
}: RouteNavBarProps) {
  return (
    <div className="bg-[#0C1E2C] border-b border-[#00E5FF]/30 shadow-lg">
      <div className="px-6 py-4">
        {/* Top Row - Title and Stats */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl text-[#E2E8F0] font-semibold neon-text mb-1">Route Management</h1>
            <p className="text-sm text-[#D9DCE1]/70">
              Showing {filteredRoutes} of {totalRoutes} routes
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl text-[#28B463] neon-text">{totalRoutes}</div>
              <div className="text-xs text-[#D9DCE1]/60">Total Routes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-[#00E5FF] neon-text">
                {filteredRoutes}
              </div>
              <div className="text-xs text-[#D9DCE1]/60">Active</div>
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
              placeholder="Search routes, tankers, drivers..."
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
            {/* View All Routes */}
            <button
              onClick={onViewAll}
              className={`px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${
                showRouteList
                  ? 'bg-[#009FFD] text-white shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                  : 'bg-[#009FFD]/20 border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#009FFD]/30'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden lg:inline">View All</span>
            </button>

            {/* Create Route */}
            <button
              onClick={onCreateRoute}
              className="px-4 py-2.5 bg-gradient-to-r from-[#00FFFF] to-[#009FFD] hover:from-[#00E5FF] hover:to-[#007FFF] text-[#07121A] rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,229,255,0.5)]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">Create Route</span>
            </button>

            {/* Assign Route */}
            <button
              onClick={onAssignRoute}
              className="px-4 py-2.5 bg-[#009FFD]/20 border border-[#00E5FF]/30 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
            >
              <UserCheck className="w-4 h-4" />
              <span className="hidden lg:inline">Assign Route</span>
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

        {/* Filter Pills */}
        {searchQuery && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#00E5FF]/10">
            <span className="text-xs text-[#D9DCE1]/60">Active Filters:</span>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#009FFD]/20 border border-[#00E5FF]/30 rounded-full text-xs text-[#00E5FF] flex items-center gap-2">
                <Search className="w-3 h-3" />
                Search: "{searchQuery}"
                <button
                  onClick={() => onSearchChange('')}
                  className="hover:text-white transition-colors ml-1"
                >
                  ×
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}