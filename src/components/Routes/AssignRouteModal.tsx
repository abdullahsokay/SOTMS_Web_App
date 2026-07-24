import { useState, useRef, useEffect } from 'react';
import { X, Route as RouteIcon, Truck, User, Building2, Search, Flag } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Route, Tanker, Driver } from '../../types';
import { DateTimePicker } from './DateTimePicker';

interface AssignRouteModalProps {
  routes: Route[];
  tankers: Tanker[];
  onClose: () => void;
  onAssign: (assignment: {
    routeId: string;
    tankerId: string;
    driverId: string;
    driverContact: string;
    company: string;
    departureDate: string;
    arrivalDate: string;
    notes: string;
    priority: 'Low' | 'Medium' | 'High';
  }) => void;
}

const companyColors = {
  PSO: '#28B463',
  Attock: '#009FFD',
  Shell: '#FFB02E',
  Hascol: '#9B59B6'
};

export function AssignRouteModal({ routes, tankers, onClose, onAssign }: AssignRouteModalProps) {
  const [formData, setFormData] = useState({
    routeId: '',
    tankerId: '',
    driverId: '',
    driverContact: '',
    company: 'PSO' as 'PSO' | 'Attock' | 'Shell' | 'Hascol',
    departureDate: '',
    arrivalDate: '',
    notes: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
  });

  const [routeSearch, setRouteSearch] = useState('');
  const [routeDropdownOpen, setRouteDropdownOpen] = useState(false);
  const routeDropdownRef = useRef<HTMLDivElement>(null);

  // Driver dropdown state
  const [activeDrivers, setActiveDrivers] = useState<Driver[]>([]);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);
  const driverDropdownRef = useRef<HTMLDivElement>(null);

  const unassignedRoutes = routes.filter(r => r.status === 'unassigned');
  const filteredUnassignedRoutes = unassignedRoutes.filter(r =>
    r.name.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.id.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.company.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.startLocation.address.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.endLocation.address.toLowerCase().includes(routeSearch.toLowerCase())
  );
  const availableTankers = tankers.filter(t => t.status !== 'offline');
  const selectedRoute = routes.find(r => r.id === formData.routeId);
  const selectedTanker = tankers.find(t => t.id === formData.tankerId);

  // Fetch active drivers from Firestore
  useEffect(() => {
    const q = query(collection(db, 'drivers'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const fetched = snapshot.docs
        .map(d => ({ ...d.data(), id: d.id } as Driver))
        .filter(d => new Date(d.licenseExpiry).getTime() > now.getTime());
      setActiveDrivers(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (routeDropdownRef.current && !routeDropdownRef.current.contains(e.target as Node)) {
        setRouteDropdownOpen(false);
      }
      if (driverDropdownRef.current && !driverDropdownRef.current.contains(e.target as Node)) {
        setDriverDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssign(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-white mb-1">Assign Route</h2>
              <p className="text-sm text-[#D9DCE1]/60">Assign a route to a tanker and driver</p>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all"
            >
              <X className="w-6 h-6 text-[#D9DCE1]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
          {/* Select Route — searchable dropdown */}
          <div ref={routeDropdownRef}>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-[#00E5FF]" />
              Select Route
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF] pointer-events-none" />
              <input
                type="text"
                value={selectedRoute ? `${selectedRoute.name} (${selectedRoute.id})` : routeSearch}
                onChange={(e) => {
                  setRouteSearch(e.target.value);
                  setRouteDropdownOpen(true);
                  if (formData.routeId) setFormData({ ...formData, routeId: '' });
                }}
                onFocus={() => setRouteDropdownOpen(true)}
                placeholder="Search routes by name, ID, company, or location..."
                className="w-full pl-10 pr-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all"
              />
              {selectedRoute && (
                <button
                  type="button"
                  title="Clear selection"
                  onClick={() => {
                    setFormData({ ...formData, routeId: '' });
                    setRouteSearch('');
                    setRouteDropdownOpen(true);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D9DCE1]/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {routeDropdownOpen && !selectedRoute && (
              <div className="mt-1 bg-[#0C1E2C] border border-[#00E5FF]/40 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.2)] max-h-48 overflow-y-auto custom-scrollbar">
                {filteredUnassignedRoutes.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[#D9DCE1]/50">No unassigned routes found</div>
                ) : (
                  filteredUnassignedRoutes.map((route) => (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, routeId: route.id });
                        setRouteSearch('');
                        setRouteDropdownOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-[#009FFD]/20 transition-colors border-b border-[#00E5FF]/10 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{route.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded text-white" style={{ backgroundColor: companyColors[route.company] }}>
                          {route.company}
                        </span>
                      </div>
                      <div className="text-xs text-[#D9DCE1]/50 mt-1">
                        {route.id} • {route.startLocation.address.split(',')[0]} → {route.endLocation.address.split(',')[0]}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected route info */}
            {selectedRoute && (
              <div className="mt-2 p-3 bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg text-sm">
                <div className="text-[#D9DCE1]/70">
                  {selectedRoute.startLocation.address} → {selectedRoute.endLocation.address}
                </div>
                <div className="text-xs text-[#D9DCE1]/50 mt-1">
                  {selectedRoute.distance} km • {Math.floor(selectedRoute.estimatedDuration / 60)}h {selectedRoute.estimatedDuration % 60}m
                </div>
              </div>
            )}
          </div>

          {/* Select Tanker */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#00E5FF]" />
              Select Tanker
            </label>
            <select
              value={formData.tankerId}
              onChange={(e) => setFormData({ ...formData, tankerId: e.target.value })}
              required
              aria-label="Select tanker"
              className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all"
            >
              <option value="">Choose a tanker...</option>
              {availableTankers.map((tanker) => (
                <option key={tanker.id} value={tanker.id}>
                  {tanker.id} - {tanker.name} (Fuel: {tanker.fuelLevel}% | Load: {(tanker.loadWeight / 1000).toFixed(1)}t)
                </option>
              ))}
            </select>
            {selectedTanker && (
              <div className="mt-2 p-3 bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#D9DCE1]/70">Status: <span className="text-[#28B463] capitalize">{selectedTanker.status}</span></span>
                  <span className="text-[#D9DCE1]/70">Location: {selectedTanker.location.address.split(',')[0]}</span>
                </div>
              </div>
            )}
          </div>

          {/* Select Driver — searchable dropdown */}
          <div ref={driverDropdownRef}>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-[#00E5FF]" />
              Select Driver
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF] pointer-events-none" />
              <input
                type="text"
                value={formData.driverId && activeDrivers.find(d => d.fullName === formData.driverId) ? formData.driverId : driverSearch}
                onChange={(e) => {
                  setDriverSearch(e.target.value);
                  setDriverDropdownOpen(true);
                  if (formData.driverId) setFormData({ ...formData, driverId: '' });
                }}
                onFocus={() => setDriverDropdownOpen(true)}
                placeholder="Search drivers by name, CNIC..."
                className="w-full pl-10 pr-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all"
              />
              {formData.driverId && (
                <button
                  type="button"
                  title="Clear selection"
                  onClick={() => {
                    setFormData({ ...formData, driverId: '', driverContact: '' });
                    setDriverSearch('');
                    setDriverDropdownOpen(true);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D9DCE1]/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {driverDropdownOpen && !formData.driverId && (
              <div className="mt-1 bg-[#0C1E2C] border border-[#00E5FF]/40 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.2)] max-h-48 overflow-y-auto custom-scrollbar">
                {(() => {
                  const filtered = activeDrivers.filter(d =>
                    d.fullName.toLowerCase().includes(driverSearch.toLowerCase()) ||
                    d.cnic.toLowerCase().includes(driverSearch.toLowerCase()) ||
                    d.driverId.toLowerCase().includes(driverSearch.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return <div className="px-4 py-3 text-sm text-[#D9DCE1]/50">No active drivers found</div>;
                  }
                  return filtered.map((driver) => (
                    <button
                      key={driver.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, driverId: driver.fullName, driverContact: driver.phone });
                        setDriverSearch('');
                        setDriverDropdownOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-[#009FFD]/20 transition-colors border-b border-[#00E5FF]/10 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{driver.fullName}</span>
                        <span className="text-[10px] text-[#00E5FF] font-mono">{driver.driverId}</span>
                      </div>
                      <div className="text-xs text-[#D9DCE1]/50 mt-1">
                        CNIC: {driver.cnic} &bull; {driver.phone}
                      </div>
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Company */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00E5FF]" />
              Company
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['PSO', 'Attock', 'Shell', 'Hascol'] as const).map((company) => (
                <button
                  key={company}
                  type="button"
                  onClick={() => setFormData({ ...formData, company })}
                  className={`px-4 py-3 rounded-lg transition-all duration-200 hover:scale-105 ${
                    formData.company === company
                      ? 'text-white neon-glow'
                      : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/20'
                  }`}
                  style={formData.company === company ? { backgroundColor: companyColors[company] } : {}}
                >
                  {company}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Flag className="w-4 h-4 text-[#00E5FF]" />
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Low', 'Medium', 'High'] as const).map((level) => {
                const colors = { Low: '#28B463', Medium: '#FFB02E', High: '#FF4D4D' };
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: level })}
                    className={`px-4 py-3 rounded-lg transition-all duration-200 hover:scale-105 ${
                      formData.priority === level
                        ? 'text-white neon-glow'
                        : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/20'
                    }`}
                    style={formData.priority === level ? { backgroundColor: colors[level] } : {}}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expected Departure Date/Time */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              Expected Departure
            </label>
            <DateTimePicker
              value={formData.departureDate}
              onChange={(val) => setFormData({ ...formData, departureDate: val })}
              placeholder="Select departure date & time..."
            />
          </div>

          {/* Expected Arrival Date/Time */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              Expected Arrival
            </label>
            <DateTimePicker
              value={formData.arrivalDate}
              onChange={(val) => setFormData({ ...formData, arrivalDate: val })}
              placeholder="Select arrival date & time..."
              min={formData.departureDate}
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="text-sm text-white mb-2 block">Additional Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any special instructions or notes..."
              className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#28B463] hover:bg-[#28B463]/80 text-white rounded-lg transition-all duration-200 hover:scale-105 neon-glow"
            >
              Confirm Assignment
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-[#D9DCE1]/20 hover:bg-[#D9DCE1]/30 text-[#D9DCE1] rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
