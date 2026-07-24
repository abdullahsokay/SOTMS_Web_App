import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGoogleMaps } from '../../contexts/GoogleMapsContext';
import { Loader2 } from 'lucide-react';

interface PlacesAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

export function PlacesAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Search for a location...',
  icon,
}: PlacesAutocompleteInputProps) {
  const { isLoaded } = useGoogleMaps();
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const placesDiv = useRef<HTMLDivElement | null>(null);
  const skipNextChange = useRef(false);

  // Initialize services once Maps API is loaded
  useEffect(() => {
    if (isLoaded && !autocompleteService.current) {
      try {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        // PlacesService requires an HTML element (not displayed)
        if (!placesDiv.current) {
          placesDiv.current = document.createElement('div');
        }
        placesService.current = new google.maps.places.PlacesService(placesDiv.current);
        console.log('[PlacesAutocomplete] Services initialized');
      } catch (err) {
        console.error('[PlacesAutocomplete] Failed to initialize services:', err);
      }
    }
  }, [isLoaded]);

  // Update dropdown position when open
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteService.current || input.trim().length < 2) {
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    autocompleteService.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'pk' },
      },
      (results, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
          setIsOpen(true);
        } else {
          console.warn('[PlacesAutocomplete] Prediction failed:', status, 'for input:', input);
          setPredictions([]);
          setIsOpen(false);
        }
      }
    );
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (skipNextChange.current) {
      skipNextChange.current = false;
      return;
    }

    setActiveIndex(-1);

    // Debounce API calls
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    const address = prediction.description;

    // Immediately update the input text and close dropdown
    skipNextChange.current = true;
    onChange(address);
    setPredictions([]);
    setIsOpen(false);
    setActiveIndex(-1);

    if (!placesService.current) {
      console.error('[PlacesAutocomplete] PlacesService not initialized');
      return;
    }

    setIsLoading(true);
    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry'] },
      (place, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          onSelect({
            address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
          console.log('[PlacesAutocomplete] Selected:', address, place.geometry.location.lat(), place.geometry.location.lng());
        } else {
          console.error('[PlacesAutocomplete] getDetails failed:', status, 'for placeId:', prediction.place_id);
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || predictions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < predictions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : predictions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelectPrediction(predictions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              updateDropdownPosition();
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full px-3.5 py-2.5 bg-[#1E293B]/60 border border-white/[0.08] rounded-xl text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#3B82F6]/50 focus:bg-[#1E293B] transition-all ${icon ? 'pl-9' : ''}`}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-[#3B82F6] animate-spin" />
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown — rendered via portal to avoid overflow clipping */}
      {isOpen && predictions.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="bg-[#1E293B] border border-white/[0.12] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden max-h-60 overflow-y-auto custom-scrollbar"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectPrediction(prediction);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`w-full px-3.5 py-2.5 text-left text-sm transition-colors flex items-start gap-3 ${
                index === activeIndex
                  ? 'bg-[#3B82F6]/20 text-white'
                  : 'text-[#94A3B8] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#3B82F6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {prediction.structured_formatting.main_text}
                </div>
                <div className="text-[11px] text-[#475569] truncate">
                  {prediction.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
