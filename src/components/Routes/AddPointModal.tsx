import { useState } from 'react';
import { X, MapPin, Tag } from 'lucide-react';

interface AddPointModalProps {
  position: { lat: number; lng: number };
  onClose: () => void;
  onConfirm: (data: { name: string; type: 'waypoint' | 'stop' | 'delivery' }) => void;
}

const typeOptions: Array<{ value: 'waypoint' | 'stop' | 'delivery'; label: string; color: string }> = [
  { value: 'waypoint', label: 'Waypoint', color: '#00E5FF' },
  { value: 'stop', label: 'Stop', color: '#9B59B6' },
  { value: 'delivery', label: 'Delivery', color: '#FFB02E' },
];

export function AddPointModal({ position, onClose, onConfirm }: AddPointModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'waypoint' | 'stop' | 'delivery'>('waypoint');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      name: name.trim() || `Point (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`,
      type,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl max-w-md w-full mx-4 overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl text-white mb-1">Add Waypoint</h2>
              <p className="text-xs text-[#D9DCE1]/60">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </p>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-[#D9DCE1]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#00E5FF]" />
              Waypoint Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Fuel Check Station"
              autoFocus
              className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#00E5FF]" />
              Point Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`px-4 py-3 rounded-lg capitalize transition-all duration-200 hover:scale-105 ${
                    type === opt.value
                      ? 'text-white neon-glow'
                      : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/20'
                  }`}
                  style={type === opt.value ? { backgroundColor: opt.color } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#28B463] hover:bg-[#28B463]/80 text-white rounded-lg transition-all duration-200 hover:scale-105 neon-glow"
            >
              Add Point
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
