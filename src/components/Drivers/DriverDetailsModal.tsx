import { X, User, CreditCard, Phone, MapPin, FileText, Shield, Calendar, Users, Edit } from 'lucide-react';
import { Driver } from '../../types';

interface DriverDetailsModalProps {
  driver: Driver;
  onClose: () => void;
  onEdit: () => void;
}

function getLicenseExpiryBadge(expiryDate: string) {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return <span className="px-2 py-1 rounded-md text-xs border bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/40">Expired</span>;
  }
  if (diffDays <= 30) {
    return <span className="px-2 py-1 rounded-md text-xs border bg-[#FFB02E]/20 text-[#FFB02E] border-[#FFB02E]/40">{Math.ceil(diffDays)} days left</span>;
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
    <span className={`px-3 py-1 rounded-md text-xs border capitalize ${styles[status] || styles.inactive}`}>
      {status}
    </span>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DriverDetailsModal({ driver, onClose, onEdit }: DriverDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#009FFD]/20 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-[#00E5FF]" />
              </div>
              <div>
                <h2 className="text-xl text-white">{driver.fullName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#00E5FF] font-mono">{driver.driverId}</span>
                  {getStatusBadge(driver.status)}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all">
              <X className="w-6 h-6 text-[#D9DCE1]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)] custom-scrollbar">
          {/* Personal Information */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-sm text-[#D9DCE1]/60 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-[#00E5FF]" /> Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#D9DCE1]/50">Full Name</div>
                <div className="text-white mt-1">{driver.fullName}</div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/50">Address</div>
                <div className="text-white mt-1">{driver.address}</div>
              </div>
            </div>
          </div>

          {/* Contact & Identity */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-sm text-[#D9DCE1]/60 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#00E5FF]" /> Contact & Identity
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#D9DCE1]/50">CNIC</div>
                <div className="text-white mt-1 font-mono">{driver.cnic}</div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/50">Phone</div>
                <div className="text-white mt-1">
                  <a href={`tel:${driver.phone}`} className="hover:text-[#00E5FF] transition-colors flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {driver.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* License Information */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-sm text-[#D9DCE1]/60 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00E5FF]" /> License Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#D9DCE1]/50">License Number</div>
                <div className="text-white mt-1 font-mono">{driver.licenseNumber}</div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/50">Expiry Date</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white">{formatDate(driver.licenseExpiry)}</span>
                  {getLicenseExpiryBadge(driver.licenseExpiry)}
                </div>
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-sm text-[#D9DCE1]/60 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#00E5FF]" /> Insurance
            </h3>
            {driver.insurance?.insured ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-[#D9DCE1]/50">Company</div>
                  <div className="text-white mt-1">{driver.insurance.company || '--'}</div>
                </div>
                <div>
                  <div className="text-xs text-[#D9DCE1]/50">Policy Number</div>
                  <div className="text-white mt-1 font-mono">{driver.insurance.policyNumber || '--'}</div>
                </div>
                <div>
                  <div className="text-xs text-[#D9DCE1]/50">Expiry</div>
                  <div className="text-white mt-1">{driver.insurance.expiry ? formatDate(driver.insurance.expiry) : '--'}</div>
                </div>
              </div>
            ) : (
              <div className="text-[#D9DCE1]/50 text-sm">Not insured</div>
            )}
          </div>

          {/* Co-Pilots */}
          {driver.coPilots && driver.coPilots.length > 0 && (
            <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
              <h3 className="text-sm text-[#D9DCE1]/60 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00E5FF]" /> Co-Pilots ({driver.coPilots.length})
              </h3>
              <div className="space-y-3">
                {driver.coPilots.map((cp, i) => (
                  <div key={cp.coPilotId || i} className="bg-[#0C1E2C] border border-[#00E5FF]/10 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">{cp.fullName}</span>
                      <span className="text-[10px] text-[#D9DCE1]/40">Added {formatDate(cp.addedAt)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <span className="text-[#D9DCE1]/60">CNIC: <span className="text-[#D9DCE1]/80 font-mono">{cp.cnic}</span></span>
                      <span className="text-[#D9DCE1]/60">Phone: <span className="text-[#D9DCE1]/80">{cp.phone}</span></span>
                    </div>
                    {cp.address && (
                      <div className="text-xs text-[#D9DCE1]/50 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {cp.address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-sm text-[#D9DCE1]/60 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#00E5FF]" /> Statistics
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-[#0C1E2C] rounded-lg p-3 text-center">
                <div className="text-xl text-white font-bold">{driver.stats?.totalTrips ?? 0}</div>
                <div className="text-[10px] text-[#D9DCE1]/50 mt-1">Total Trips</div>
              </div>
              <div className="bg-[#0C1E2C] rounded-lg p-3 text-center">
                <div className="text-xl text-white font-bold">{driver.stats?.totalDistance ?? 0}</div>
                <div className="text-[10px] text-[#D9DCE1]/50 mt-1">Distance (km)</div>
              </div>
              <div className="bg-[#0C1E2C] rounded-lg p-3 text-center">
                <div className="text-xl text-[#28B463] font-bold">{driver.stats?.safetyScore ?? 100}</div>
                <div className="text-[10px] text-[#D9DCE1]/50 mt-1">Safety Score</div>
              </div>
              <div className="bg-[#0C1E2C] rounded-lg p-3 text-center">
                <div className="text-sm text-white">{driver.stats?.lastAssignment ? formatDate(driver.stats.lastAssignment) : '--'}</div>
                <div className="text-[10px] text-[#D9DCE1]/50 mt-1">Last Assignment</div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex justify-between text-xs text-[#D9DCE1]/40">
            <span>Created: {formatDate(driver.createdAt)}</span>
            <span>Updated: {formatDate(driver.updatedAt)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#00E5FF]/20 flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" /> Edit Driver
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-[#D9DCE1]/20 hover:bg-[#D9DCE1]/30 text-[#D9DCE1] rounded-lg transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
