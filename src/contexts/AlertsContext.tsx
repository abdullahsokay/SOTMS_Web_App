import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { ref, push, set } from 'firebase/database';
import { rtdb } from '../firebase';
import { useGPSData } from './GPSContext';

// Shared hatch-breach alert shape (also used by the Fuel page toast list).
export interface FuelAlert {
  id: string;
  tankerId: string;
  tankerName: string;
  message: string;
  type: 'suspicious' | 'alert' | 'hatch';
  timestamp: number;
  hatchId?: string;
  hatchLabel?: string;
  acknowledged?: boolean;
}

interface AlertsContextType {
  hatchAlerts: FuelAlert[];
  acknowledgeAllHatchAlerts: () => void;
  acknowledgeHatchAlert: (alertId: string) => void;
  alarmMuted: boolean;
  setAlarmMuted: React.Dispatch<React.SetStateAction<boolean>>;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

/**
 * Global provider for hatch-breach detection + the audible alarm.
 *
 * This lives ABOVE the pages (mounted in main.tsx inside GPSProvider) so that a
 * detected hatch breach — and the 880 Hz alarm that sounds until acknowledged —
 * survive navigation between pages. Previously this state, detection effect, and
 * alarm loop lived inside FuelLoadPage and were destroyed when the operator left
 * the Fuel page.
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const { tankers } = useGPSData();

  // ── Hatch alert system ──
  const [hatchAlerts, setHatchAlerts] = useState<FuelAlert[]>([]);
  const hatchAlertedRef = useRef<Set<string>>(new Set()); // "tankerId::hatchId" keys
  const [alarmMuted, setAlarmMuted] = useState(false);

  // Create alarm sound (Web Audio API beep — works without external file)
  const playAlarm = useCallback(() => {
    if (alarmMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.15;
      osc.start();
      // Beep pattern: on-off-on-off
      setTimeout(() => { gain.gain.value = 0; }, 200);
      setTimeout(() => { gain.gain.value = 0.15; }, 400);
      setTimeout(() => { gain.gain.value = 0; }, 600);
      setTimeout(() => { gain.gain.value = 0.15; }, 800);
      setTimeout(() => { osc.stop(); ctx.close(); }, 1000);
    } catch {}
  }, [alarmMuted]);

  // Repeat alarm every 5 seconds while unacknowledged hatch alerts exist
  useEffect(() => {
    const unacked = hatchAlerts.filter(a => !a.acknowledged);
    if (unacked.length === 0) return;
    playAlarm(); // play immediately
    const interval = setInterval(playAlarm, 5000);
    return () => clearInterval(interval);
  }, [hatchAlerts, playAlarm]);

  // ── Detect hatch opens from live tanker data ──
  useEffect(() => {
    const now = Date.now();
    for (const tanker of tankers) {
      if (tanker.status === 'offline' || !tanker.hatches) continue;
      for (const hatch of tanker.hatches) {
        const key = `${tanker.id}::${hatch.id}`;
        if (hatch.open && !hatchAlertedRef.current.has(key)) {
          hatchAlertedRef.current.add(key);

          const newAlert: FuelAlert = {
            id: `hatch-${tanker.id}-${hatch.id}-${now}`,
            tankerId: tanker.id,
            tankerName: tanker.name,
            message: `${hatch.label} OPENED on ${tanker.name}`,
            type: 'hatch',
            timestamp: now,
            hatchId: hatch.id,
            hatchLabel: hatch.label,
            acknowledged: false,
          };
          setHatchAlerts(prev => [newAlert, ...prev]);

          // Store alert in RTDB
          const alertRef = push(ref(rtdb, `alerts/${tanker.id}`));
          set(alertRef, {
            type: 'hatch_open',
            hatchId: hatch.id,
            hatchLabel: hatch.label,
            tankerName: tanker.name,
            timestamp: now,
            message: newAlert.message,
            acknowledged: false,
          }).catch(() => {});

        } else if (!hatch.open && hatchAlertedRef.current.has(key)) {
          hatchAlertedRef.current.delete(key);
        }
      }
    }
  }, [tankers]);

  // Acknowledge a hatch alert (stops alarm for that alert)
  const acknowledgeHatchAlert = useCallback((alertId: string) => {
    setHatchAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
  }, []);

  // Acknowledge all
  const acknowledgeAllHatchAlerts = useCallback(() => {
    setHatchAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
  }, []);

  return (
    <AlertsContext.Provider
      value={{ hatchAlerts, acknowledgeAllHatchAlerts, acknowledgeHatchAlert, alarmMuted, setAlarmMuted }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}
