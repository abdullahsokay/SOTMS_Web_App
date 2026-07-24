import { Eye, Edit, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, Users as UsersIcon } from 'lucide-react';
import { Driver } from '../../types';

interface DriverTableProps {
  drivers: Driver[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onView: (driver: Driver) => void;
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
  loading: boolean;
}

function getLicenseExpiryBadge(expiryDate: string) {
  const expiry = new Date(expiryDate);
  const now = new Date();

  if (isNaN(expiry.getTime())) {
    return <span className="px-2 py-1 rounded-md text-xs border bg-[#D9DCE1]/20 text-[#D9DCE1]/70 border-[#D9DCE1]/40">Unknown</span>;
  }

  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return <span className="px-2 py-1 rounded-md text-xs border bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/40">Expired</span>;
  }
  if (diffDays <= 30) {
    return <span className="px-2 py-1 rounded-md text-xs border bg-[#FFB02E]/20 text-[#FFB02E] border-[#FFB02E]/40">{Math.ceil(diffDays)}d left</span>;
  }
  return <span className="px-2 py-1 rounded-md text-xs border bg-[#28B463]/20 text-[#28B463] border-[#28B463]/40">Valid</span>;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    active: 'bg-[#28B463]/20 text-[#28B463] border-[#28B463]/40',
    inactive: 'bg-[#D9DCE1]/20 text-[#D9DCE1]/70 border-[#D9DCE1]/40',
    suspended: 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/40',
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs border capitalize ${styles[status] || styles.inactive}`}>
      {status}
    </span>
  );
}

const sortableColumns = [
  { key: 'driverId', label: 'Driver ID' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'cnic', label: 'CNIC' },
  { key: 'phone', label: 'Phone' },
  { key: 'licenseExpiry', label: 'License Expiry' },
  { key: 'insurance', label: 'Insurance', sortable: false },
  { key: 'coPilots', label: 'Co-Pilots', sortable: false },
  { key: 'status', label: 'Status' },
];

export function DriverTable({
  drivers,
  sortField,
  sortDirection,
  onSort,
  onView,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  loading,
}: DriverTableProps) {
  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl overflow-hidden neon-glow">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#00E5FF]/20">
              {sortableColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && onSort(col.key)}
                  className={`px-4 py-3 text-left text-xs text-[#D9DCE1]/60 font-medium uppercase tracking-wider ${
                    col.sortable !== false ? 'cursor-pointer hover:text-[#00E5FF] transition-colors' : ''
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && sortField === col.key && (
                      <ArrowUpDown className={`w-3 h-3 text-[#00E5FF] ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs text-[#D9DCE1]/60 font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-[#00E5FF]">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#00E5FF]" />
                    <span className="text-sm">Loading drivers...</span>
                  </div>
                </td>
              </tr>
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[#D9DCE1]/50">
                  <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <div className="text-sm">No drivers found</div>
                  <div className="text-xs mt-1 opacity-60">Add a driver to get started</div>
                </td>
              </tr>
            ) : (
              drivers.map((driver, index) => (
                <tr
                  key={driver.id}
                  className="border-b border-[#00E5FF]/10 hover:bg-[#009FFD]/5 transition-colors"
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <td className="px-4 py-3 text-sm text-[#00E5FF] font-mono">{driver.driverId}</td>
                  <td className="px-4 py-3 text-sm text-white font-medium">{driver.fullName}</td>
                  <td className="px-4 py-3 text-sm text-[#D9DCE1]/80 font-mono">{driver.cnic}</td>
                  <td className="px-4 py-3 text-sm text-[#D9DCE1]/80">
                    <a href={`tel:${driver.phone}`} className="hover:text-[#00E5FF] transition-colors">
                      {driver.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3">{getLicenseExpiryBadge(driver.licenseExpiry)}</td>
                  <td className="px-4 py-3">
                    {driver.insurance?.insured ? (
                      <span className="px-2 py-1 rounded-md text-xs border bg-[#28B463]/20 text-[#28B463] border-[#28B463]/40">Yes</span>
                    ) : (
                      <span className="px-2 py-1 rounded-md text-xs border bg-[#D9DCE1]/10 text-[#D9DCE1]/50 border-[#D9DCE1]/20">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-md text-xs border bg-[#009FFD]/10 text-[#009FFD] border-[#009FFD]/30">
                      {driver.coPilots?.length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(driver.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onView(driver)}
                        className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all text-[#00E5FF] hover:scale-110"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(driver)}
                        className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all text-[#FFB02E] hover:scale-110"
                        title="Edit Driver"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(driver)}
                        className="p-2 hover:bg-[#FF4D4D]/20 rounded-lg transition-all text-[#FF4D4D] hover:scale-110"
                        title="Delete Driver"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="px-4 py-3 bg-[#07121A] border-t border-[#00E5FF]/20 flex items-center justify-between">
          <div className="text-sm text-[#D9DCE1]/70">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} drivers
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`px-3 py-1.5 rounded transition-all text-sm ${
                    page === currentPage
                      ? 'bg-[#009FFD] text-white'
                      : 'bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF]'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
