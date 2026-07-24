import { useState, useEffect } from 'react';
import { CheckCheck, X } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { AlertsSummaryCards } from './AlertsSummaryCards';
import { AlertsTable } from './AlertsTable';
import { AlertFilters } from './AlertFilters';
import { AlertDetailModal } from './AlertDetailModal';

export interface Alert {
  id: string;
  type: string;
  tankerId: string;
  tankerName: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  location: { lat: number; lng: number; address: string };
  status: 'unacknowledged' | 'acknowledged' | 'resolved';
  description: string;
  sensorData?: {
    fuelLevel?: number;
    loadWeight?: number;
    temperature?: number;
    valveStatus?: string;
    speed?: number;
    hatchId?: string;
    hatchLabel?: string;
    hatchStatus?: string;
    allHatches?: Array<{ id: string; label: string; open: boolean }>;
  };
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTankerId, setSelectedTankerId] = useState<string>('all');
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [, setLoading] = useState(true);

  // Fetch Alerts from Firestore
  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAlerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Alert));
      setAlerts(fetchedAlerts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching alerts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = searchQuery === '' ||
      (alert.id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (alert.type ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (alert.tankerId ?? '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    const matchesTanker = selectedTankerId === 'all' || alert.tankerId === selectedTankerId;

    return matchesSearch && matchesSeverity && matchesStatus && matchesTanker;
  });

  // Calculate stats
  const stats = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    unacknowledged: alerts.filter(a => a.status === 'unacknowledged').length
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const alertRef = doc(db, 'alerts', alertId);
      await updateDoc(alertRef, { status: 'acknowledged' });
    } catch (error) {
      console.error("Error acknowledging alert:", error);
    }
  };

  const handleBulkAcknowledge = async () => {
    try {
      const batch = writeBatch(db);
      selectedAlerts.forEach(alertId => {
        const alertRef = doc(db, 'alerts', alertId);
        batch.update(alertRef, { status: 'acknowledged' });
      });
      await batch.commit();
      setSelectedAlerts(new Set());
    } catch (error) {
      console.error("Error bulk acknowledging:", error);
    }
  };

  const handleRefresh = () => {
    // Real-time listener handles updates, but force reload if needed
    window.location.reload();
  };

  const handleExport = () => {
    if (filteredAlerts.length === 0) return;

    const headers = ['ID', 'Type', 'Tanker ID', 'Severity', 'Status', 'Time', 'Description'];
    const csvContent = [
      headers.join(','),
      ...filteredAlerts.map(alert => [
        alert.id,
        alert.type,
        alert.tankerId,
        alert.severity,
        alert.status,
        alert.timestamp,
        `"${alert.description}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'alerts_report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAlert = (alertId: string) => {
    setSelectedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAlerts.size === filteredAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(filteredAlerts.map(a => a.id)));
    }
  };

  return (
    <div className="min-h-screen bg-[#07121A] p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl text-[#E2E8F0] font-semibold neon-text mb-2">Alerts & Safety Dashboard</h1>
        <p className="text-[#D9DCE1]/70">Monitor fleet alerts and safety events in real-time</p>
      </div>

      {/* Summary Cards */}
      <AlertsSummaryCards stats={stats} />

      {/* Filters Section */}
      <AlertFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        selectedTankerId={selectedTankerId}
        setSelectedTankerId={setSelectedTankerId}
        onRefresh={handleRefresh}
        onExport={handleExport}
        alerts={alerts}
      />

      {/* Bulk Actions */}
      {selectedAlerts.size > 0 && (
        <div className="mb-4 p-4 bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg flex items-center justify-between neon-glow">
          <span className="text-white">
            {selectedAlerts.size} alert{selectedAlerts.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkAcknowledge}
              className="px-4 py-2 bg-[#009FFD] hover:bg-[#00E5FF] text-white rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
            >
              <CheckCheck className="w-4 h-4" />
              Acknowledge All
            </button>
            <button
              onClick={() => setSelectedAlerts(new Set())}
              className="px-4 py-2 bg-[#FF4D4D]/20 hover:bg-[#FF4D4D]/30 text-[#FF4D4D] rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Alerts Table */}
      <AlertsTable
        alerts={filteredAlerts}
        selectedAlerts={selectedAlerts}
        onSelectAlert={toggleSelectAlert}
        onSelectAll={toggleSelectAll}
        onViewDetails={setSelectedAlert}
        onAcknowledge={handleAcknowledge}
      />

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={() => {
            handleAcknowledge(selectedAlert.id);
            setSelectedAlert(null);
          }}
        />
      )}
    </div>
  );
}