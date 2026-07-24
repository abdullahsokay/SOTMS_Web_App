import { X, MapPin } from 'lucide-react';
import { StreetViewThumbnail } from './StreetViewThumbnail';

interface StreetViewModalProps {
  location: { lat: number; lng: number; address?: string };
  heading?: number;
  onClose: () => void;
}

export function StreetViewModal({ location, heading, onClose }: StreetViewModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl shadow-2xl max-w-5xl w-full mx-4 overflow-hidden neon-glow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div>
            <h2 className="text-lg text-white neon-text">Street View</h2>
            {location.address && (
              <div className="text-xs text-[#D9DCE1]/60 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location.address}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all duration-200 hover:scale-110"
          >
            <X className="w-5 h-5 text-[#D9DCE1]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex justify-center">
          <StreetViewThumbnail
            location={location}
            heading={heading}
            size={{ width: 800, height: 450 }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#00E5FF]/20 bg-[#07121A] text-center">
          <div className="text-xs text-[#D9DCE1]/40">
            Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}
