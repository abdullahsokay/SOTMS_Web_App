import { useState } from 'react';
import { X, AlertTriangle, Shield, FileText } from 'lucide-react';

interface BlackSpotModalProps {
  position: { lat: number; lng: number };
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    threatLevel: 'low' | 'medium' | 'high';
    confidenceLevel: 'low' | 'medium' | 'high';
    notes: string;
  }) => void;
}

const threatColors = { low: '#FFD93D', medium: '#FFB02E', high: '#FF4D4D' };
const confidenceColors = { low: '#D9DCE1', medium: '#009FFD', high: '#28B463' };

export function BlackSpotModal({ position, onClose, onSave }: BlackSpotModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    threatLevel: 'medium' as 'low' | 'medium' | 'high',
    confidenceLevel: 'medium' as 'low' | 'medium' | 'high',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#FF4D4D]/30 rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-[#FF4D4D]/20 bg-gradient-to-r from-[#0C1E2C] to-[#1A0A0A]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl text-white mb-1 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#FF4D4D]" />
                Add Black Spot
              </h2>
              <p className="text-xs text-[#D9DCE1]/60">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </p>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 hover:bg-[#FF4D4D]/20 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-[#D9DCE1]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          {/* Name */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF4D4D]" />
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Highway Robbery Zone, Flood-Prone Area"
              required
              autoFocus
              className="w-full px-4 py-3 bg-[#07121A] border border-[#FF4D4D]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#FF4D4D] transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF4D4D]" />
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Describe the threat or hazard at this location..."
              required
              className="w-full px-4 py-3 bg-[#07121A] border border-[#FF4D4D]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#FF4D4D] transition-all resize-none"
            />
          </div>

          {/* Threat Level */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF4D4D]" />
              Threat Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, threatLevel: level })}
                  className={`px-4 py-3 rounded-lg capitalize transition-all duration-200 hover:scale-105 ${
                    formData.threatLevel === level
                      ? 'text-white neon-glow'
                      : 'bg-[#07121A] text-[#D9DCE1] border border-[#FF4D4D]/20'
                  }`}
                  style={formData.threatLevel === level ? { backgroundColor: threatColors[level] } : {}}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Level */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#009FFD]" />
              Confidence Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, confidenceLevel: level })}
                  className={`px-4 py-3 rounded-lg capitalize transition-all duration-200 hover:scale-105 ${
                    formData.confidenceLevel === level
                      ? 'text-white neon-glow'
                      : 'bg-[#07121A] text-[#D9DCE1] border border-[#009FFD]/20'
                  }`}
                  style={formData.confidenceLevel === level ? { backgroundColor: confidenceColors[level] } : {}}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm text-white mb-2 block">Additional Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any additional details or context..."
              className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#FF4D4D] hover:bg-[#FF4D4D]/80 text-white rounded-lg transition-all duration-200 hover:scale-105 neon-glow flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Mark Black Spot
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
