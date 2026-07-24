import { useState, useEffect } from 'react';
import { MapPin, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import { useStreetViewMetadata } from '../../hooks/useStreetViewMetadata';

interface StreetViewThumbnailProps {
  location: { lat: number; lng: number };
  heading?: number;
  size?: { width: number; height: number };
  className?: string;
  onExpand?: () => void;
  title?: string;
}

export function StreetViewThumbnail({
  location,
  heading = 0,
  size = { width: 320, height: 180 },
  className = '',
  onExpand,
  title,
}: StreetViewThumbnailProps) {
  const [metadata, setMetadata] = useState<{ available: boolean } | null>(null);
  const [imageError, setImageError] = useState(false);
  const { checkAvailability, isChecking } = useStreetViewMetadata();

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    setMetadata(null);
    setImageError(false);
    checkAvailability(location).then(setMetadata);
  }, [location.lat, location.lng, checkAvailability]);

  if (isChecking || metadata === null) {
    return (
      <div
        className={`bg-[#07121A] border border-[#00E5FF]/20 rounded-lg flex items-center justify-center ${className}`}
        style={{ width: size.width, height: size.height }}
      >
        <Loader2 className="w-6 h-6 text-[#00E5FF] animate-spin" />
      </div>
    );
  }

  if (!metadata.available || imageError) {
    return (
      <div
        className={`bg-[#07121A] border border-[#00E5FF]/20 rounded-lg flex flex-col items-center justify-center p-4 ${className}`}
        style={{ width: size.width, height: size.height }}
      >
        <AlertCircle className="w-6 h-6 text-[#D9DCE1]/40 mb-2" />
        <div className="text-xs text-[#D9DCE1]/60 text-center">
          Street View not available at this location
        </div>
      </div>
    );
  }

  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=${size.width}x${size.height}&location=${location.lat},${location.lng}&heading=${heading}&pitch=0&fov=90&key=${apiKey}`;

  return (
    <div className={`relative group ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-[#00E5FF]" />
          <span className="text-xs text-[#D9DCE1]/60">{title}</span>
        </div>
      )}
      <div
        className="relative rounded-lg overflow-hidden border border-[#00E5FF]/30"
        style={{ width: size.width, height: size.height }}
      >
        <img
          src={streetViewUrl}
          alt={`Street View at ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
        {onExpand && (
          <button
            onClick={onExpand}
            className="absolute top-2 right-2 p-2 bg-[#0C1E2C]/90 hover:bg-[#009FFD]/80 border border-[#00E5FF]/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <Maximize2 className="w-4 h-4 text-[#00E5FF]" />
          </button>
        )}
      </div>
    </div>
  );
}
