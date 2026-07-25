import { useState, useEffect, useCallback } from 'react';
import { FileText, Calendar, Download, Loader2, X, AlertTriangle, Clock, Truck, Activity, Copy, CheckCircle } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { Report } from '../../types';

export function ReportsPage() {
  const { companyId } = useCompany();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setReports([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'reports'),
      where('companyId', '==', companyId),
      orderBy('date', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Report));
      setReports(fetchedReports);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [companyId]);

  // Dynamically build filter tabs from actual report types in the data
  const reportTypes = ['all', ...Array.from(new Set(reports.map(r => r.type))).sort()];

  const filteredReports = reports.filter(r => {
    const matchesType = selectedType === 'all' || r.type === selectedType;
    const matchesDate = (!dateRange.start || r.date >= dateRange.start) &&
      (!dateRange.end || r.date <= dateRange.end);
    return matchesType && matchesDate;
  });

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'critical':
        return 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/50';
      case 'warning':
        return 'bg-[#FFB02E]/20 text-[#FFB02E] border-[#FFB02E]/50';
      case 'normal':
        return 'bg-[#28B463]/20 text-[#28B463] border-[#28B463]/50';
      default:
        return 'bg-[#D9DCE1]/20 text-[#D9DCE1] border-[#D9DCE1]/50';
    }
  };

  // Copy report ID to clipboard
  const handleCopyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }, []);

  // Delete a report
  const handleDeleteReport = useCallback(async (reportId: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setViewingReport(null);
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
    setDeleting(false);
  }, [deleting]);

  // Parse pipe-delimited details into key-value pairs
  const parseDetails = (details: string): { key: string; value: string }[] => {
    return details.split('|').map(segment => {
      const trimmed = segment.trim();
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        return { key: trimmed.slice(0, colonIdx).trim(), value: trimmed.slice(colonIdx + 1).trim() };
      }
      return { key: '', value: trimmed };
    }).filter(p => p.value);
  };

  const handleExport = () => {
    if (filteredReports.length === 0) return;

    const headers = ['Report ID', 'Tanker ID', 'Type', 'Date', 'Duration', 'Details', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredReports.map(report => [
        report.id,
        report.tankerId,
        `"${report.type}"`,
        report.date,
        report.duration,
        `"${report.details}"`,
        report.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'reports_analytics.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl text-[#E2E8F0] font-semibold neon-text mb-2">Reports & Analytics</h1>
          <p className="text-[#D9DCE1]/60">Fleet activity and compliance reports</p>
        </div>
        <div className="flex gap-3 mt-4 lg:mt-0 relative">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 border ${dateRange.start || dateRange.end
                  ? 'bg-[#009FFD] text-white border-transparent neon-glow'
                  : 'bg-[#009FFD]/20 border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#009FFD]/30'
                }`}
            >
              <Calendar className="w-4 h-4" />
              {dateRange.start || dateRange.end ? 'Date Filter Active' : 'Date Range'}
              {(dateRange.start || dateRange.end) && (
                <X
                  className="w-4 h-4 ml-1 hover:text-[#FF4D4D] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateRange({ start: '', end: '' });
                  }}
                />
              )}
            </button>

            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 p-4 bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl shadow-2xl z-50 min-w-[300px] neon-glow animate-fade-in">
                <h3 className="text-white text-sm mb-3 font-semibold">Select Date Range</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#D9DCE1]/60 block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      aria-label="Start date"
                      className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#D9DCE1]/60 block mb-1">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      aria-label="End date"
                      className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg neon-glow transition-all duration-200 hover:scale-105"
          >
            <Download className="w-4 h-4" />
            Export Reports
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {reportTypes.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all duration-200 hover:scale-105 ${selectedType === type
              ? 'bg-[#009FFD] text-white neon-glow'
              : 'bg-[#0C1E2C] text-[#00E5FF] border border-[#00E5FF]/30 hover:bg-[#009FFD]/10'
              }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Reports Table */}
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl overflow-hidden neon-glow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#00E5FF]/20 bg-[#07121A]">
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Report ID</th>
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Tanker ID</th>
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Type</th>
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Date</th>
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Duration</th>
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Details</th>
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Status</th>
                <th className="text-left py-4 px-6 text-sm text-[#D9DCE1]/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin mx-auto" />
                    <p className="text-[#D9DCE1]/50 mt-2">Loading reports...</p>
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#D9DCE1]/50">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No reports found for the selected filter</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report, index) => (
                  <tr
                    key={report.id}
                    style={{ animationDelay: `${index * 0.05}s` }}
                    className="border-b border-[#00E5FF]/10 hover:bg-[#009FFD]/5 transition-colors animate-fade-in"
                  >
                    <td className="py-4 px-6">
                      <span className="text-white">{report.id}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[#00E5FF]">{report.tankerId}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#D9DCE1]/60" />
                        <span className="text-[#D9DCE1]">{report.type}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[#D9DCE1]">{report.date}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[#D9DCE1]">{report.duration}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[#D9DCE1]/70 text-sm">{report.details}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm border ${getStatusColor(
                          report.status as Report['status']
                        )}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {report.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => setViewingReport(report)}
                        className="px-3 py-1 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg text-sm transition-all duration-200 hover:scale-105"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-[#0C1E2C] border border-[#28B463]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105 animate-fade-in">
          <div className="text-[#28B463] text-sm mb-2">Normal Reports</div>
          <div className="text-3xl text-white">
            {reports.filter(r => r.status === 'normal').length}
          </div>
        </div>

        <div className="bg-[#0C1E2C] border border-[#FFB02E]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="text-[#FFB02E] text-sm mb-2">Warning Reports</div>
          <div className="text-3xl text-white">
            {reports.filter(r => r.status === 'warning').length}
          </div>
        </div>

        <div className="bg-[#0C1E2C] border border-[#FF4D4D]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="text-[#FF4D4D] text-sm mb-2">Critical Reports</div>
          <div className="text-3xl text-white">
            {reports.filter(r => r.status === 'critical').length}
          </div>
        </div>

        <div className="bg-[#0C1E2C] border border-[#00E5FF]/50 rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="text-[#00E5FF] text-sm mb-2">Total Reports</div>
          <div className="text-3xl text-white">{reports.length}</div>
        </div>
      </div>

      {/* ── Report Detail Modal ── */}
      {viewingReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setViewingReport(null)}
        >
          <div
            className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl shadow-2xl w-full max-w-[600px] mx-4 max-h-[85vh] flex flex-col animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#00E5FF]/20">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  viewingReport.status === 'critical' ? 'bg-[#FF4D4D]/20' :
                  viewingReport.status === 'warning' ? 'bg-[#FFB02E]/20' : 'bg-[#28B463]/20'
                }`}>
                  {viewingReport.status === 'critical' ? (
                    <AlertTriangle className="w-5 h-5 text-[#FF4D4D]" />
                  ) : viewingReport.status === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-[#FFB02E]" />
                  ) : (
                    <FileText className="w-5 h-5 text-[#28B463]" />
                  )}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{viewingReport.type}</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${getStatusColor(viewingReport.status as Report['status'])}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {viewingReport.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-[#D9DCE1]/70" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
              {/* Report ID */}
              <div className="flex items-center gap-2 bg-[#07121A] rounded-lg px-4 py-3">
                <span className="text-xs text-[#D9DCE1]/50 shrink-0">Report ID:</span>
                <span className="text-white text-sm font-mono truncate flex-1">{viewingReport.id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyId(viewingReport.id)}
                  className="p-1 hover:bg-white/10 rounded transition-colors shrink-0"
                  title="Copy ID"
                >
                  {copiedId ? (
                    <CheckCircle className="w-3.5 h-3.5 text-[#28B463]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#D9DCE1]/50" />
                  )}
                </button>
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#07121A] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Truck className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span className="text-xs text-[#D9DCE1]/50">Tanker</span>
                  </div>
                  <span className="text-white font-semibold">{viewingReport.tankerId}</span>
                </div>
                <div className="bg-[#07121A] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span className="text-xs text-[#D9DCE1]/50">Date</span>
                  </div>
                  <span className="text-white font-semibold">{viewingReport.date}</span>
                </div>
                <div className="bg-[#07121A] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span className="text-xs text-[#D9DCE1]/50">Type</span>
                  </div>
                  <span className="text-white font-semibold">{viewingReport.type}</span>
                </div>
                <div className="bg-[#07121A] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span className="text-xs text-[#D9DCE1]/50">Duration</span>
                  </div>
                  <span className="text-white font-semibold">{viewingReport.duration || '-'}</span>
                </div>
              </div>

              {/* Details Breakdown */}
              <div>
                <h4 className="text-sm text-[#D9DCE1]/60 mb-3 font-medium">Details</h4>
                <div className="space-y-2">
                  {parseDetails(viewingReport.details).map((item, i) => (
                    <div key={i} className="bg-[#07121A] rounded-lg px-4 py-2.5 flex items-start gap-3">
                      {item.key ? (
                        <>
                          <span className="text-xs text-[#00E5FF] font-medium min-w-[100px] shrink-0 pt-0.5">{item.key}</span>
                          <span className="text-sm text-[#D9DCE1]/90">{item.value}</span>
                        </>
                      ) : (
                        <span className="text-sm text-[#D9DCE1]/90">{item.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#00E5FF]/20 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  // Export single report as CSV
                  const headers = ['Report ID', 'Tanker ID', 'Type', 'Date', 'Duration', 'Details', 'Status'];
                  const row = [
                    viewingReport.id,
                    viewingReport.tankerId,
                    `"${viewingReport.type}"`,
                    viewingReport.date,
                    viewingReport.duration,
                    `"${viewingReport.details}"`,
                    viewingReport.status,
                  ];
                  const csv = [headers.join(','), row.join(',')].join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `Report_${viewingReport.id}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 border border-[#00E5FF]/30 rounded-lg text-[#00E5FF] text-sm transition-all hover:scale-[1.02]"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
              <button
                type="button"
                onClick={() => handleDeleteReport(viewingReport.id)}
                disabled={deleting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 border border-[#FF4D4D]/30 rounded-lg text-[#FF4D4D] text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-[#D9DCE1]/20 rounded-lg text-[#D9DCE1] text-sm transition-all hover:scale-[1.02]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}