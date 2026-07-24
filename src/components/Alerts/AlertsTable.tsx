import { Eye, CheckCheck, AlertOctagon, AlertTriangle, Info, MapPin, Clock, DoorOpen } from 'lucide-react';
import { Alert } from './AlertsPage';

interface AlertsTableProps {
  alerts: Alert[];
  selectedAlerts: Set<string>;
  onSelectAlert: (id: string) => void;
  onSelectAll: () => void;
  onViewDetails: (alert: Alert) => void;
  onAcknowledge: (id: string) => void;
}

export function AlertsTable({
  alerts,
  selectedAlerts,
  onSelectAlert,
  onSelectAll,
  onViewDetails,
  onAcknowledge
}: AlertsTableProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon className="w-5 h-5 text-[#FF3B30]" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-[#FF9500]" />;
      case 'info':
        return <Info className="w-5 h-5 text-[#00CFFF]" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#FF3B30';
      case 'warning':
        return '#FF9500';
      case 'info':
        return '#00CFFF';
      default:
        return '#D9DCE1';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      unacknowledged: 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/40',
      acknowledged: 'bg-[#FFB02E]/20 text-[#FFB02E] border-[#FFB02E]/40',
      resolved: 'bg-[#28B463]/20 text-[#28B463] border-[#28B463]/40'
    };

    return (
      <span className={`px-2 py-1 rounded-md text-xs border ${styles[status as keyof typeof styles] || styles.unacknowledged}`}>
        {(status ?? '').charAt(0).toUpperCase() + (status ?? '').slice(1)}
      </span>
    );
  };

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl overflow-hidden neon-glow">
      {/* Table Header */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#07121A] border-b border-[#00E5FF]/20">
            <tr>
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedAlerts.size === alerts.length && alerts.length > 0}
                  onChange={onSelectAll}
                  aria-label="Select all alerts"
                  className="w-4 h-4 rounded border-[#00E5FF]/30 bg-[#0C1E2C] checked:bg-[#009FFD] focus:ring-2 focus:ring-[#00E5FF]/30 cursor-pointer"
                />
              </th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Severity</th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Alert ID</th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Type</th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Tanker ID</th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Time / Date</th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Location</th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Status</th>
              <th className="px-4 py-4 text-left text-sm text-[#00E5FF]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[#D9DCE1]/50">
                  No alerts found
                </td>
              </tr>
            ) : (
              alerts.map((alert, index) => {
                const severityColor = getSeverityColor(alert.severity);
                return (
                  <tr
                    key={alert.id}
                    className="border-b border-[#00E5FF]/10 hover:bg-[#009FFD]/5 transition-colors duration-150"
                    style={{
                      borderLeft: `4px solid ${severityColor}`,
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.has(alert.id)}
                        onChange={() => onSelectAlert(alert.id)}
                        aria-label={`Select alert ${alert.id}`}
                        className="w-4 h-4 rounded border-[#00E5FF]/30 bg-[#0C1E2C] checked:bg-[#009FFD] focus:ring-2 focus:ring-[#00E5FF]/30 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(alert.severity)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-white">{alert.id}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {alert.type === 'hatch_open_unauthorized' && <DoorOpen className="w-4 h-4 text-[#FF3B30]" />}
                        <span className="text-[#D9DCE1]">
                          {alert.type === 'hatch_open_unauthorized' ? 'Hatch Open (Unauthorized)' : alert.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <div className="text-white">{alert.tankerId}</div>
                        <div className="text-xs text-[#D9DCE1]/60">{alert.tankerName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-[#D9DCE1]/80 text-sm">
                        <Clock className="w-4 h-4 text-[#00E5FF]/50" />
                        {alert.timestamp}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2 max-w-xs">
                        <MapPin className="w-4 h-4 text-[#00E5FF]/50 mt-0.5 flex-shrink-0" />
                        <span className="text-[#D9DCE1]/80 text-sm">{alert.location?.address ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(alert.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {alert.status === 'unacknowledged' && (
                          <button
                            onClick={() => onAcknowledge(alert.id)}
                            className="p-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg transition-all duration-200 hover:scale-110"
                            title="Acknowledge"
                          >
                            <CheckCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onViewDetails(alert)}
                          className="p-2 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] rounded-lg transition-all duration-200 hover:scale-110"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {alerts.length > 0 && (
        <div className="px-4 py-3 bg-[#07121A] border-t border-[#00E5FF]/20 flex items-center justify-between">
          <div className="text-sm text-[#D9DCE1]/70">
            Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Previous
            </button>
            <button className="px-3 py-1 bg-[#009FFD] text-white rounded transition-all duration-200 text-sm">
              1
            </button>
            <button className="px-3 py-1 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded transition-all duration-200 text-sm">
              2
            </button>
            <button className="px-3 py-1 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded transition-all duration-200 text-sm">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
