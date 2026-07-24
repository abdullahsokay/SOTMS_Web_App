import { useState } from 'react';
import { Route } from '../../types';
import { X, ChevronRight, Truck, User, MapPin, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';

interface RouteListPanelProps {
  routes: Route[];
  selectedRoute: Route | null;
  onSelectRoute: (route: Route) => void;
  onClose: () => void;
  onDelete: (routeId: string) => void;
}

const companyColors = {
  PSO: '#28B463',
  Attock: '#009FFD',
  Shell: '#FFB02E',
  Hascol: '#9B59B6'
};

const statusColors = {
  'active': { bg: 'bg-[#28B463]/20', text: 'text-[#28B463]', border: 'border-[#28B463]/30' },
  'not-started': { bg: 'bg-[#FFB02E]/20', text: 'text-[#FFB02E]', border: 'border-[#FFB02E]/30' },
  'completed': { bg: 'bg-[#00E5FF]/20', text: 'text-[#00E5FF]', border: 'border-[#00E5FF]/30' },
  'unassigned': { bg: 'bg-[#D9DCE1]/20', text: 'text-[#D9DCE1]', border: 'border-[#D9DCE1]/30' }
};

export function RouteListPanel({ routes, selectedRoute, onSelectRoute, onClose, onDelete }: RouteListPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'company' | 'assigned' | 'unassigned'>('all');
  const [companyFilter, setCompanyFilter] = useState<'PSO' | 'Attock' | 'Shell' | 'Hascol' | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);

  const filteredRoutes = routes.filter(route => {
    if (activeTab === 'assigned') return route.status !== 'unassigned';
    if (activeTab === 'unassigned') return route.status === 'unassigned';
    if (activeTab === 'company' && companyFilter) return route.company === companyFilter;
    return true;
  });

  return (
    <div className="w-96 bg-[#0C1E2C] border-r border-[#00E5FF]/20 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[#00E5FF]/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg text-white">Routes</h2>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 hover:bg-[#009FFD]/20 rounded transition-all"
          >
            <X className="w-5 h-5 text-[#D9DCE1]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('all'); setCompanyFilter(null); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'all'
              ? 'bg-[#009FFD] text-white neon-glow'
              : 'bg-[#009FFD]/10 text-[#00E5FF] hover:bg-[#009FFD]/20'
              }`}
          >
            All Routes
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'company'
              ? 'bg-[#009FFD] text-white neon-glow'
              : 'bg-[#009FFD]/10 text-[#00E5FF] hover:bg-[#009FFD]/20'
              }`}
          >
            Company
          </button>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => { setActiveTab('assigned'); setCompanyFilter(null); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'assigned'
              ? 'bg-[#009FFD] text-white neon-glow'
              : 'bg-[#009FFD]/10 text-[#00E5FF] hover:bg-[#009FFD]/20'
              }`}
          >
            Assigned
          </button>
          <button
            onClick={() => { setActiveTab('unassigned'); setCompanyFilter(null); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'unassigned'
              ? 'bg-[#009FFD] text-white neon-glow'
              : 'bg-[#009FFD]/10 text-[#00E5FF] hover:bg-[#009FFD]/20'
              }`}
          >
            Unassigned
          </button>
        </div>

        {/* Company Filter Pills */}
        {activeTab === 'company' && (
          <div className="flex gap-2 mt-3 animate-fade-in">
            {(['PSO', 'Attock', 'Shell', 'Hascol'] as const).map((company) => (
              <button
                key={company}
                onClick={() => setCompanyFilter(company)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${companyFilter === company
                  ? 'bg-[#009FFD] text-white neon-glow'
                  : 'bg-[#009FFD]/10 text-[#00E5FF] hover:bg-[#009FFD]/20 border border-[#00E5FF]/20'
                  }`}
              >
                {company}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Route List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-3 space-y-2">
          {filteredRoutes.map((route) => {
            const statusStyle = statusColors[route.status] ?? statusColors.unassigned;
            const isSelected = selectedRoute?.id === route.id;

            return (
              <div
                key={route.id}
                onClick={() => onSelectRoute(route)}
                className={`bg-[#07121A] border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected
                  ? 'border-[#00E5FF] neon-glow'
                  : 'border-[#00E5FF]/20 hover:border-[#00E5FF]/40'
                  }`}
              >
                {/* Route Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white text-sm">{route.name}</h3>
                      <ChevronRight className="w-4 h-4 text-[#00E5FF]" />
                    </div>
                    <div className="text-xs text-[#D9DCE1]/60">{route.id}</div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActionMenu(showActionMenu === route.id ? null : route.id);
                      }}
                      title="Route actions"
                      className="p-1 hover:bg-[#009FFD]/20 rounded transition-all"
                    >
                      <MoreVertical className="w-4 h-4 text-[#D9DCE1]" />
                    </button>

                    {showActionMenu === route.id && (
                      <div className="absolute right-0 top-8 bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg shadow-xl z-50 min-w-[120px] animate-fade-in">
                        <button className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#009FFD]/20 flex items-center gap-2 transition-all">
                          <Eye className="w-4 h-4" /> View
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#009FFD]/20 flex items-center gap-2 transition-all">
                          <Edit className="w-4 h-4" /> Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(route.id);
                            setShowActionMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-[#FF4D4D] hover:bg-[#FF4D4D]/20 flex items-center gap-2 transition-all"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Route Details */}
                <div className="space-y-2">
                  {/* Start → End */}
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin className="w-3 h-3 text-[#28B463]" />
                    <span className="text-[#D9DCE1]/80 truncate">
                      {route.startLocation?.address?.split(',')[0] ?? '—'}
                    </span>
                    <span className="text-[#00E5FF]">→</span>
                    <MapPin className="w-3 h-3 text-[#FF4D4D]" />
                    <span className="text-[#D9DCE1]/80 truncate">
                      {route.endLocation?.address?.split(',')[0] ?? '—'}
                    </span>
                  </div>

                  {/* Assigned Info */}
                  {route.assignedTanker && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Truck className="w-3 h-3 text-[#00E5FF]" />
                        <span className="text-[#D9DCE1]/70">{route.assignedTanker}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-[#00E5FF]" />
                        <span className="text-[#D9DCE1]/70">{route.assignedDriver}</span>
                      </div>
                    </div>
                  )}

                  {/* Footer: Company & Status */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#00E5FF]/10">
                    <div
                      className="px-2 py-1 rounded text-xs text-white"
                      style={{ backgroundColor: companyColors[route.company] }}
                    >
                      {route.company}
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      {(route.status ?? 'unassigned').replace('-', ' ')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Count */}
      <div className="p-4 border-t border-[#00E5FF]/20 bg-[#07121A]">
        <div className="text-sm text-[#D9DCE1]/60">
          Showing <span className="text-[#00E5FF]">{filteredRoutes.length}</span> routes
        </div>
      </div>
    </div>
  );
}
