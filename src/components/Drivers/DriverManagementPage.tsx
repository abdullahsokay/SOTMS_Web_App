import { useState, useEffect, useMemo } from 'react';
import { Users, Plus, CheckCircle2, XCircle } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Driver, Route } from '../../types';
import { PageHeader } from '../Layout/PageHeader';
import { DriverSummaryCards } from './DriverSummaryCards';
import { DriverFilters } from './DriverFilters';
import { DriverTable } from './DriverTable';
import { DriverFormModal } from './DriverFormModal';
import { DriverDetailsModal } from './DriverDetailsModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export function DriverManagementPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [licenseFilter, setLicenseFilter] = useState('all');

  // Sort
  const [sortField, setSortField] = useState('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch drivers from Firestore
  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDrivers = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
      } as Driver));
      setDrivers(fetchedDrivers);
      setLoading(false);
    }, () => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch routes for active assignment checking
  useEffect(() => {
    const q = query(collection(db, 'routes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRoutes = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
      } as Route));
      setRoutes(fetchedRoutes);
    });
    return () => unsubscribe();
  }, []);

  // Auto-dismiss notification
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  // Filtering
  const filteredDrivers = useMemo(() => {
    let result = [...drivers];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        (d.fullName ?? '').toLowerCase().includes(q) ||
        (d.cnic ?? '').toLowerCase().includes(q) ||
        (d.phone ?? '').toLowerCase().includes(q) ||
        (d.licenseNumber ?? '').toLowerCase().includes(q) ||
        (d.driverId ?? '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(d => d.status === statusFilter);
    }

    // License filter
    if (licenseFilter !== 'all') {
      const now = new Date();
      result = result.filter(d => {
        const expiry = new Date(d.licenseExpiry);
        const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (licenseFilter === 'expired') return diffDays < 0;
        if (licenseFilter === 'expiring') return diffDays >= 0 && diffDays <= 30;
        if (licenseFilter === 'valid') return diffDays > 30;
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      const aVal = (a as any)[sortField] || '';
      const bVal = (b as any)[sortField] || '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [drivers, searchQuery, statusFilter, licenseFilter, sortField, sortDirection]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, licenseFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / pageSize));
  const paginatedDrivers = filteredDrivers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Computed stats
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: drivers.length,
      active: drivers.filter(d => d.status === 'active').length,
      expiring: drivers.filter(d => {
        const expiry = new Date(d.licenseExpiry);
        const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }).length,
      suspended: drivers.filter(d => d.status === 'suspended').length,
    };
  }, [drivers]);

  // Generate Driver ID
  const generateDriverId = (): string => {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayDrivers = drivers.filter(d => d.driverId.startsWith(`DRV-${datePart}`));
    const nextNum = todayDrivers.length + 1;
    return `DRV-${datePart}-${String(nextNum).padStart(3, '0')}`;
  };

  // Check if driver has an active route
  const hasActiveRoute = (driverName: string): boolean => {
    return routes.some(r =>
      r.assignedDriver?.toLowerCase() === driverName.toLowerCase() &&
      (r.status === 'active' || r.status === 'not-started')
    );
  };

  // CRUD Handlers
  const handleCreateDriver = async (data: Partial<Driver>) => {
    try {
      const driverData = {
        ...data,
        driverId: generateDriverId(),
      };
      // Strip undefined values
      const cleanData = Object.fromEntries(
        Object.entries(driverData).filter(([_, v]) => v !== undefined)
      );
      await addDoc(collection(db, 'drivers'), cleanData);
      showNotification(`Driver "${data.fullName}" added successfully!`, 'success');
    } catch (err) {
      console.error('Error creating driver:', err);
      showNotification('Failed to create driver. Please try again.', 'error');
      throw err;
    }
  };

  const handleUpdateDriver = async (data: Partial<Driver>) => {
    if (!editingDriver) return;
    try {
      const driverRef = doc(db, 'drivers', editingDriver.id);
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      await updateDoc(driverRef, cleanData);
      showNotification(`Driver "${data.fullName}" updated successfully!`, 'success');
    } catch (err) {
      console.error('Error updating driver:', err);
      showNotification('Failed to update driver. Please try again.', 'error');
      throw err;
    }
  };

  const handleDeactivateDriver = async () => {
    if (!deletingDriver) return;
    try {
      const driverRef = doc(db, 'drivers', deletingDriver.id);
      await updateDoc(driverRef, { status: 'inactive', updatedAt: new Date().toISOString() });
      showNotification(`Driver "${deletingDriver.fullName}" deactivated.`, 'success');
    } catch (err) {
      console.error('Error deactivating driver:', err);
      showNotification('Failed to deactivate driver.', 'error');
    }
  };

  const handleDeleteDriver = async () => {
    if (!deletingDriver) return;
    try {
      await deleteDoc(doc(db, 'drivers', deletingDriver.id));
      showNotification(`Driver "${deletingDriver.fullName}" deleted permanently.`, 'success');
    } catch (err) {
      console.error('Error deleting driver:', err);
      showNotification('Failed to delete driver.', 'error');
    }
  };

  // Sort handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export CSV
  const handleExport = () => {
    if (filteredDrivers.length === 0) {
      showNotification('No drivers to export.', 'error');
      return;
    }

    const escapeCSV = (val: string | number) => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['Driver ID', 'Full Name', 'CNIC', 'Phone', 'License Number', 'License Expiry', 'Status', 'Insurance', 'Insurance Company', 'Policy Number', 'Insurance Expiry', 'Co-Pilots Count', 'Address', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...filteredDrivers.map(d => [
        escapeCSV(d.driverId),
        escapeCSV(d.fullName),
        escapeCSV(d.cnic),
        escapeCSV(d.phone),
        escapeCSV(d.licenseNumber),
        escapeCSV(d.licenseExpiry),
        escapeCSV(d.status),
        d.insurance?.insured ? 'Yes' : 'No',
        escapeCSV(d.insurance?.company || ''),
        escapeCSV(d.insurance?.policyNumber || ''),
        escapeCSV(d.insurance?.expiry || ''),
        d.coPilots?.length || 0,
        escapeCSV(d.address || ''),
        escapeCSV(d.createdAt || ''),
      ].join(','))
    ].join('\n');

    // BOM for proper Unicode support in Excel
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `drivers_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${filteredDrivers.length} drivers successfully!`, 'success');
  };

  // Modal handlers
  const openAddModal = () => {
    setEditingDriver(null);
    setShowFormModal(true);
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setShowFormModal(true);
  };

  const openViewModal = (driver: Driver) => {
    setViewingDriver(driver);
  };

  const openDeleteModal = (driver: Driver) => {
    setDeletingDriver(driver);
  };

  return (
    <div className="h-full flex flex-col bg-[#07121A]">
      {/* Header */}
      <PageHeader
        title="Driver Management"
        subtitle={`${stats.total} drivers registered`}
        icon={<Users className="w-6 h-6 text-[#00E5FF]" />}
        actions={
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg hover:scale-105 transition-all duration-200 neon-glow text-sm"
          >
            <Plus className="w-4 h-4" /> Add Driver
          </button>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary Cards */}
        <DriverSummaryCards stats={stats} />

        {/* Filters */}
        <DriverFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          licenseFilter={licenseFilter}
          setLicenseFilter={setLicenseFilter}
          onExport={handleExport}
          totalDrivers={drivers.length}
          filteredCount={filteredDrivers.length}
        />

        {/* Table */}
        <DriverTable
          drivers={paginatedDrivers}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onView={openViewModal}
          onEdit={openEditModal}
          onDelete={openDeleteModal}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredDrivers.length}
          pageSize={pageSize}
          loading={loading}
        />
      </div>

      {/* Modals */}
      {showFormModal && (
        <DriverFormModal
          driver={editingDriver}
          onClose={() => { setShowFormModal(false); setEditingDriver(null); }}
          onSave={editingDriver ? handleUpdateDriver : handleCreateDriver}
        />
      )}

      {viewingDriver && (
        <DriverDetailsModal
          driver={viewingDriver}
          onClose={() => setViewingDriver(null)}
          onEdit={() => {
            const d = viewingDriver;
            setViewingDriver(null);
            openEditModal(d);
          }}
        />
      )}

      {deletingDriver && (
        <DeleteConfirmModal
          driver={deletingDriver}
          hasActiveRoute={hasActiveRoute(deletingDriver.fullName)}
          onClose={() => setDeletingDriver(null)}
          onDeactivate={handleDeactivateDriver}
          onDelete={handleDeleteDriver}
        />
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg border animate-fade-in ${
          notification.type === 'success'
            ? 'bg-[#0C1E2C] border-[#28B463]/50 shadow-[0_0_20px_rgba(40,180,99,0.3)]'
            : 'bg-[#0C1E2C] border-[#FF4D4D]/50 shadow-[0_0_20px_rgba(255,77,77,0.3)]'
        }`}>
          {notification.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 text-[#28B463] flex-shrink-0" />
            : <XCircle className="w-5 h-5 text-[#FF4D4D] flex-shrink-0" />
          }
          <span className="text-sm text-white">{notification.message}</span>
        </div>
      )}
    </div>
  );
}
