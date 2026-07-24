import 'leaflet/dist/leaflet.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/globals.css';
import { GPSProvider } from './contexts/GPSContext';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AlertsProvider } from './contexts/AlertsContext';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <GPSProvider>
          <GoogleMapsProvider>
            <AlertsProvider>
              <App />
            </AlertsProvider>
          </GoogleMapsProvider>
        </GPSProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);