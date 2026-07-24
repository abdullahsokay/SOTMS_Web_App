import { Satellite, Signal, Droplets } from 'lucide-react';

interface SensorDoc {
    id: string;
    distance_cm: number;
    gps: {
        latitude: number;
        longitude: number;
        satellites: number;
        status: string;
    };
    rssi: number;
    timestamp: string;
    uptime_ms: number;
}

interface LiveSensorFeedProps {
    readings: SensorDoc[];
}

export function LiveSensorFeed({ readings = [] }: LiveSensorFeedProps) {
    return (
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-6 neon-glow h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl text-white font-semibold">Live Sensor Feed</h3>
                    <p className="text-sm text-[#D9DCE1]/60">Real-time telemetry log (Last 50 Records)</p>
                </div>
                <div className="flex gap-2">
                    <span className="flex items-center gap-1 text-xs text-[#28B463] bg-[#28B463]/10 px-2 py-1 rounded">
                        <Signal className="w-3 h-3" /> Online
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-[#00E5FF]/20 text-left">
                            <th className="py-3 px-4 text-sm text-[#D9DCE1]/70 font-medium">Record ID</th>
                            <th className="py-3 px-4 text-sm text-[#D9DCE1]/70 font-medium">Distance (cm)</th>
                            <th className="py-3 px-4 text-sm text-[#D9DCE1]/70 font-medium">GPS (Lat / Lng)</th>
                            <th className="py-3 px-4 text-sm text-[#D9DCE1]/70 font-medium">Satellites</th>
                            <th className="py-3 px-4 text-sm text-[#D9DCE1]/70 font-medium">RSSI</th>
                            <th className="py-3 px-4 text-sm text-[#D9DCE1]/70 font-medium">Timestamp</th>
                            <th className="py-3 px-4 text-sm text-[#D9DCE1]/70 font-medium">Uptime</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#00E5FF]/10">
                        {readings.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-[#D9DCE1]/40 italic">
                                    No active sensor data available
                                </td>
                            </tr>
                        ) : (
                                readings.map((reading) => (
                                    <tr key={reading.id} className="hover:bg-[#00E5FF]/5 transition-colors group">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                                                <span className="text-white font-mono text-xs">{reading.id}</span>
                                        </div>
                                    </td>

                                        {/* Distance (cm) */}
                                    <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <Droplets className={`w-4 h-4 ${(reading.distance_cm > 0) ? 'text-[#00E5FF]' : 'text-[#FF4D4D]'}`} />
                                                <span className="font-mono text-white">
                                                    {reading.distance_cm ?? '--'}
                                                </span>
                                        </div>
                                    </td>

                                        {/* GPS */}
                                    <td className="py-3 px-4">
                                            {reading.gps && typeof reading.gps.latitude === 'number' && typeof reading.gps.longitude === 'number' ? (
                                                <div className="flex flex-col text-xs font-mono text-[#D9DCE1]">
                                                    <span className="text-[#28B463]">Lat: {reading.gps.latitude.toFixed(5)}</span>
                                                    <span className="text-[#00E5FF]">Lng: {reading.gps.longitude.toFixed(5)}</span>
                                                </div>
                                            ) : <span className="text-xs text-red-500">Invalid GPS</span>}
                                    </td>

                                        {/* Satellites */}
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                                <Satellite className={`w-4 h-4 ${(reading.gps?.satellites ?? 0) >= 4 ? 'text-[#28B463]' : 'text-[#FF4D4D]'}`} />
                                                <span className="font-mono text-[#D9DCE1]">{reading.gps?.satellites ?? 0}</span>
                                        </div>
                                    </td>

                                        {/* RSSI */}
                                    <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <Signal className={`w-4 h-4 ${(reading.rssi ?? -100) > -80 ? 'text-[#28B463]' : 'text-[#FF4D4D]'}`} />
                                                <span className="font-mono text-[#D9DCE1]">{reading.rssi ?? '--'}</span>
                                        </div>
                                    </td>

                                        {/* Timestamp */}
                                    <td className="py-3 px-4 text-xs text-[#D9DCE1]/50 font-mono">
                                            {reading.timestamp}
                                        </td>

                                        {/* Uptime */}
                                        <td className="py-3 px-4">
                                            <span className="font-mono text-[#D9DCE1]">
                                                {reading.uptime_ms ? `${reading.uptime_ms} ms` : '--'}
                                            </span>
                                    </td>
                                </tr>
                                ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
