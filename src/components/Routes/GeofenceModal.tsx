import { useState } from 'react';
import { X, Target, Shield, Bell, Minus, Plus, MapPin, Radio } from 'lucide-react';
import { GeofenceType, GeofenceAlertOn } from '../../types';

interface GeofenceModalProps {
  position: { lat: number; lng: number };
  initialRadius: number;
  onClose: () => void;
  onSave: (data: {
    name: string;
    type: GeofenceType;
    alertOn: GeofenceAlertOn;
    radius: number;
    color: string;
    notes: string;
  }) => void;
}

const typeOptions: Array<{ value: GeofenceType; label: string; icon: string; desc: string }> = [
  { value: 'restricted_zone', label: 'Restricted', icon: '🚫', desc: 'No-go area' },
  { value: 'safe_zone', label: 'Safe Zone', icon: '🛡️', desc: 'Secure area' },
  { value: 'checkpoint', label: 'Checkpoint', icon: '📍', desc: 'Stop point' },
  { value: 'depot', label: 'Depot', icon: '🏭', desc: 'Terminal' },
  { value: 'delivery_zone', label: 'Delivery', icon: '📦', desc: 'Drop-off' },
];

const alertOptions: Array<{ value: GeofenceAlertOn; label: string; icon: string }> = [
  { value: 'entry', label: 'Entry', icon: '→' },
  { value: 'exit', label: 'Exit', icon: '←' },
  { value: 'both', label: 'Both', icon: '⇄' },
];

const typeColors: Record<GeofenceType, string> = {
  restricted_zone: '#FF4D4D',
  safe_zone: '#28B463',
  checkpoint: '#FFB02E',
  depot: '#9B59B6',
  delivery_zone: '#009FFD',
};

export function GeofenceModal({ position, initialRadius, onClose, onSave }: GeofenceModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'checkpoint' as GeofenceType,
    alertOn: 'both' as GeofenceAlertOn,
    radius: initialRadius,
    notes: '',
  });
  const [showNotes, setShowNotes] = useState(false);

  const color = typeColors[formData.type];
  const radiusDisplay = formData.radius >= 1000
    ? `${(formData.radius / 1000).toFixed(1)} km`
    : `${formData.radius} m`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave({
      ...formData,
      name: formData.name.trim(),
      color,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-[420px] mx-4 rounded-xl overflow-hidden shadow-2xl animate-scale-in"
        style={{
          background: 'linear-gradient(180deg, #0E2233 0%, #091820 100%)',
          border: `1px solid ${color}30`,
          boxShadow: `0 0 40px ${color}15, 0 20px 60px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Header — compact with color accent */}
        <div className="relative px-5 pt-4 pb-3">
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
              >
                <Target className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-white leading-tight">New Geofence</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-[#D9DCE1]/40" />
                  <span className="text-[11px] text-[#D9DCE1]/50 font-mono">
                    {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-[#D9DCE1]/60" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-3.5 overflow-y-auto max-h-[calc(85vh-80px)] custom-scrollbar">

          {/* Name Input */}
          <div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Geofence name..."
              required
              autoFocus
              className="w-full px-3.5 py-2.5 bg-[#07121A] border border-white/10 rounded-lg text-sm text-white placeholder-[#D9DCE1]/30 focus:outline-none focus:border-[#00E5FF]/50 transition-colors"
            />
          </div>

          {/* Zone Type — horizontal pill row */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#D9DCE1]/40 font-medium mb-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              Zone Type
            </label>
            <div className="flex gap-1.5">
              {typeOptions.map((opt) => {
                const isSelected = formData.type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: opt.value })}
                    className="flex-1 py-2 rounded-lg transition-all duration-150 flex flex-col items-center gap-0.5"
                    style={{
                      backgroundColor: isSelected ? typeColors[opt.value] : '#07121A',
                      border: `1px solid ${isSelected ? typeColors[opt.value] : 'rgba(255,255,255,0.08)'}`,
                      color: isSelected ? '#fff' : '#8899AA',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    }}
                    title={opt.desc}
                  >
                    <span className="text-sm leading-none">{opt.icon}</span>
                    <span className="text-[9px] font-medium leading-none mt-0.5">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alert Trigger + Radius — side by side */}
          <div className="flex gap-3">
            {/* Alert Trigger */}
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wider text-[#D9DCE1]/40 font-medium mb-2 flex items-center gap-1.5">
                <Bell className="w-3 h-3" />
                Alert On
              </label>
              <div className="flex gap-1">
                {alertOptions.map((opt) => {
                  const isSelected = formData.alertOn === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, alertOn: opt.value })}
                      className="flex-1 py-2 rounded-md text-center transition-all duration-150"
                      style={{
                        backgroundColor: isSelected ? '#009FFD' : '#07121A',
                        border: `1px solid ${isSelected ? '#009FFD' : 'rgba(255,255,255,0.08)'}`,
                        color: isSelected ? '#fff' : '#8899AA',
                      }}
                    >
                      <div className="text-[10px] font-medium">{opt.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Radius Control — polished slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] uppercase tracking-wider text-[#D9DCE1]/40 font-medium flex items-center gap-1.5">
                <Radio className="w-3 h-3" />
                Radius
              </label>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {radiusDisplay}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Decrease radius"
                onClick={() => setFormData({ ...formData, radius: Math.max(100, formData.radius - (formData.radius > 5000 ? 1000 : 500)) })}
                className="w-7 h-7 flex items-center justify-center bg-[#07121A] border border-white/10 rounded-md text-[#D9DCE1]/60 hover:border-[#00E5FF]/40 hover:text-[#00E5FF] transition-colors"
              >
                <Minus size={12} />
              </button>
              <div className="flex-1 relative">
                <input
                  type="range"
                  title="Geofence radius"
                  min="100"
                  max="50000"
                  step="100"
                  value={formData.radius}
                  onChange={(e) => setFormData({ ...formData, radius: Number(e.target.value) })}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${color} 0%, ${color} ${((formData.radius - 100) / 49900) * 100}%, #1a2a3a ${((formData.radius - 100) / 49900) * 100}%, #1a2a3a 100%)`,
                  }}
                />
              </div>
              <button
                type="button"
                title="Increase radius"
                onClick={() => setFormData({ ...formData, radius: Math.min(50000, formData.radius + (formData.radius >= 5000 ? 1000 : 500)) })}
                className="w-7 h-7 flex items-center justify-center bg-[#07121A] border border-white/10 rounded-md text-[#D9DCE1]/60 hover:border-[#00E5FF]/40 hover:text-[#00E5FF] transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="flex justify-between text-[9px] text-[#D9DCE1]/25 mt-1 px-9">
              <span>100m</span>
              <span>25km</span>
              <span>50km</span>
            </div>
          </div>

          {/* Live Preview Card */}
          <div
            className="rounded-lg p-3 flex items-center gap-3"
            style={{
              backgroundColor: `${color}08`,
              border: `1px solid ${color}25`,
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}20`, border: `2px solid ${color}50` }}
            >
              <span className="text-sm">{typeOptions.find(t => t.value === formData.type)?.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {formData.name || 'Untitled Geofence'}
              </div>
              <div className="text-[10px] text-[#D9DCE1]/50 mt-0.5">
                {typeOptions.find(t => t.value === formData.type)?.desc} · {formData.alertOn} alert · {radiusDisplay}
              </div>
            </div>
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
            />
          </div>

          {/* Optional Notes Toggle */}
          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-[11px] text-[#D9DCE1]/40 hover:text-[#D9DCE1]/60 transition-colors flex items-center gap-1"
            >
              <Plus size={10} />
              Add notes
            </button>
          ) : (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#D9DCE1]/40 font-medium mb-1.5 block">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Additional details..."
                autoFocus
                className="w-full px-3.5 py-2.5 bg-[#07121A] border border-white/10 rounded-lg text-sm text-white placeholder-[#D9DCE1]/30 focus:outline-none focus:border-[#00E5FF]/50 transition-colors resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg transition-all duration-200 hover:brightness-110 flex items-center justify-center gap-2 text-white text-sm font-medium"
              style={{
                backgroundColor: color,
                boxShadow: `0 2px 12px ${color}40`,
              }}
            >
              <Target className="w-3.5 h-3.5" />
              Create Geofence
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-[#D9DCE1]/70 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
