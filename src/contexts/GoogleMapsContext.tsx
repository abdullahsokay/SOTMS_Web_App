import { createContext, useContext, ReactNode } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places", "geometry", "drawing"];

interface GoogleMapsContextType {
    isLoaded: boolean;
    loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined);

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script-main',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDZ0QE8_i8BorwZ1N2URBVenyqfxYPfvAg',
        libraries
    });

    return (
        <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
            {children}
        </GoogleMapsContext.Provider>
    );
}

export function useGoogleMaps() {
    const context = useContext(GoogleMapsContext);
    if (context === undefined) {
        throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
    }
    return context;
}
