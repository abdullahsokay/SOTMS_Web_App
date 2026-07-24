import { useState, useRef, useCallback, useEffect } from 'react';
import { HistoricalGPSPoint } from '../types/tracking';

type ReplaySpeed = 1 | 2 | 5 | 10;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpBearing(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

export function usePathReplay(points: HistoricalGPSPoint[], enabled: boolean) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState<ReplaySpeed>(1);
  const [progress, setProgress] = useState(0); // 0-100
  const [replayPosition, setReplayPosition] = useState<HistoricalGPSPoint | null>(null);

  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const speedRef = useRef<ReplaySpeed>(1);

  // Keep speedRef in sync
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Total duration of the path in ms
  const totalDuration =
    points.length >= 2 ? points[points.length - 1].timestamp - points[0].timestamp : 0;

  // Reset when points change or disabled
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setReplayPosition(null);
    elapsedRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [points, enabled]);

  const getPositionAtElapsed = useCallback(
    (elapsed: number): HistoricalGPSPoint | null => {
      if (points.length === 0) return null;
      if (points.length === 1) return points[0];

      const startTs = points[0].timestamp;
      const targetTs = startTs + elapsed;

      // Find the two surrounding points
      let idx = 0;
      for (let i = 0; i < points.length - 1; i++) {
        if (points[i + 1].timestamp >= targetTs) {
          idx = i;
          break;
        }
        idx = i;
      }

      const p0 = points[idx];
      const p1 = points[Math.min(idx + 1, points.length - 1)];

      if (p0 === p1 || p0.timestamp === p1.timestamp) return p0;

      const t = Math.min(1, Math.max(0, (targetTs - p0.timestamp) / (p1.timestamp - p0.timestamp)));

      return {
        lat: lerp(p0.lat, p1.lat, t),
        lng: lerp(p0.lng, p1.lng, t),
        speed: lerp(p0.speed, p1.speed, t),
        heading: lerpBearing(p0.heading, p1.heading, t),
        status: p0.status,
        timestamp: targetTs,
      };
    },
    [points]
  );

  const animate = useCallback(
    (now: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;

      // Advance elapsed time by delta * speed multiplier
      elapsedRef.current += delta * speedRef.current;

      if (totalDuration > 0 && elapsedRef.current >= totalDuration) {
        // Finished
        elapsedRef.current = totalDuration;
        setProgress(100);
        setReplayPosition(getPositionAtElapsed(totalDuration));
        setIsPlaying(false);
        return;
      }

      const pct = totalDuration > 0 ? (elapsedRef.current / totalDuration) * 100 : 0;
      setProgress(Math.min(100, Math.round(pct * 10) / 10));
      setReplayPosition(getPositionAtElapsed(elapsedRef.current));

      rafRef.current = requestAnimationFrame(animate);
    },
    [totalDuration, getPositionAtElapsed]
  );

  useEffect(() => {
    if (isPlaying && enabled && points.length >= 2) {
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, enabled, animate, points.length]);

  const play = useCallback(() => {
    if (points.length < 2) return;
    // If at end, restart
    if (elapsedRef.current >= totalDuration) {
      elapsedRef.current = 0;
    }
    setIsPlaying(true);
  }, [points.length, totalDuration]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    elapsedRef.current = 0;
    setProgress(0);
    setReplayPosition(points.length > 0 ? points[0] : null);
  }, [points]);

  const setSpeed = useCallback((s: ReplaySpeed) => {
    setSpeedState(s);
  }, []);

  const scrubTo = useCallback(
    (pct: number) => {
      const clamped = Math.max(0, Math.min(100, pct));
      elapsedRef.current = (clamped / 100) * totalDuration;
      setProgress(clamped);
      setReplayPosition(getPositionAtElapsed(elapsedRef.current));
    },
    [totalDuration, getPositionAtElapsed]
  );

  return {
    replayPosition,
    progress,
    isPlaying,
    speed,
    play,
    pause,
    reset,
    setSpeed,
    scrubTo,
  };
}
