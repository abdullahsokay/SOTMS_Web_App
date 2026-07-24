import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useGPSData } from '../../hooks/useGPSData';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { Route, BlackSpot } from '../../types';
import { RouteMapView } from './RouteMapView';
import { RouteListPanel } from './RouteListPanel';
import { RouteDetailsPanel } from './RouteDetailsPanel';
import { AssignRouteModal } from './AssignRouteModal';
import { CreateRouteModal } from './CreateRouteModal';
import { RouteNavBar } from './RouteNavBar';
import { genId } from '../../utils/id';

export function RouteManagementPage() {
  const { tankers, positionHistory } = useGPSData();
  const { trackingData } = useVehicleTracking();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [blackSpots, setBlackSpots] = useState<BlackSpot[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRouteList, setShowRouteList] = useState(true);
  const [showBlackSpots, setShowBlackSpots] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch Routes
  useEffect(() => {
    const q = query(collection(db, 'routes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRoutes = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Route));
      setRoutes(fetchedRoutes);
    });
    return () => unsubscribe();
  }, []);

  // Fetch BlackSpots (Optional, if collection exists, otherwise empty or hardcoded logic if preferred. User asked for proper connect)
  // Assuming a 'blackspots' collection exists or we create an empty one.
  useEffect(() => {
    const q = query(collection(db, 'blackspots')); // No specific order needed
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBS = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BlackSpot));
      setBlackSpots(fetchedBS);
    });
    return () => unsubscribe();
  }, []);

  const filteredRoutes = useMemo(() =>
    routes.filter(route =>
      route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.assignedTanker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.assignedDriver?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [routes, searchQuery]
  );

  // Behavior 3: Auto-select the first assigned route when search matches
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSelectedRoute(null);
      return;
    }

    const firstAssignedMatch = filteredRoutes.find(
      r => r.assignedTanker && r.status !== 'unassigned'
    );

    if (firstAssignedMatch) {
      setSelectedRoute(prev =>
        prev?.id === firstAssignedMatch.id ? prev : firstAssignedMatch
      );
    }
  }, [searchQuery, filteredRoutes]);

  const handleExport = () => {
    if (filteredRoutes.length === 0) return;

    const headers = ['ID', 'Route Name', 'Company', 'Start Location', 'End Location', 'Distance (km)', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredRoutes.map(route => [
        route.id,
        `"${route.name}"`,
        route.company,
        `"${route.startLocation.address}"`,
        `"${route.endLocation.address}"`,
        route.distance,
        route.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'routes_report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewAll = () => {
    setShowRouteList(!showRouteList);
    if (!showRouteList) {
      setSearchQuery('');
    }
  };

  // Auto-dismiss notification
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  const handleCreateRoute = async (newRoute: Partial<Route>) => {
    try {
      // Strip undefined values — Firestore rejects them
      const cleanData = Object.fromEntries(
        Object.entries(newRoute).filter(([_, v]) => v !== undefined)
      );

      if (newRoute.id) {
        await setDoc(doc(db, 'routes', newRoute.id), cleanData);
      } else {
        await addDoc(collection(db, 'routes'), cleanData);
      }
      setShowCreateModal(false);
      showNotification(`Route "${newRoute.name}" created successfully!`, 'success');
    } catch (e) {
      console.error("Error creating route:", e);
      showNotification('Failed to create route. Please try again.', 'error');
    }
  };

  const handleAssignRoute = async (assignment: {
    routeId: string;
    tankerId: string;
    driverId: string;
    driverContact: string;
    company: string;
    departureDate: string;
    arrivalDate: string;
    notes: string;
    priority: 'Low' | 'Medium' | 'High';
  }) => {
    try {
      const routeRef = doc(db, 'routes', assignment.routeId);

      // Update route with selected driver (not from tanker)
      await updateDoc(routeRef, {
        assignedTanker: assignment.tankerId,
        assignedDriver: assignment.driverId,
        assignedDriverContact: assignment.driverContact,
        status: 'active',
        lastUsed: new Date().toISOString()
      });

      // Create assignment record in assignments collection
      const assignmentId = genId('ASSIGN');
      await addDoc(collection(db, 'assignments'), {
        assignmentId,
        routeId: assignment.routeId,
        tankerId: assignment.tankerId,
        driverId: assignment.driverId,
        company: assignment.company,
        status: 'scheduled',
        scheduledStart: assignment.departureDate,
        scheduledEnd: assignment.arrivalDate,
        priority: assignment.priority,
        notes: assignment.notes,
        createdAt: new Date().toISOString(),
      });

      // Update driver stats (lastAssignment + totalTrips)
      if (assignment.driverId) {
        try {
          const driversQuery = query(
            collection(db, 'drivers'),
            where('fullName', '==', assignment.driverId)
          );
          const driverSnap = await getDocs(driversQuery);
          if (!driverSnap.empty) {
            const driverDoc = driverSnap.docs[0];
            const driverData = driverDoc.data();
            await updateDoc(doc(db, 'drivers', driverDoc.id), {
              'stats.lastAssignment': new Date().toISOString(),
              'stats.totalTrips': (driverData.stats?.totalTrips || 0) + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error('Error updating driver stats:', err);
        }
      }

      setShowAssignModal(false);
      showNotification('Route assigned successfully!', 'success');

      // Auto-select the assigned route so the map zooms to it and highlights it
      const assignedRoute = routes.find(r => r.id === assignment.routeId);
      if (assignedRoute) {
        setSelectedRoute({
          ...assignedRoute,
          assignedTanker: assignment.tankerId,
          assignedDriver: assignment.driverId,
          assignedDriverContact: assignment.driverContact,
          status: 'active',
        });
      }
    } catch (e) {
      console.error("Error assigning route:", e);
      showNotification('Failed to assign route. Please try again.', 'error');
    }
  };

  const handleUpdateRoute = async (updatedRoute: Route) => {
    try {
      const routeRef = doc(db, 'routes', updatedRoute.id);
      // Destructure to remove ID from data if needed, but updateDoc ignores it if not in data payload
      // Just update fields
      await updateDoc(routeRef, { ...updatedRoute });
      setSelectedRoute(updatedRoute);
    } catch (e) {
      console.error("Error updating route:", e);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!window.confirm("Are you sure you want to delete this route?")) return;
    try {
      await deleteDoc(doc(db, 'routes', routeId));
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(null);
      }
    } catch (e) {
      console.error("Error deleting route:", e);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#07121A]">
      {/* Navigation Bar */}
      <RouteNavBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreateRoute={() => setShowCreateModal(true)}
        onAssignRoute={() => setShowAssignModal(true)}
        onViewAll={handleViewAll}
        onExport={handleExport}
        totalRoutes={routes.length}
        filteredRoutes={filteredRoutes.length}
        showRouteList={showRouteList}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - Route List */}
        {showRouteList && (
          <RouteListPanel
            routes={filteredRoutes}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
            onClose={() => setShowRouteList(false)}
            onDelete={handleDeleteRoute}
          />
        )}

        {/* Center - Map View */}
        <div className="flex-1">
          <RouteMapView
            routes={filteredRoutes}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
            tankers={tankers}
            blackSpots={blackSpots}
            showBlackSpots={showBlackSpots}
            onToggleBlackSpots={setShowBlackSpots}
            onToggleRouteList={() => setShowRouteList(!showRouteList)}
            showRouteList={showRouteList}
            positionHistory={positionHistory}
            onUpdateRoute={handleUpdateRoute}
            trackingData={trackingData}
            onSaveRoute={handleCreateRoute}
            onAssignRoute={() => setShowAssignModal(true)}
          />
        </div>

        {/* Right Panel - Route Details */}
        {selectedRoute && (
          <RouteDetailsPanel
            route={selectedRoute}
            onClose={() => setSelectedRoute(null)}
            onUpdate={handleUpdateRoute}
          />
        )}
      </div>

      {/* Modals */}
      {showAssignModal && (
        <AssignRouteModal
          routes={routes}
          tankers={tankers}
          onClose={() => setShowAssignModal(false)}
          onAssign={handleAssignRoute}
        />
      )}

      {showCreateModal && (
        <CreateRouteModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoute}
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