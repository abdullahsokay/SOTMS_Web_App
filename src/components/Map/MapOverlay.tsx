import { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * Reliable map overlay that bypasses @react-google-maps/api's OverlayView
 * which has issues with React 18 StrictMode.
 * Uses the raw google.maps.OverlayView API + React portals.
 */
interface MapOverlayProps {
  position: google.maps.LatLngLiteral;
  children: ReactNode;
  getPixelPositionOffset?: (width: number, height: number) => { x: number; y: number };
}

export function MapOverlay({ position, children, getPixelPositionOffset }: MapOverlayProps) {
  const map = useGoogleMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const posRef = useRef(position);
  const offsetFnRef = useRef(getPixelPositionOffset);
  const [mounted, setMounted] = useState(false);

  // Keep refs in sync with latest props
  posRef.current = position;
  offsetFnRef.current = getPixelPositionOffset;

  useEffect(() => {
    if (!map) return;

    // Prevent double-init from StrictMode
    if (overlayRef.current) return;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.zIndex = '1000';
    containerRef.current = container;

    class CustomOverlay extends google.maps.OverlayView {
      onAdd() {
        const panes = this.getPanes();
        if (panes) {
          panes.floatPane.appendChild(container);
        }
        setMounted(true);
      }

      draw() {
        const projection = this.getProjection();
        if (!projection) return;

        const pos = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(posRef.current.lat, posRef.current.lng)
        );

        if (pos) {
          const w = container.offsetWidth;
          const h = container.offsetHeight;
          const offset = offsetFnRef.current
            ? offsetFnRef.current(w, h)
            : { x: -(w / 2), y: -h };
          container.style.left = `${pos.x + offset.x}px`;
          container.style.top = `${pos.y + offset.y}px`;
        }
      }

      onRemove() {
        container.remove();
        setMounted(false);
      }
    }

    const overlay = new CustomOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      containerRef.current = null;
      setMounted(false);
    };
  }, [map]);

  // Trigger redraw when position changes
  useEffect(() => {
    if (overlayRef.current) {
      (overlayRef.current as any).draw();
    }
  }, [position.lat, position.lng]);

  if (!mounted || !containerRef.current) return null;
  return createPortal(children, containerRef.current);
}
