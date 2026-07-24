import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useState } from 'react';

export function FuelLoadCharts() {
  const [activeChart, setActiveChart] = useState<'fuel' | 'load' | 'combined'>('combined');

  // Mock data for charts
  const fuelData = [
    { time: '00:00', TNK001: 95, TNK002: 88, TNK003: 92, TNK004: 78 },
    { time: '04:00', TNK001: 88, TNK002: 80, TNK003: 85, TNK004: 65 },
    { time: '08:00', TNK001: 75, TNK002: 68, TNK003: 78, TNK004: 48 },
    { time: '12:00', TNK001: 62, TNK002: 52, TNK003: 65, TNK004: 32 },
    { time: '16:00', TNK001: 48, TNK002: 45, TNK003: 52, TNK004: 23 },
    { time: '20:00', TNK001: 35, TNK002: 38, TNK003: 42, TNK004: 18 }
  ];

  const loadData = [
    { time: '00:00', TNK001: 30, TNK002: 31, TNK003: 29.8, TNK004: 27.6 },
    { time: '04:00', TNK001: 29.8, TNK002: 30.8, TNK003: 29.6, TNK004: 27.4 },
    { time: '08:00', TNK001: 29.5, TNK002: 30.5, TNK003: 29.3, TNK004: 27.1 },
    { time: '12:00', TNK001: 29.2, TNK002: 30.2, TNK003: 29.0, TNK004: 26.8 },
    { time: '16:00', TNK001: 28.8, TNK002: 29.8, TNK003: 28.6, TNK004: 26.4 },
    { time: '20:00', TNK001: 28.5, TNK002: 29.5, TNK003: 28.2, TNK004: 26.0 }
  ];

  const combinedData = [
    { time: '00:00', fuel: 88, load: 29.6 },
    { time: '04:00', fuel: 79, load: 29.4 },
    { time: '08:00', fuel: 67, load: 29.1 },
    { time: '12:00', fuel: 53, load: 28.8 },
    { time: '16:00', fuel: 42, load: 28.4 },
    { time: '20:00', fuel: 33, load: 28.1 }
  ];

  const charts = [
    { id: 'fuel', label: 'Fuel Trend', icon: TrendingDown },
    { id: 'load', label: 'Load Trend', icon: TrendingUp },
    { id: 'combined', label: 'Combined', icon: Activity }
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg text-white neon-text">Real-Time Trends</h3>
        
        {/* Chart Selector */}
        <div className="flex gap-2">
          {charts.map((chart) => {
            const Icon = chart.icon;
            return (
              <button
                key={chart.id}
                onClick={() => setActiveChart(chart.id as any)}
                className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 hover:scale-105 flex items-center gap-2 ${
                  activeChart === chart.id
                    ? 'bg-[#009FFD] text-white neon-glow'
                    : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                {chart.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 bg-[#07121A] rounded-lg p-4">
        {activeChart === 'fuel' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fuelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
              <XAxis 
                dataKey="time" 
                stroke="#D9DCE1"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#D9DCE1"
                style={{ fontSize: '12px' }}
                label={{ value: 'Fuel (%)', angle: -90, position: 'insideLeft', fill: '#D9DCE1' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0C1E2C', 
                  border: '1px solid rgba(0, 229, 255, 0.5)',
                  borderRadius: '8px',
                  boxShadow: '0 0 20px rgba(0, 159, 253, 0.3)'
                }}
                labelStyle={{ color: '#00E5FF' }}
              />
              <Legend />
              <Line type="monotone" dataKey="TNK001" stroke="#00E5FF" strokeWidth={2} dot={{ fill: '#00E5FF', r: 4 }} />
              <Line type="monotone" dataKey="TNK002" stroke="#009FFD" strokeWidth={2} dot={{ fill: '#009FFD', r: 4 }} />
              <Line type="monotone" dataKey="TNK003" stroke="#28B463" strokeWidth={2} dot={{ fill: '#28B463', r: 4 }} />
              <Line type="monotone" dataKey="TNK004" stroke="#FFB02E" strokeWidth={2} dot={{ fill: '#FFB02E', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeChart === 'load' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={loadData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
              <XAxis 
                dataKey="time" 
                stroke="#D9DCE1"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#D9DCE1"
                style={{ fontSize: '12px' }}
                label={{ value: 'Load (Tons)', angle: -90, position: 'insideLeft', fill: '#D9DCE1' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0C1E2C', 
                  border: '1px solid rgba(0, 229, 255, 0.5)',
                  borderRadius: '8px',
                  boxShadow: '0 0 20px rgba(0, 159, 253, 0.3)'
                }}
                labelStyle={{ color: '#00E5FF' }}
              />
              <Legend />
              <Bar dataKey="TNK001" fill="#00E5FF" />
              <Bar dataKey="TNK002" fill="#009FFD" />
              <Bar dataKey="TNK003" fill="#28B463" />
              <Bar dataKey="TNK004" fill="#FFB02E" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeChart === 'combined' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 229, 255, 0.1)" />
              <XAxis 
                dataKey="time" 
                stroke="#D9DCE1"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                yAxisId="left"
                stroke="#00E5FF"
                style={{ fontSize: '12px' }}
                label={{ value: 'Fuel (%)', angle: -90, position: 'insideLeft', fill: '#00E5FF' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#FFB02E"
                style={{ fontSize: '12px' }}
                label={{ value: 'Load (Tons)', angle: 90, position: 'insideRight', fill: '#FFB02E' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0C1E2C', 
                  border: '1px solid rgba(0, 229, 255, 0.5)',
                  borderRadius: '8px',
                  boxShadow: '0 0 20px rgba(0, 159, 253, 0.3)'
                }}
                labelStyle={{ color: '#00E5FF' }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="fuel" 
                stroke="#00E5FF" 
                strokeWidth={3} 
                dot={{ fill: '#00E5FF', r: 5 }}
                name="Average Fuel (%)"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="load" 
                stroke="#FFB02E" 
                strokeWidth={3} 
                dot={{ fill: '#FFB02E', r: 5 }}
                name="Average Load (T)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg p-3">
          <div className="text-xs text-[#D9DCE1]/60 mb-1">Avg Fuel Drop</div>
          <div className="text-xl text-[#00E5FF]">-12%/hr</div>
        </div>
        <div className="bg-[#07121A] border border-[#FFB02E]/30 rounded-lg p-3">
          <div className="text-xs text-[#D9DCE1]/60 mb-1">Avg Load Drop</div>
          <div className="text-xl text-[#FFB02E]">-1.5T/hr</div>
        </div>
        <div className="bg-[#07121A] border border-[#28B463]/30 rounded-lg p-3">
          <div className="text-xs text-[#D9DCE1]/60 mb-1">Fleet Efficiency</div>
          <div className="text-xl text-[#28B463]">94.2%</div>
        </div>
      </div>
    </div>
  );
}
