/**
 * fuelCalc — single source of truth for point-in-time fuel math.
 *
 * The tanker's ultrasonic sensor sits at the TOP of the tank and reports the
 * distance (in centimetres) down to the fuel surface. Distance is therefore
 * INVERSELY proportional to how full the tank is:
 *   - SMALL distance  => surface is near the sensor => tank is FULL
 *   - LARGE distance  => surface is near the floor  => tank is EMPTY
 *
 * This module converts that raw distance into a calibrated fuel PERCENTAGE
 * (0–100). The conversion must happen exactly ONCE, at data ingestion, so that
 * every downstream consumer can treat `fuelLevel` uniformly as a percentage.
 *
 * IMPORTANT — scope: this module only does the point-in-time distance→percent
 * conversion. It does NOT detect theft. Real theft detection requires observing
 * an abnormal fuel drop-RATE over time (a sudden, large decrease that is not
 * explained by normal consumption), correlated with location and hatch state.
 * That is a stateful, server-side follow-up (compare consecutive readings,
 * threshold the delta per unit time) and deliberately lives outside this file.
 */

/**
 * Per-tank ultrasonic calibration. The sensor sits at the top of the tank and
 * reports the distance (cm) to the fuel surface: SMALL distance = FULL tank.
 */
export interface TankCalibration {
  /** Sensor reading (cm) when the tank is full — surface near the sensor. */
  fullDistanceCm: number;
  /** Sensor reading (cm) when the tank is empty — surface at the tank floor. */
  emptyDistanceCm: number;
}

/**
 * Default calibration — PLACEHOLDER values matching the app's previous crude
 * 100cm tank-height assumption. MUST be replaced with real per-tank field
 * calibration before production use.
 */
export const DEFAULT_CALIBRATION: TankCalibration = { fullDistanceCm: 0, emptyDistanceCm: 100 };

/**
 * Convert a raw ultrasonic distance (cm) to fuel percentage (0–100).
 *
 * Because distance is inversely proportional to fill level, a full tank
 * (distance == fullDistanceCm) maps to 100% and an empty tank
 * (distance == emptyDistanceCm) maps to 0%. The result is clamped to [0, 100]
 * and rounded to the nearest integer.
 *
 * @param distanceCm Raw ultrasonic distance to the fuel surface, in cm.
 * @param cal        Per-tank calibration (defaults to DEFAULT_CALIBRATION).
 * @returns Fuel level as an integer percentage in [0, 100]; 0 if the input is
 *          non-finite or the calibration span is invalid.
 */
export function distanceToFuelPercent(distanceCm: number, cal: TankCalibration = DEFAULT_CALIBRATION): number {
  const span = cal.emptyDistanceCm - cal.fullDistanceCm;
  if (!Number.isFinite(distanceCm) || span <= 0) return 0;
  const pct = ((cal.emptyDistanceCm - distanceCm) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
