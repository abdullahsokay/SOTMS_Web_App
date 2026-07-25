import { Home, MapPin, Droplet, Route, AlertTriangle, FileText, Settings, Users, Shield, Handshake } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'tracking', label: 'Live Tracking', icon: MapPin },
  { id: 'fuel', label: 'Fuel & Load', icon: Droplet },
  { id: 'routes', label: 'Route Management', icon: Route },
  { id: 'drivers', label: 'Drivers', icon: Users },
  { id: 'behaviour', label: 'Driver Behaviour', icon: Shield },
  { id: 'alerts', label: 'Alerts & Safety', icon: AlertTriangle },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'contracts', label: 'Contracts', icon: Handshake },
  { id: 'settings', label: 'Settings', icon: Settings }
];

// Contractors get a read-only oriented view: only the pages that make sense for
// a company viewing tankers/alerts shared with them during an active contract.
// Fleet owners (and any non-contractor) see the full menu.
const CONTRACTOR_PAGE_IDS = new Set(['dashboard', 'tracking', 'alerts', 'settings']);

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { companyType } = useCompany();
  const visibleMenuItems = companyType === 'contractor'
    ? menuItems.filter((item) => CONTRACTOR_PAGE_IDS.has(item.id))
    : menuItems;

  return (
    <div className="w-64 h-screen bg-[#0C1E2C] border-r border-[#00E5FF]/20 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-[#00E5FF]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#009FFD] to-[#00E5FF] rounded-lg flex items-center justify-center">
            <Droplet className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white neon-text">SOTMS</div>
            <div className="text-xs text-[#D9DCE1]/60">Smart Monitoring</div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-2">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 hover:translate-x-1 ${
                isActive
                  ? 'bg-[#009FFD]/20 border border-[#00E5FF]/50 text-[#00E5FF] neon-glow'
                  : 'text-[#D9DCE1] hover:bg-[#009FFD]/10 border border-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#00E5FF]/20">
        <div className="text-xs text-[#D9DCE1]/50 text-center">
          v2.0.1
        </div>
      </div>
    </div>
  );
}
