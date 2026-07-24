import { Search, Download, Filter } from 'lucide-react';

interface DriverFiltersProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (f: string) => void;
  licenseFilter: string;
  setLicenseFilter: (f: string) => void;
  onExport: () => void;
  totalDrivers: number;
  filteredCount: number;
}

export function DriverFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  licenseFilter,
  setLicenseFilter,
  onExport,
  totalDrivers,
  filteredCount,
}: DriverFiltersProps) {
  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 mb-6 neon-glow">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, CNIC, phone, license..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] transition-all text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#D9DCE1]/50" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="px-3 py-2 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* License Filter */}
          <select
            value={licenseFilter}
            onChange={(e) => setLicenseFilter(e.target.value)}
            aria-label="Filter by license"
            className="px-3 py-2 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
          >
            <option value="all">All Licenses</option>
            <option value="valid">Valid</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>

          {/* Results Count */}
          <span className="text-xs text-[#D9DCE1]/50 px-3 py-1.5 bg-[#07121A] rounded-lg border border-[#00E5FF]/10">
            {filteredCount} of {totalDrivers}
          </span>

          {/* Export */}
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg transition-all text-sm border border-[#00E5FF]/20"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
