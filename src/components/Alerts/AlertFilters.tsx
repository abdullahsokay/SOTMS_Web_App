import { Search, RefreshCw, Download, Filter, Calendar } from 'lucide-react';
import { Alert } from './AlertsPage';

interface AlertFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  severityFilter: string;
  setSeverityFilter: (filter: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  selectedTankerId: string;
  setSelectedTankerId: (id: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  alerts: Alert[];
}

export function AlertFilters({
  searchQuery,
  setSearchQuery,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  selectedTankerId,
  setSelectedTankerId,
  onRefresh,
  onExport,
  alerts
}: AlertFiltersProps) {
  // Get unique tanker IDs
  const tankerIds = Array.from(new Set(alerts.map(a => a.tankerId))).sort();

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 mb-6 neon-glow">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00E5FF]/50" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-[#D9DCE1]/40 focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
          />
        </div>

        {/* Severity Filter */}
        <div className="relative">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            aria-label="Filter by severity"
            className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 pr-10 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]/50 pointer-events-none" />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 pr-10 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="all">All Status</option>
            <option value="unacknowledged">Unacknowledged</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]/50 pointer-events-none" />
        </div>

        {/* Tanker ID Filter */}
        <div className="relative">
          <select
            value={selectedTankerId}
            onChange={(e) => setSelectedTankerId(e.target.value)}
            aria-label="Filter by tanker"
            className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 pr-10 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="all">All Tankers</option>
            {tankerIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]/50 pointer-events-none" />
        </div>

        {/* Date Range Placeholder */}
        <button className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 transition-all flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#00E5FF]" />
          <span>Date Range</span>
        </button>

        <div className="flex-1" />

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="bg-gradient-to-r from-[#00FFFF] to-[#009FFD] hover:from-[#00E5FF] hover:to-[#007FFF] text-[#07121A] px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,229,255,0.5)]"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>

        {/* Export Button */}
        <button
          onClick={onExport}
          className="bg-[#009FFD]/20 border border-[#00E5FF]/30 hover:bg-[#009FFD]/30 text-[#00E5FF] px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
}
